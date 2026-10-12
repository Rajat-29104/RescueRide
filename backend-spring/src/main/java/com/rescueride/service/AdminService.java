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
public class AdminService {
    private final JdbcTemplate jdbc;
    private final AccessControlService access;

    public AdminService(JdbcTemplate jdbc, AccessControlService access) {
        this.jdbc = jdbc;
        this.access = access;
    }

    public Map<String, Object> stats(AppPrincipal user) {
        access.requireRole(user, "admin");
        Map<String, Object> counts = jdbc.queryForMap("""
                select
                    (select count(*) from public.rescue_requests) as total_requests,
                    (select count(*) from public.rescue_requests where status in ('pending','accepted','en_route','arrived','in_progress')) as active_requests,
                    (select count(*) from public.rescue_requests where status = 'completed') as completed_requests,
                    (select count(*) from public.rescue_requests where status = 'cancelled') as cancelled_requests,
                    (select count(*) from public.mechanic_profiles) as total_mechanics,
                    (select count(*) from public.mechanic_profiles where verification_status::text = 'approved') as verified_mechanics,
                    (select count(*) from public.mechanic_profiles where verification_status::text = 'pending') as pending_verifications,
                    (select count(*) from public.mechanic_profiles where verification_status::text = 'approved' and is_available = true) as active_mechanics,
                    (select count(*) from public.profiles where role::text = 'driver') as total_drivers,
                    (select count(*) from public.profiles where role::text in ('driver', 'mechanic')) as total_users,
                    coalesce((select round(avg(rating)::numeric, 2) from public.request_reviews), 5.00) as avg_rating,
                    coalesce((select round(avg(extract(epoch from (accepted_at - created_at))/60)::numeric, 1)
                              from public.rescue_requests where accepted_at is not null), 0) as avg_response_time,
                    coalesce((select round(avg(extract(epoch from (completed_at - accepted_at))/60)::numeric, 1)
                              from public.rescue_requests where completed_at is not null and accepted_at is not null), 0) as avg_completion_time
                """);
        List<Map<String, Object>> statusBreakdown = jdbc.queryForList("""
                select status::text as status, count(*) as count from public.rescue_requests group by status
                """);
        List<Map<String, Object>> serviceBreakdown = jdbc.queryForList("""
                select service_type, count(*) as count from public.rescue_requests group by service_type
                """);
        Map<String, Object> ratings = jdbc.queryForMap("""
                select count(*) filter (where rating = 1) as "1",
                       count(*) filter (where rating = 2) as "2",
                       count(*) filter (where rating = 3) as "3",
                       count(*) filter (where rating = 4) as "4",
                       count(*) filter (where rating = 5) as "5"
                from public.request_reviews
                """);
        List<Map<String, Object>> topMechanics = jdbc.queryForList("""
                select mp.user_id, mp.business_name, mp.rating_avg, mp.rating_count,
                       json_build_object('full_name', p.full_name, 'phone', p.phone, 'avatar_url', p.avatar_url) as profile
                from public.mechanic_profiles mp join public.profiles p on p.id = mp.user_id
                order by mp.rating_avg desc nulls last, mp.rating_count desc nulls last
                limit 5
                """);
        Map<String, Object> stats = new java.util.LinkedHashMap<>(counts);
        stats.put("statusBreakdown", statusBreakdown);
        stats.put("serviceTypeBreakdown", serviceBreakdown);
        stats.put("ratingsDistribution", ratings);
        stats.put("topMechanics", topMechanics);
        stats.put("activeMechanicLocations", jdbc.queryForList("""
                select mp.user_id, mp.business_name, st_asgeojson(mp.current_location) as current_location,
                       mp.is_available,
                       json_build_object('full_name', p.full_name, 'phone', p.phone, 'avatar_url', p.avatar_url) as profiles
                from public.mechanic_profiles mp join public.profiles p on p.id = mp.user_id
                where mp.verification_status::text = 'approved' and mp.is_available = true
                """));
        stats.put("activeIncidents", jdbc.queryForList("""
                select id, status::text as status, service_type, problem_description,
                       st_asgeojson(incident_location) as incident_location, mechanic_id
                from public.rescue_requests
                where status in ('pending','accepted','en_route','arrived','in_progress')
                """));
        return Map.of("stats", stats);
    }

