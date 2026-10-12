package com.rescueride.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rescueride.dto.RescueRequestCreate;
import com.rescueride.exception.ApiException;
import com.rescueride.security.AppPrincipal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.math.BigDecimal;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RescueRequestService {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final List<String> STATUSES =
            List.of("pending", "accepted", "en_route", "arrived", "in_progress", "completed", "cancelled");
    private static final Map<String, List<String>> TRANSITIONS = Map.of(
            "pending", List.of("accepted", "cancelled"),
            "accepted", List.of("en_route", "cancelled"),
            "en_route", List.of("arrived", "cancelled"),
            "arrived", List.of("in_progress", "cancelled"),
            "in_progress", List.of("completed", "cancelled"),
            "completed", List.of(),
            "cancelled", List.of());

    private final JdbcTemplate jdbc;
    private final AccessControlService access;

    public RescueRequestService(JdbcTemplate jdbc, AccessControlService access) {
        this.jdbc = jdbc;
        this.access = access;
    }

    public Map<String, Object> list(AppPrincipal user, UUID requestId) {
        access.requireRole(user, "driver");
        if (requestId != null) return Map.of("request", ownedRequest(user.id(), requestId));
        List<Map<String, Object>> requests = jdbc.queryForList("""
                select id, status, service_type, problem_description, incident_address,
                       vehicle_make, vehicle_model, vehicle_year, vehicle_color, vehicle_plate,
                       mechanic_id, created_at, updated_at
                from public.rescue_requests
                where driver_id = ?
                order by created_at desc
                limit 50
                """, user.id());
        return Map.of("requests", requests);
    }

    public Map<String, Object> detail(AppPrincipal user, UUID requestId) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                select r.id, r.driver_id, r.mechanic_id, r.status::text as status, r.service_type,
                       r.problem_description, r.incident_address, r.incident_lat, r.incident_lng,
                       r.vehicle_make, r.vehicle_model, r.vehicle_year, r.vehicle_color, r.vehicle_plate,
                       r.created_at, r.updated_at,
                       json_build_object('id', d.id, 'full_name', d.full_name, 'phone', d.phone) as driver,
                       case when mp.user_id is null then null else json_build_object(
                           'user_id', mp.user_id, 'business_name', mp.business_name,
                           'rating_avg', mp.rating_avg, 'is_available', mp.is_available) end as mechanic
                from public.rescue_requests r
                join public.profiles d on d.id = r.driver_id
                left join public.mechanic_profiles mp on mp.user_id = r.mechanic_id
                where r.id = ?
                """, requestId);
        if (rows.isEmpty()) throw ApiException.notFound("Request not found.");
        Map<String, Object> request = rows.get(0);
        boolean isDriver = user.id().equals(request.get("driver_id"));
        boolean isMechanic = user.id().equals(request.get("mechanic_id"));
        boolean isEligibleMechanic = false;
        if (user.role().equals("mechanic") && request.get("mechanic_id") == null
                && "pending".equals(request.get("status"))) {
            Integer approved = jdbc.queryForObject("""
                    select count(*) from public.mechanic_profiles
                    where user_id = ? and verification_status::text = 'approved'
                    """, Integer.class, user.id());
            isEligibleMechanic = approved != null && approved > 0;
        }
        if (!isDriver && !isMechanic && !isEligibleMechanic && !user.role().equals("admin")) {
            throw ApiException.forbidden("Not authorized to view this request.");
        }
        return Map.of("request", request);
    }

    public Map<String, Object> mechanicRequests(AppPrincipal user, String view) {
        access.requireRole(user, "mechanic");
        String filter = switch (view == null ? "requests" : view) {
            case "requests" -> "r.status = 'pending'::public.request_status and (r.mechanic_id is null or r.mechanic_id = ?)";
            case "jobs", "overview" -> "r.mechanic_id = ? and r.status in ('accepted','en_route','arrived','in_progress')";
            case "history" -> "r.mechanic_id = ? and r.status in ('completed','cancelled')";
            default -> throw ApiException.badRequest("Unknown mechanic request view.");
        };
        List<Map<String, Object>> requests = jdbc.queryForList("""
                select r.id, r.status::text as status, r.service_type, r.problem_description,
                       r.incident_address, r.created_at, r.mechanic_id, r.driver_id,
                       r.vehicle_make, r.vehicle_model, r.vehicle_plate
                from public.rescue_requests r
                where """ + filter + " order by r.created_at desc limit 100", user.id());
        return Map.of("requests", requests);
    }

    @Transactional
    public Map<String, Object> create(AppPrincipal user, RescueRequestCreate request) {
        access.requireRole(user, "driver");
        if (request.serviceType().isBlank()) throw ApiException.badRequest("serviceType is required.");

        jdbc.queryForObject("select id from public.profiles where id = ? for update", UUID.class, user.id());
        Integer active = jdbc.queryForObject("""
                select count(*) from public.rescue_requests
                where driver_id = ? and status in ('pending', 'accepted', 'en_route', 'arrived', 'in_progress')
                """, Integer.class, user.id());
        if (active != null && active > 0) {
            throw ApiException.conflict("You already have an active roadside assistance request.");
        }
        Integer recent = jdbc.queryForObject("""
                select count(*) from public.rescue_requests
                where driver_id = ? and created_at > now() - interval '1 hour'
                """, Integer.class, user.id());
        if (recent != null && recent >= 3) {
            throw new ApiException(org.springframework.http.HttpStatus.TOO_MANY_REQUESTS,
                    "Maximum request threshold exceeded. Please try again later.");
        }

        UUID mechanicId = parseOptionalId(request.targetMechanicId(), "targetMechanicId");
        if (mechanicId != null) {
            List<Map<String, Object>> matchingMechanics = jdbc.queryForList("""
                    select user_id from public.mechanic_profiles
                    where user_id = ? and verification_status::text = 'approved' and is_available = true
                    for update
                    """, mechanicId);
            if (matchingMechanics.isEmpty()) {
                throw ApiException.conflict("Selected mechanic is not verified or currently available.");
            }
        }

        Map<String, Object> saved = jdbc.queryForMap("""
                insert into public.rescue_requests
                    (driver_id, mechanic_id, status, service_type, problem_description, incident_address,
                     incident_location, incident_lat, incident_lng, vehicle_make, vehicle_model,
                     vehicle_year, vehicle_color, vehicle_plate, vehicle_image_url)
                values (?, ?, 'pending'::public.request_status, ?, ?, ?, 
                        st_setsrid(st_makepoint(?, ?), 4326), ?, ?, ?, ?, ?, ?, ?, ?)
                returning id, driver_id, mechanic_id, status, service_type, problem_description,
                          incident_address, vehicle_make, vehicle_model, vehicle_year, vehicle_color,
                          vehicle_plate, created_at, updated_at
                """, user.id(), mechanicId, request.serviceType().trim(),
                request.problemDescription().trim(), safe(request.incidentAddress()),
                request.incidentLng(), request.incidentLat(), request.incidentLat(), request.incidentLng(),
                safe(request.vehicleMake()), safe(request.vehicleModel()), request.vehicleYear(),
                safe(request.vehicleColor()), safe(request.vehiclePlate()), request.vehicleImageUrl());

        if (mechanicId != null) {
            jdbc.update("""
                    update public.mechanic_profiles
                    set is_available = false, current_status = 'dispatched'
                    where user_id = ?
                    """, mechanicId);
        }
        UUID requestId = (UUID) saved.get("id");
        List<UUID> recipients = mechanicId == null
                ? jdbc.query("""
                        select user_id from public.get_nearby_verified_mechanics(?, ?, 10.0)
                        """, (rs, row) -> rs.getObject("user_id", UUID.class), request.incidentLat(), request.incidentLng())
                : List.of(mechanicId);
        for (UUID recipient : recipients) {
            jdbc.update("""
                    insert into public.notifications (profile_id, request_id, title, body, type, is_read)
                    values (?, ?, ?, ?, 'request'::public.notification_type, false)
                    """, recipient, requestId, mechanicId == null ? "New rescue request" : "Direct rescue request",
                    "New " + request.serviceType().trim() + " request — "
                            + (safe(request.incidentAddress()).isBlank() ? "location pinned" : safe(request.incidentAddress())));
        }
        return Map.of("request", saved, "notifiedCount", recipients.size());
    }

    public Map<String, Object> nearbyMechanics(AppPrincipal user, Double latitude, Double longitude) {
        access.requireRole(user, "driver");
        if (latitude == null || longitude == null) {
            return Map.of("mechanics", jdbc.queryForList("""
                    select user_id, business_name, specializations, rating_avg, rating_count, location_label
                    from public.mechanic_profiles
                    where verification_status::text = 'approved' and is_available = true
                    order by business_name
                    limit 50
                    """));
        }
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            throw ApiException.badRequest("Coordinates are outside the valid latitude/longitude range.");
        }
        return Map.of("mechanics", jdbc.queryForList("""
                select mp.user_id, mp.business_name, mp.specializations, mp.rating_avg,
                       mp.rating_count, mp.location_label, nearby.distance_km
                from public.get_nearby_verified_mechanics(?, ?, 10.0) nearby
                join public.mechanic_profiles mp on mp.user_id = nearby.user_id
                order by nearby.distance_km
                limit 50
                """, latitude, longitude));
    }

    @Transactional
    public Map<String, Object> updateStatus(AppPrincipal user, Map<String, Object> body) {
        UUID requestId = parseRequiredId(body.get("requestId"), "requestId");
        String newStatus = firstString(body, "newStatus", "status");
        if (!STATUSES.contains(newStatus)) throw ApiException.badRequest("Invalid request status.");

        Map<String, Object> request = lockRequest(requestId);
        String oldStatus = String.valueOf(request.get("status"));
        UUID driverId = (UUID) request.get("driver_id");
        UUID mechanicId = (UUID) request.get("mechanic_id");
        access.requireRole(user, "driver", "mechanic", "admin");

        if (user.role().equals("driver") && (!user.id().equals(driverId) || !newStatus.equals("cancelled"))) {
            throw ApiException.forbidden("Drivers may only cancel their own requests.");
        }
        if (user.role().equals("mechanic")) {
            if (!newStatus.equals("accepted")
                    && !List.of("en_route", "arrived", "in_progress", "completed", "cancelled").contains(newStatus)) {
                throw ApiException.forbidden("Mechanics may only accept or progress an assigned request.");
            }
            if (!user.id().equals(mechanicId) && !(mechanicId == null && oldStatus.equals("pending") && newStatus.equals("accepted"))) {
                throw ApiException.forbidden("This request is assigned to another mechanic.");
            }
            if (mechanicId == null) {
                List<Map<String, Object>> mechanic = jdbc.queryForList("""
                        select verification_status::text as verification_status, is_available
                        from public.mechanic_profiles where user_id = ? for update
                        """, user.id());
                if (mechanic.isEmpty() || !"approved".equals(mechanic.get(0).get("verification_status"))) {
                    throw ApiException.forbidden("Mechanic approval is required.");
                }
                if (!Boolean.TRUE.equals(mechanic.get(0).get("is_available"))) {
                    throw ApiException.conflict("Mechanic is currently unavailable.");
                }
                int assigned = jdbc.update("""
                        update public.rescue_requests set mechanic_id = ?
                        where id = ? and mechanic_id is null and status = 'pending'::public.request_status
                        """, user.id(), requestId);
                if (assigned == 0) throw ApiException.conflict("Request has already been accepted by another mechanic.");
                mechanicId = user.id();
            }
        }
        if (!TRANSITIONS.getOrDefault(oldStatus, List.of()).contains(newStatus)) {
            throw ApiException.conflict("Invalid status transition from " + oldStatus + " to " + newStatus + ".");
        }

        String reason = firstString(body, "reason", "cancellationReason", "cancellation_reason");
        if (newStatus.equals("cancelled") && reason != null && !reason.startsWith("user:") && !reason.startsWith("system_timeout:")) {
            reason = "user: " + reason;
        }
        String completionNotes = firstString(body, "completionNotes", "completion_notes");
        Object performedServices = body.containsKey("performedServices")
                ? body.get("performedServices") : body.get("performed_services");
        String performedServicesJson = null;
        if (performedServices != null) {
            if (!(performedServices instanceof List<?> values) || values.size() > 50) {
                throw ApiException.badRequest("performedServices must be a list of no more than 50 entries.");
            }
            try {
                performedServicesJson = JSON.writeValueAsString(performedServices);
            } catch (JsonProcessingException exception) {
                throw ApiException.badRequest("performedServices contains invalid JSON values.");
            }
        }
        jdbc.update("""
                update public.rescue_requests
                set status = ?::public.request_status,
                    mechanic_id = coalesce(mechanic_id, ?),
                    cancelled_by = case when ? = 'cancelled' then ? else cancelled_by end,
                    cancellation_reason = case when ? = 'cancelled' then ? else cancellation_reason end,
                    completion_notes = case when ? = 'completed' then ? else completion_notes end,
                    performed_services = case when ? = 'completed'
                        then coalesce(?::jsonb, performed_services) else performed_services end
                where id = ?
                """, newStatus, mechanicId, newStatus, user.id(), newStatus, reason,
                newStatus, completionNotes, newStatus, performedServicesJson, requestId);

        if (mechanicId != null && newStatus.equals("accepted")) {
            jdbc.update("""
                    update public.mechanic_profiles set is_available = false, current_status = 'on_job'
                    where user_id = ?
                    """, mechanicId);
        }
        if (mechanicId != null && List.of("completed", "cancelled").contains(newStatus)) {
            jdbc.update("""
                    update public.mechanic_profiles set is_available = true, current_status = 'online'
                    where user_id = ?
                    """, mechanicId);
        }
        return Map.of("success", true, "request", ownedOrParticipant(requestId));
    }

    @Transactional
    public Map<String, Object> rate(AppPrincipal user, Map<String, Object> body) {
        access.requireRole(user, "driver");
        UUID requestId = parseRequiredId(body.get("requestId"), "requestId");
        Object rawRating = body.get("rating");
        if (!(rawRating instanceof Number number) || number.intValue() < 1 || number.intValue() > 5) {
            throw ApiException.badRequest("Rating must be between 1 and 5.");
        }
        Map<String, Object> request = lockRequest(requestId);
        if (!user.id().equals(request.get("driver_id"))) throw ApiException.forbidden("Not authorized to review this request.");
        if (!"completed".equals(request.get("status"))) throw ApiException.conflict("Only completed requests can be reviewed.");
        UUID mechanicId = (UUID) request.get("mechanic_id");
        if (mechanicId == null) throw ApiException.conflict("This request has no assigned mechanic to review.");
        Integer existing = jdbc.queryForObject("""
                select count(*) from public.request_reviews where request_id = ? and driver_id = ?
                """, Integer.class, requestId, user.id());
        if (existing != null && existing > 0) throw ApiException.conflict("This request has already been reviewed.");
        String review = firstString(body, "review");
        Map<String, Object> saved = jdbc.queryForMap("""
                insert into public.request_reviews (request_id, driver_id, mechanic_id, rating, review)
                values (?, ?, ?, ?, ?)
                returning id, request_id, driver_id, mechanic_id, rating, review, created_at
                """, requestId, user.id(), mechanicId, number.intValue(), review);
        BigDecimal average = jdbc.queryForObject("""
                select coalesce(round(avg(rating)::numeric, 2), 0)
                from public.request_reviews where mechanic_id = ?
                """, BigDecimal.class, mechanicId);
        Integer ratingCount = jdbc.queryForObject("""
                select count(*) from public.request_reviews where mechanic_id = ?
                """, Integer.class, mechanicId);
        jdbc.update("""
                update public.mechanic_profiles set rating_avg = ?, rating_count = ?
                where user_id = ?
                """, average, ratingCount, mechanicId);
        jdbc.update("""
                insert into public.notifications (profile_id, request_id, title, body, type, is_read)
                values (?, ?, 'Rating submitted', ?, 'system'::public.notification_type, false)
                """, user.id(), requestId, "Your " + number.intValue() + "-star service review was recorded.");
        return Map.of("success", true, "newAvgRating", average, "review", saved);
    }

    public List<Map<String, Object>> messages(AppPrincipal user, UUID requestId) {
        participantRequest(user, requestId);
        return jdbc.queryForList("""
                select id, sender_id, message, created_at from public.messages
                where request_id = ? order by created_at asc
                """, requestId);
    }

    public Map<String, Object> messageThread(AppPrincipal user, UUID requestId) {
        Map<String, Object> request = participantRequest(user, requestId);
        Map<String, Object> thread = new java.util.LinkedHashMap<>();
        thread.put("messages", jdbc.queryForList("""
                select id, sender_id, message, created_at from public.messages
                where request_id = ? order by created_at asc
                """, requestId));
        thread.put("requestStatus", request.get("status"));
        thread.put("driverId", request.get("driver_id"));
        thread.put("mechanicId", request.get("mechanic_id"));
        return thread;
    }

    @Transactional
    public Map<String, Object> sendMessage(AppPrincipal user, UUID requestId, String message) {
        Map<String, Object> request = participantRequest(user, requestId);
        String status = String.valueOf(request.get("status"));
        if (List.of("completed", "cancelled").contains(status)) {
            throw ApiException.badRequest("Cannot send messages on a " + status + " request.");
        }
        if (message == null || message.isBlank() || message.length() > 1000) {
            throw ApiException.badRequest("Message must contain 1 to 1000 characters.");
        }
        Map<String, Object> saved = jdbc.queryForMap("""
                insert into public.messages (request_id, sender_id, message)
                values (?, ?, ?)
                returning id, request_id, sender_id, message, created_at
                """, requestId, user.id(), message.trim());
        return Map.of("message", saved);
    }

    private Map<String, Object> ownedRequest(UUID driverId, UUID requestId) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                select id, status, service_type, problem_description, incident_address,
                       vehicle_make, vehicle_model, vehicle_year, vehicle_color, vehicle_plate,
                       mechanic_id, created_at, updated_at
                from public.rescue_requests where id = ? and driver_id = ?
                """, requestId, driverId);
        if (rows.isEmpty()) throw ApiException.notFound("Request not found.");
        return rows.get(0);
    }

    private Map<String, Object> ownedOrParticipant(UUID requestId) {
        return jdbc.queryForMap("""
                select id, status::text as status, service_type, problem_description, incident_address,
                       vehicle_make, vehicle_model, vehicle_year, vehicle_color, vehicle_plate,
                       mechanic_id, created_at, updated_at
                from public.rescue_requests where id = ?
                """, requestId);
    }

    private Map<String, Object> participantRequest(AppPrincipal user, UUID requestId) {
        Map<String, Object> request = lockRequest(requestId);
        if (!user.id().equals(request.get("driver_id")) && !user.id().equals(request.get("mechanic_id"))) {
            throw ApiException.forbidden("Not authorized to access this request.");
        }
        return request;
    }

    private Map<String, Object> lockRequest(UUID requestId) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                select id, driver_id, mechanic_id, status::text as status
                from public.rescue_requests where id = ? for update
                """, requestId);
        if (rows.isEmpty()) throw ApiException.notFound("Request not found.");
        return rows.get(0);
    }

    private UUID parseOptionalId(String value, String field) {
        return value == null || value.isBlank() ? null : parseRequiredId(value, field);
    }

    private UUID parseRequiredId(Object value, String field) {
        try {
            return UUID.fromString(String.valueOf(value));
        } catch (RuntimeException exception) {
            throw ApiException.badRequest(field + " must be a valid UUID.");
        }
    }

    private String firstString(Map<String, Object> body, String... keys) {
        for (String key : keys) {
            Object value = body.get(key);
            if (value instanceof String text && !text.isBlank()) return text.trim();
        }
        return null;
    }

    private String safe(String value) { return value == null ? "" : value.trim(); }
}
