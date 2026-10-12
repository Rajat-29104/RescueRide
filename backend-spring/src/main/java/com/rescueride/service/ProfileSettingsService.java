package com.rescueride.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rescueride.exception.ApiException;
import com.rescueride.security.AppPrincipal;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProfileSettingsService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public ProfileSettingsService(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    public Map<String, Object> preferences(AppPrincipal user) {
        String json = jdbc.query("""
                select jsonb_build_object(
                    'user_id', ?, 'theme', coalesce(theme, 'system'),
                    'preferred_language', coalesce(preferred_language, 'en'),
                    'notification_preferences', coalesce(notification_preferences, '{}'::jsonb),
                    'communication_preferences', to_jsonb(coalesce(communication_preferences, array[]::text[])),
                    'secondary_phone', secondary_phone, 'home_location_label', home_location_label,
                    'work_location_label', work_location_label, 'bio', bio,
                    'created_at', created_at, 'updated_at', updated_at
                )::text
                from public.profile_preferences where user_id = ?
                """, rs -> rs.next() ? rs.getString(1) : null, user.id(), user.id());
        if (json == null) {
            return Map.of("preferences", Map.of(
                    "user_id", user.id(), "theme", "system", "preferred_language", "en",
                    "notification_preferences", Map.of("jobAlerts", true, "messageAlerts", true, "push", true),
                    "communication_preferences", List.of("call", "sms"), "secondary_phone", ""));
        }
        try {
            return Map.of("preferences", mapper.readValue(json, new TypeReference<Map<String, Object>>() {}));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Could not read saved user preferences.", exception);
        }
    }

    @Transactional
    public Map<String, Object> updatePreferences(AppPrincipal user, Map<String, Object> body) {
        String theme = text(body.get("theme"), "system");
        String language = text(body.get("preferred_language"), "en");
        if (!List.of("system", "light", "dark").contains(theme)) throw ApiException.badRequest("Invalid theme.");
        if (language.length() > 12) throw ApiException.badRequest("Preferred language is too long.");
        Map<?, ?> notificationPreferences = body.get("notification_preferences") instanceof Map<?, ?> map
                ? map : Map.of("jobAlerts", true, "messageAlerts", true, "push", true);
        if (notificationPreferences.size() > 30) throw ApiException.badRequest("Too many notification preferences.");
        List<String> communicationPreferences = strings(body.get("communication_preferences"));
        String notificationsJson = json(notificationPreferences);
        String communicationArray = jdbc.execute((Connection connection) -> {
            try (PreparedStatement statement = connection.prepareStatement("""
                    insert into public.profile_preferences
                        (user_id, theme, preferred_language, notification_preferences, communication_preferences,
                         secondary_phone, home_location_label, work_location_label, bio)
                    values (?, ?, ?, ?::jsonb, ?, ?, ?, ?, ?)
                    on conflict (user_id) do update set
                        theme = excluded.theme,
                        preferred_language = excluded.preferred_language,
                        notification_preferences = excluded.notification_preferences,
                        communication_preferences = excluded.communication_preferences,
                        secondary_phone = excluded.secondary_phone,
                        home_location_label = excluded.home_location_label,
                        work_location_label = excluded.work_location_label,
                        bio = excluded.bio
                    """)) {
                statement.setObject(1, user.id());
                statement.setString(2, theme);
                statement.setString(3, language);
                statement.setString(4, notificationsJson);
                statement.setArray(5, connection.createArrayOf("text", communicationPreferences.toArray()));
                statement.setString(6, limit(body.get("secondary_phone"), "secondary_phone", 40));
                statement.setString(7, limit(body.get("home_location_label"), "home_location_label", 150));
                statement.setString(8, limit(body.get("work_location_label"), "work_location_label", 150));
                statement.setString(9, limit(body.get("bio"), "bio", 1000));
                statement.executeUpdate();
                return null;
            } catch (SQLException exception) {
                throw new IllegalStateException("Could not save user preferences.", exception);
            }
        });
        return preferences(user);
    }

    public Map<String, Object> changeRequests(AppPrincipal user) {
        return Map.of("requests", jdbc.queryForList("""
                select id, user_id, role, target_table, field_key, old_value, new_value,
                       reason, status, review_notes, reviewed_by, created_at, reviewed_at
                from public.profile_change_requests where user_id = ?
                order by created_at desc
                """, user.id()));
    }

    @Transactional
    public Map<String, Object> requestProfileChange(AppPrincipal user, Map<String, Object> body) {
        String targetTable = text(body.get("target_table"), "");
        String field = text(body.get("field_key"), "");
        if (!"profiles".equals(targetTable) || !List.of("full_name", "phone").contains(field)) {
            throw ApiException.badRequest("Only full name and phone changes can be submitted for review.");
        }
        if (!body.containsKey("new_value")) throw ApiException.badRequest("new_value is required.");
        Object value = body.get("new_value");
        if (!(value instanceof String newValue) || newValue.length() > 200) {
            throw ApiException.badRequest("The new profile value must be a string of at most 200 characters.");
        }
        Integer pending = jdbc.queryForObject("""
                select count(*) from public.profile_change_requests
                where user_id = ? and field_key = ? and status = 'pending'
                """, Integer.class, user.id(), field);
        if (pending != null && pending > 0) throw ApiException.conflict("A profile change for this field is already pending.");
        String valueJson = json(value);
        Map<String, Object> saved = jdbc.queryForMap("""
                insert into public.profile_change_requests
                    (user_id, role, target_table, field_key, old_value, new_value, reason)
                values (?, ?, ?, ?, ?, ?::jsonb, ?)
                returning id, user_id, role, target_table, field_key, old_value, new_value,
                          reason, status, created_at
                """, user.id(), user.role(), targetTable, field,
                limit(body.get("old_value"), "old_value", 200), valueJson,
                limit(body.get("reason"), "reason", 500));
        return Map.of("request", saved);
    }

    private List<String> strings(Object value) {
        if (value == null) return List.of("call", "sms");
        if (!(value instanceof List<?> values) || values.size() > 20
                || values.stream().anyMatch(item -> !(item instanceof String text) || text.isBlank() || text.length() > 40)) {
            throw ApiException.badRequest("communication_preferences must be a list of up to 20 labels.");
        }
        return values.stream().map(item -> ((String) item).trim()).distinct().toList();
    }

    private String text(Object value, String fallback) {
        if (!(value instanceof String text) || text.isBlank()) return fallback;
        return text.trim();
    }

    private String limit(Object value, String field, int max) {
        if (value == null) return null;
        if (!(value instanceof String text) || text.length() > max) {
            throw ApiException.badRequest(field + " must be a string of at most " + max + " characters.");
        }
        return text.trim().isEmpty() ? null : text.trim();
    }

    private String json(Object value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw ApiException.badRequest("Invalid JSON value.");
        }
    }
}