    public Map<String, Object> requests(AppPrincipal user, String status, boolean flagged, int limit, int offset) {
        access.requireRole(user, "admin");
        int safeLimit = Math.max(1, Math.min(limit, 250));
        int safeOffset = Math.max(0, offset);
        flagged = flagged || "flagged".equals(status);
        if (flagged) status = null;
        List<Map<String, Object>> rows;
        if (status == null || status.isBlank()) {
            rows = jdbc.queryForList("""
                    select r.id, r.driver_id, r.mechanic_id, r.status::text as status, r.service_type,
                           r.problem_description, r.incident_address, st_asgeojson(r.incident_location) as incident_location,
                           r.vehicle_make, r.vehicle_model, r.vehicle_year, r.vehicle_color, r.vehicle_plate,
                           r.created_at, r.updated_at, d.full_name as driver_name, m.full_name as mechanic_name
                    from public.rescue_requests r
                    left join public.profiles d on d.id = r.driver_id
                    left join public.profiles m on m.id = r.mechanic_id
                    where (? = false or exists (
                        select 1 from public.issue_reports ir where ir.request_id = r.id
                    ))
                    order by r.created_at desc limit ? offset ?
                    """, flagged, safeLimit, safeOffset);
        } else {
            rows = jdbc.queryForList("""
                    select r.id, r.driver_id, r.mechanic_id, r.status::text as status, r.service_type,
                           r.problem_description, r.incident_address, st_asgeojson(r.incident_location) as incident_location,
                           r.vehicle_make, r.vehicle_model, r.vehicle_year, r.vehicle_color, r.vehicle_plate,
                           r.created_at, r.updated_at, d.full_name as driver_name, m.full_name as mechanic_name
                    from public.rescue_requests r
                    left join public.profiles d on d.id = r.driver_id
                    left join public.profiles m on m.id = r.mechanic_id
                    where r.status::text = ?
                      and (? = false or exists (select 1 from public.issue_reports ir where ir.request_id = r.id))
                    order by r.created_at desc limit ? offset ?
                    """, status, flagged, safeLimit, safeOffset);
        }
        return Map.of("requests", rows);
    }

    public Map<String, Object> users(AppPrincipal user, String role, int limit, int offset) {
        access.requireRole(user, "admin");
        int safeLimit = Math.max(1, Math.min(limit, 1000));
        int safeOffset = Math.max(0, offset);
        List<Map<String, Object>> rows;
        String select = """
                select p.id, p.email, p.full_name, p.role::text as role, p.phone, p.avatar_url,
                       p.is_active, p.is_flagged, p.issue_flag_count, p.cancellation_count,
                       p.is_suspended, p.suspended_at, p.suspension_reason, p.created_at,
                       case when mp.user_id is null then null else json_build_object(
                           'business_name', mp.business_name, 'rating_avg', mp.rating_avg,
                           'years_experience', mp.years_experience, 'specializations', mp.specializations,
                           'verification_status', mp.verification_status) end as mechanic_profile,
                       case when dp.user_id is null then null else json_build_object(
                           'vehicle_make', dp.vehicle_make, 'vehicle_model', dp.vehicle_model,
                           'vehicle_color', dp.vehicle_color, 'vehicle_year', dp.vehicle_year,
                           'vehicle_plate', dp.vehicle_plate, 'emergency_contact_name', dp.emergency_contact_name,
                           'emergency_contact_phone', dp.emergency_contact_phone) end as driver_profile
                from public.profiles p
                left join public.mechanic_profiles mp on mp.user_id = p.id
                left join public.driver_profiles dp on dp.user_id = p.id
                """;
        if (role == null || role.isBlank()) {
            rows = jdbc.queryForList(select + " order by p.created_at desc limit ? offset ?", safeLimit, safeOffset);
        } else {
            rows = jdbc.queryForList(select + " where p.role::text = ? order by p.created_at desc limit ? offset ?",
                    role, safeLimit, safeOffset);
        }
        return Map.of("users", rows);
    }

