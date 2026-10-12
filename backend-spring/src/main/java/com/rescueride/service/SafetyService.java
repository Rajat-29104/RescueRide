package com.rescueride.service;

import com.rescueride.exception.ApiException;
import com.rescueride.security.AppPrincipal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SafetyService {
    private final JdbcTemplate jdbc;
    private final AccessControlService access;

    public SafetyService(JdbcTemplate jdbc, AccessControlService access) {
        this.jdbc = jdbc;
        this.access = access;
    }

    public Map<String, Object> listContacts(AppPrincipal user) {
        access.requireRole(user, "driver");
        return Map.of("contacts", jdbc.queryForList("""
                select id, driver_id, name, relationship, phone_number, created_at, updated_at
                from public.emergency_contacts where driver_id = ? order by created_at desc
                """, user.id()));
    }

    @Transactional
    public Map<String, Object> addContact(AppPrincipal user, Map<String, Object> body) {
        access.requireRole(user, "driver");
        String name = text(body, "name");
        String relationship = text(body, "relationship");
        String phone = firstText(body, "phoneNumber", "phone", "contactPhone");
        if (name == null || name.length() > 120 || relationship == null || relationship.length() > 80
                || phone == null || phone.length() < 7 || phone.length() > 40) {
            throw ApiException.badRequest("Provide a valid contact name, relationship, and phone number.");
        }
        Map<String, Object> saved = jdbc.queryForMap("""
                insert into public.emergency_contacts (driver_id, name, relationship, phone_number)
                values (?, ?, ?, ?)
                returning id, driver_id, name, relationship, phone_number, created_at, updated_at
                """, user.id(), name, relationship, phone);
        return Map.of("contact", saved);
    }

    @Transactional
    public Map<String, Object> raiseSos(AppPrincipal user, Map<String, Object> body) {
        access.requireRole(user, "driver");
        UUID requestId = parseUuid(body.get("requestId"), "requestId");
        Double latitude = number(body.get("latitude"), "latitude");
        Double longitude = number(body.get("longitude"), "longitude");
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            throw ApiException.badRequest("Coordinates are outside the valid latitude/longitude range.");
        }
        Map<String, Object> request = lockRequest(requestId);
        if (!user.id().equals(request.get("driver_id")) && !user.id().equals(request.get("mechanic_id"))) {
            throw ApiException.forbidden("You are not a participant in this request.");
        }
        Integer openSosCount = jdbc.queryForObject("""
                select count(*) from public.sos_events
                where related_request_id = ? and status in ('RAISED', 'ACKNOWLEDGED')
                """, Integer.class, requestId);
        if (openSosCount != null && openSosCount > 0) {
            throw ApiException.conflict("An active SOS event already exists for this request.");
        }
        String message = text(body, "message");
        Map<String, Object> saved = jdbc.queryForMap("""
                insert into public.sos_events
                    (driver_id, related_request_id, latitude, longitude, status, resolution_notes)
                values (?, ?, ?, ?, 'RAISED'::public.sos_status, ?)
                returning id, driver_id, related_request_id, latitude, longitude, status,
                          raised_at, acknowledged_by, acknowledged_at, resolved_by, resolved_at,
                          resolution_notes, created_at, updated_at
                """, user.id(), requestId, latitude, longitude, message);
        UUID sosId = (UUID) saved.get("id");
        jdbc.update("""
                insert into public.sos_event_history (sos_event_id, previous_status, new_status, changed_by, notes)
                values (?, null, 'RAISED'::public.sos_status, ?, ?)
                """, sosId, user.id(), message);
        return Map.of("sos", saved);
    }

    public List<Map<String, Object>> activeIncidents(AppPrincipal user) {
        access.requireRole(user, "admin");
        return jdbc.queryForList("""
                select id, request_id, job_id, reporter_id, subject_user_id, category, description,
                       status, assigned_admin_id, resolution_notes, created_at, updated_at, resolved_at
                from public.incident_reports order by created_at desc limit 250
                """);
    }

    @Transactional
    public Map<String, Object> reportIncident(AppPrincipal user, Map<String, Object> body) {
        UUID requestId = parseUuid(body.get("requestId"), "requestId");
        UUID reporterId = parseUuid(body.get("reporterId"), "reporterId");
        if (!reporterId.equals(user.id())) throw ApiException.forbidden("Reporter ID does not match the authenticated user.");
        String reason = text(body, "reasonHeader");
        String comment = text(body, "comment");
        if (reason == null || !List.of("inappropriate_behavior", "pricing_issue", "delay", "other").contains(reason)) {
            throw ApiException.badRequest("Invalid report reason.");
        }
        if (comment == null || comment.length() > 4000) throw ApiException.badRequest("A comment of at most 4000 characters is required.");

        Map<String, Object> request = lockRequest(requestId);
        if (!user.id().equals(request.get("driver_id")) && !user.id().equals(request.get("mechanic_id"))) {
            throw ApiException.forbidden("You are not a participant in this request.");
        }
        Integer duplicate = jdbc.queryForObject("""
                select count(*) from public.issue_reports
                where request_id = ? and reporter_id = ? and reason_header = ?
                """, Integer.class, requestId, user.id(), reason);
        if (duplicate != null && duplicate > 0) throw ApiException.conflict("You have already submitted this report for the request.");
        Map<String, Object> saved;
        try {
            saved = jdbc.queryForMap("""
                    insert into public.issue_reports (request_id, reporter_id, reason_header, comment)
                    values (?, ?, ?, ?)
                    returning id, request_id, reporter_id, reason_header, comment, created_at
                    """, requestId, user.id(), reason, comment);
        } catch (org.springframework.dao.DuplicateKeyException exception) {
            throw ApiException.conflict("You have already submitted this report for the request.");
        }
        return Map.of("report", saved);
    }

    public List<Map<String, Object>> reports(AppPrincipal user) {
        access.requireRole(user, "admin");
        return jdbc.queryForList("""
                select ir.id, ir.request_id, ir.reporter_id, ir.reported_user_id,
                       ir.reason_header, ir.comment, ir.created_at,
                       json_build_object('id', reporter.id, 'full_name', reporter.full_name,
                                         'role', reporter.role::text) as reporter,
                       json_build_object('id', reported.id, 'full_name', reported.full_name,
                                         'role', reported.role::text) as reported_user,
                       json_build_object('id', r.id, 'service_type', r.service_type,
                                         'problem_description', r.problem_description,
                                         'incident_address', r.incident_address, 'status', r.status::text) as request
                from public.issue_reports ir
                left join public.profiles reporter on reporter.id = ir.reporter_id
                left join public.profiles reported on reported.id = ir.reported_user_id
                left join public.rescue_requests r on r.id = ir.request_id
                order by ir.created_at desc limit 200
                """);
    }

    @Transactional
    public Map<String, Object> deleteReports(AppPrincipal user, Map<String, Object> body) {
        access.requireRole(user, "admin");
        Object rawIds = body.get("ids");
        if (!(rawIds instanceof List<?> ids) || ids.isEmpty() || ids.size() > 200) {
            throw ApiException.badRequest("Provide between 1 and 200 report IDs.");
        }
        List<UUID> reportIds = ids.stream().map(id -> parseUuid(id, "report ID")).toList();
        int removed = 0;
        for (UUID reportId : reportIds) {
            removed += jdbc.update("delete from public.issue_reports where id = ?", reportId);
        }
        return Map.of("success", true, "count", removed);
    }

    private Map<String, Object> lockRequest(UUID requestId) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                select id, driver_id, mechanic_id from public.rescue_requests where id = ? for update
                """, requestId);
        if (rows.isEmpty()) throw ApiException.notFound("Request not found.");
        return rows.get(0);
    }

    private String text(Map<String, Object> body, String key) {
        Object value = body.get(key);
        if (!(value instanceof String text)) return null;
        String normalized = text.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private String firstText(Map<String, Object> body, String... keys) {
        for (String key : keys) {
            String value = text(body, key);
            if (value != null) return value;
        }
        return null;
    }

    private Double number(Object value, String field) {
        if (!(value instanceof Number number)) throw ApiException.badRequest(field + " is required.");
        double parsed = number.doubleValue();
        if (!Double.isFinite(parsed)) throw ApiException.badRequest(field + " must be a finite number.");
        return parsed;
    }

    private UUID parseUuid(Object value, String field) {
        UUID parsed = optionalUuid(value, field);
        if (parsed == null) throw ApiException.badRequest(field + " is required.");
        return parsed;
    }

    private UUID optionalUuid(Object value, String field) {
        if (value == null || String.valueOf(value).isBlank()) return null;
        try {
            return UUID.fromString(String.valueOf(value));
        } catch (IllegalArgumentException exception) {
            throw ApiException.badRequest(field + " must be a valid UUID.");
        }
    }
}
