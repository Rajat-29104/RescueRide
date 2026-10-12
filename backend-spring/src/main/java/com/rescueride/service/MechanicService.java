package com.rescueride.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rescueride.exception.ApiException;
import com.rescueride.security.AppPrincipal;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MechanicService {
    private final JdbcTemplate jdbc;
    private final AccessControlService access;
    private final ObjectMapper mapper;

    public MechanicService(JdbcTemplate jdbc, AccessControlService access, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.access = access;
        this.mapper = mapper;
    }

    public Map<String, Object> profile(AppPrincipal user) {
        access.requireRole(user, "mechanic");
        List<Map<String, Object>> profiles = jdbc.queryForList("""
                select user_id, business_name, years_experience, specializations::text as specializations, location_label,
                       verification_status::text as verification_status, is_available,
                       rating_avg, rating_count
                from public.mechanic_profiles where user_id = ?
                """, user.id());
        if (profiles.isEmpty()) throw ApiException.notFound("Mechanic profile not found.");
        Map<String, Object> profile = profiles.get(0);
        try {
            String specializations = (String) profile.get("specializations");
            profile.put("specializations", specializations == null
                    ? List.of()
                    : mapper.readValue(specializations, new TypeReference<List<String>>() {}));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Could not read mechanic specializations from the database.", exception);
        }
        return Map.of("profile", profile);
    }

    @Transactional
    public Map<String, Object> updateProfile(AppPrincipal user, Map<String, Object> body) {
        access.requireRole(user, "mechanic");
        String businessName = text(body, "business_name");
        String locationLabel = text(body, "location_label");
        Integer yearsExperience = integer(body.get("years_experience"), "years_experience");
        if (businessName == null || businessName.length() > 150) {
            throw ApiException.badRequest("Business name is required and must not exceed 150 characters.");
        }
        if (yearsExperience == null || yearsExperience < 0 || yearsExperience > 80) {
            throw ApiException.badRequest("Years of experience must be between 0 and 80.");
        }
        Object rawSpecializations = body.get("specializations");
        if (!(rawSpecializations instanceof List<?> specializations)
                || specializations.size() > 40
                || specializations.stream().anyMatch(value -> !(value instanceof String text)
                        || text.isBlank() || text.length() > 80)) {
            throw ApiException.badRequest("Specializations must be a list of at most 40 non-empty labels.");
        }
        String encodedSpecializations;
        try {
            encodedSpecializations = mapper.writeValueAsString(specializations.stream()
                    .map(value -> ((String) value).trim()).toList());
        } catch (JsonProcessingException exception) {
            throw ApiException.badRequest("Invalid specializations.");
        }
        List<Map<String, Object>> profiles = jdbc.queryForList("""
                select verification_status::text as verification_status, is_available from public.mechanic_profiles
                where user_id = ? for update
                """, user.id());
        if (profiles.isEmpty()) throw ApiException.notFound("Mechanic profile not found.");
        boolean available = Boolean.TRUE.equals(body.get("is_available"));
        if (available && !"approved".equals(profiles.get(0).get("verification_status"))) {
            throw ApiException.forbidden("Mechanic verification is required before becoming available.");
        }
        Integer activeJobs = jdbc.queryForObject("""
                select count(*) from public.rescue_requests
                where mechanic_id = ? and status in ('accepted','en_route','arrived','in_progress')
                """, Integer.class, user.id());
        if (available && activeJobs != null && activeJobs > 0) {
            throw ApiException.conflict("Availability cannot be enabled while you have an active job.");
        }
        jdbc.update("""
                update public.mechanic_profiles
                set business_name = ?, years_experience = ?, specializations = ?::jsonb,
                    location_label = ?, is_available = ?,
                    current_status = case when ? then 'online' when ? then 'on_job' else 'offline' end
                where user_id = ?
                """, businessName, yearsExperience, encodedSpecializations, locationLabel,
                available, available, activeJobs != null && activeJobs > 0, user.id());
        return profile(user);
    }

    private String text(Map<String, Object> body, String key) {
        Object value = body.get(key);
        if (!(value instanceof String text)) return null;
        String trimmed = text.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private Integer integer(Object value, String field) {
        if (!(value instanceof Number number)) throw ApiException.badRequest(field + " is required.");
        return number.intValue();
    }
}