    public Map<String, Object> mechanics(AppPrincipal user, String status) {
        access.requireRole(user, "admin");
        List<Map<String, Object>> rows;
        if (status == null || status.isBlank()) {
            rows = jdbc.queryForList("""
                    select mp.*, p.full_name, p.email, p.phone
                    from public.mechanic_profiles mp join public.profiles p on p.id = mp.user_id
                    order by mp.created_at desc limit 250
                    """);
        } else {
            String normalized = normalizeVerificationStatus(status);
            rows = jdbc.queryForList("""
                    select mp.*, p.full_name, p.email, p.phone
                    from public.mechanic_profiles mp join public.profiles p on p.id = mp.user_id
                    where mp.verification_status::text = ? order by mp.created_at desc limit 250
                    """, normalized);
        }
        return Map.of("mechanics", rows);
    }

    @Transactional
    public Map<String, Object> verifyMechanic(AppPrincipal user, Map<String, Object> body) {
        access.requireRole(user, "admin");
        UUID mechanicId = uuid(body.get("mechanicUserId"), "mechanicUserId");
        String requestedStatus = string(body.get("newStatus"));
        if (requestedStatus == null) throw ApiException.badRequest("newStatus is required.");
        String status = normalizeVerificationStatus(requestedStatus);
        if (!List.of("approved", "pending", "rejected").contains(status)) {
            throw ApiException.badRequest("Invalid mechanic verification status.");
        }
        String reason = string(body.get("reason"));
        if (status.equals("rejected") && (reason == null || reason.isBlank())) {
            throw ApiException.badRequest("A reason is required when rejecting a mechanic application.");
        }
        List<Map<String, Object>> found = jdbc.queryForList("""
                select user_id from public.mechanic_profiles where user_id = ? for update
                """, mechanicId);
        if (found.isEmpty()) throw ApiException.notFound("Mechanic profile not found.");
        jdbc.update("""
                update public.mechanic_profiles set verification_status = ?::public.verification_status,
                    is_available = case when ? = 'approved' then is_available else false end
                where user_id = ?
                """, status, status, mechanicId);
        int updated = jdbc.update("""
                update public.mechanic_verifications
                set status = ?::public.verification_status, reviewed_by = ?, reviewed_at = now(), notes = ?
                where mechanic_id = ?
                """, status, user.id(), reason, mechanicId);
        if (updated == 0) {
            jdbc.update("""
                    insert into public.mechanic_verifications (mechanic_id, status, reviewed_by, reviewed_at, notes)
                    values (?, ?::public.verification_status, ?, now(), ?)
                    """, mechanicId, status, user.id(), reason);
        }
        if (status.equals("rejected")) {
            jdbc.update("""
                    update public.profiles set is_suspended = true, suspended_at = now(),
                        suspension_reason = ? where id = ?
                    """, reason, mechanicId);
            jdbc.update("""
                    insert into public.account_moderation_log (user_id, action, reason, actor)
                    values (?, 'suspended', ?, ?)
                    """, mechanicId, reason, user.id().toString());
        } else if (status.equals("approved")) {
            jdbc.update("""
                    insert into public.notifications (profile_id, type, title, body, is_read)
                    values (?, 'verification'::public.notification_type, 'Profile verified',
                            'Your mechanic profile has been verified.', false)
                    """, mechanicId);
        }
        jdbc.update("""
                insert into public.notifications (profile_id, type, title, body, is_read)
                values (?, 'verification'::public.notification_type, ?, ?, false)
                """, mechanicId,
                status.equals("rejected") ? "Profile registration rejected" : "Additional information required",
                status.equals("rejected")
                        ? "Your mechanic profile was rejected. Your account has been disabled."
                        : "Please provide additional information for your verification to proceed.");
        return Map.of("success", true, "mechanicUserId", mechanicId, "status", status);
    }

    @Transactional
    public Map<String, Object> suspendUser(AppPrincipal user, Map<String, Object> body) {
        access.requireRole(user, "admin");
        UUID targetId = uuid(body.get("userId"), "userId");
        if (user.id().equals(targetId)) throw ApiException.badRequest("Administrators cannot suspend their own account.");
        String reason = string(body.get("reason"));
        if (reason == null) reason = "Account access disabled by an administrator.";
        int updated = jdbc.update("""
                update public.profiles set is_suspended = true, suspended_at = now(), suspension_reason = ?
                where id = ? and is_suspended = false
                """, reason, targetId);
        if (updated == 0) throw ApiException.notFound("User not found or already suspended.");
        jdbc.update("""
                insert into public.account_moderation_log (user_id, action, reason, actor)
                values (?, 'suspended', ?, ?)
                """, targetId, reason, user.id().toString());
        return Map.of("success", true);
    }

    @Transactional
    public Map<String, Object> updateIncident(AppPrincipal user, Map<String, Object> body) {
        access.requireRole(user, "admin");
        UUID incidentId = uuid(body.get("incidentId"), "incidentId");
        String status = string(body.get("status"));
        if (status == null || !List.of("OPEN", "IN_REVIEW", "RESOLVED", "REJECTED").contains(status)) {
            throw ApiException.badRequest("Invalid incident status.");
        }
        List<Map<String, Object>> rows = jdbc.queryForList("""
                select id, status::text as status from public.incident_reports where id = ? for update
                """, incidentId);
        if (rows.isEmpty()) throw ApiException.notFound("Incident not found.");
        String current = String.valueOf(rows.get(0).get("status"));
        boolean allowed = current.equals("OPEN") && status.equals("IN_REVIEW")
                || (current.equals("OPEN") || current.equals("IN_REVIEW")) && status.equals("REJECTED")
                || current.equals("IN_REVIEW") && status.equals("RESOLVED");
        if (!allowed) throw ApiException.badRequest("Invalid incident status transition from " + current + " to " + status + ".");
        String notes = string(body.get("reviewNotes"));
        Map<String, Object> incident = jdbc.queryForMap("""
                update public.incident_reports set status = ?::public.incident_status,
                    resolution_notes = coalesce(?, resolution_notes), assigned_admin_id = ?,
                    resolved_at = case when ? in ('RESOLVED', 'REJECTED') then now() else resolved_at end
                where id = ?
                returning id, request_id, job_id, reporter_id, subject_user_id, category, description,
                          status, assigned_admin_id, resolution_notes, created_at, updated_at, resolved_at
                """, status, notes, user.id(), status, incidentId);
        return Map.of("incident", incident);
    }

    public Map<String, Object> moderation(AppPrincipal user) {
        access.requireRole(user, "admin");
        List<Map<String, Object>> profiles = jdbc.queryForList("""
                select id, email, full_name, role::text as role, avatar_url, issue_flag_count, is_flagged,
                       cancellation_count, is_suspended, suspended_at, suspension_reason, created_at
                from public.profiles
                where is_flagged or is_suspended or issue_flag_count > 0 or cancellation_count > 0
                order by suspended_at desc nulls last, issue_flag_count desc
                """);
        List<Map<String, Object>> logs = jdbc.queryForList("""
                select l.id, l.user_id, l.action, l.reason, l.actor, l.created_at,
                       json_build_object('id', p.id, 'full_name', p.full_name, 'email', p.email,
                                         'role', p.role::text) as user
                from public.account_moderation_log l left join public.profiles p on p.id = l.user_id
                order by l.created_at desc limit 100
                """);
        return Map.of("profiles", profiles, "logs", logs);
    }

    private String normalizeVerificationStatus(String status) {
        return switch (status) {
            case "verified", "approve", "approved" -> "approved";
            case "more_info", "pending" -> "pending";
            case "rejected" -> "rejected";
            default -> status;
        };
    }

    private UUID uuid(Object value, String field) {
        try {
            return UUID.fromString(String.valueOf(value));
        } catch (RuntimeException exception) {
            throw ApiException.badRequest(field + " must be a valid UUID.");
        }
    }

    private String string(Object value) {
        if (!(value instanceof String text)) return null;
        String trimmed = text.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
