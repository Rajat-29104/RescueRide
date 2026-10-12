# Module 4 — Real-Time Assistance & Safety

## Purpose
This module is the live coordination and safety layer for RescueRide. It covers:
- live mechanic location tracking
- driver–mechanic chat
- persistent notifications
- emergency contacts and SOS escalation
- incident and safety reporting

## Architecture discovered in the repository
The existing RescueRide codebase is not a Java/Spring Boot service. It uses:
- Next.js 16 App Router for frontend + API layer
- Supabase PostgreSQL as the data store
- Row-level security (RLS) and PostgreSQL policies
- server-side route handlers under `web/src/app/api`
- browser geolocation + Leaflet + OpenStreetMap for map features
- webhook / real-time / Supabase channels for live updates

This means the correct backend design for Module 4 is to extend the current project architecture rather than invent a separate Java backend. The module should therefore be implemented as server actions / route handlers and Postgres tables, using the repo’s existing auth and request/job models.

## Backend design summary

### 1) Live mechanic tracking
- `job_locations` stores the latest location for an assignment.
- Only the assigned mechanic may update the row for a given job.
- Driver and assigned mechanic can fetch real-time location data.
- The route enforces `request.status` and assignment ownership before accepting location updates.
- A stale warning is calculated on the backend as: last update older than 90 seconds or 3x the configured heartbeat interval.
- Final states (`completed`, `cancelled`, `closed`) reject new entry updates.

### 2) Driver–mechanic chat
- `job_messages` stores job-scoped messages with `job_id`, `sender_id`, `message`, `created_at`, `status`.
- Messages are persisted before reporting success.
- Authorised access is limited to the driver, assigned mechanic, and admin users with explicit permission.
- The app can use Supabase realtime channels or polling fallback; the message model stays the same.
- Completed job conversations become read-only in the API layer.

### 3) Notifications
- `notifications` table stores persistent user notifications and their read state.
- Notification types include: mechanic_accepted, mechanic_en_route, mechanic_arrived, diagnosis_started, repair_started, job_completed, job_cancelled, quote_accepted, quote_rejected, sos_acknowledged, sos_resolved.
- Duplicate delivery is prevented with a unique composite index on recipient + related entity + event type + delivered key.
- Notifications are readable after refresh/logout because they are stored in PostgreSQL.

### 4) Emergency contacts and SOS
- `emergency_contacts` is a per-driver table storing name, relationship, phone.
- `sos_events` stores a single, auditable SOS lifecycle.
- Lifecycle: `RAISED -> ACKNOWLEDGED -> RESOLVED`
- `sos_event_history` captures state transitions for auditability.
- The route validates duplicate prevention and stores the event before returning success.
- A driver can still raise SOS without coordinates if geolocation is unavailable.

### 5) Incident and safety reports
- `incident_reports` stores category, description, request/job relation, reporter, status, admin assignment, resolution notes.
- Admin can view and resolve incidents but only authorized actors can access them.

## Reusable repository integrations
The Module 4 backend should integrate with these current project concepts:
- `rescue_requests` table / request lifecycle states
- `profiles` and `driver_profiles` / `mechanic_profiles`
- `request_status_history` and `messages` table already present in the architecture sheet
- existing notification flow under `web/src/lib` and `web/src/app/api/notifications`
- existing auth and role guards in `web/src/lib/rbac.js`
- map and geolocation hooks already in `web/src/hooks` / `web/src/components/map`

## Proposed API surface
The repository already follows route-based server APIs. The module should fit this pattern:

- `POST /api/jobs/[id]/location`
- `GET /api/jobs/[id]/location/latest`
- `GET /api/jobs/[id]/messages`
- `POST /api/jobs/[id]/messages`
- `GET /api/notifications`
- `PATCH /api/notifications/[id]/read`
- `GET /api/emergency-contacts`
- `POST /api/emergency-contacts`
- `PUT /api/emergency-contacts/[id]`
- `DELETE /api/emergency-contacts/[id]`
- `POST /api/sos`
- `GET /api/sos/[id]`
- `GET /api/admin/sos`
- `PATCH /api/admin/sos/[id]/acknowledge`
- `PATCH /api/admin/sos/[id]/resolve`
- `POST /api/incidents`
- `GET /api/incidents/mine`
- `GET /api/admin/incidents`
- `PATCH /api/admin/incidents/[id]`

## Security model
- Use `auth.getUser()` for every protected route.
- Validate `driver_id` / `mechanic_id` from authenticated session, never trust frontend-supplied user IDs.
- Check that the mechanic is assigned to the request job before accepting location updates.
- Restrict chat and location endpoints to request participants.
- Enforce admin access using existing RBAC utilities.
- Use Postgres constraints on latitude, longitude and state transitions.
- Do not expose exact coords to unrelated or public users.

## Database and realtime strategy
Because this repo already relies on Supabase Postgres and realtime, Module 4 should use:
- Postgres tables for persistence
- a Supabase Realtime channel like `job:{job_id}` for live message and notification delivery
- polling fallback if realtime is unavailable
- server-side deduplication and idempotency keys for SOS and notification creation

## Suggested schema footprint
Use the following entities:
- `job_locations`
- `job_messages`
- `notifications`
- `emergency_contacts`
- `sos_events`
- `sos_event_history`
- `incident_reports`

These tables must be added as migration files in the existing Supabase migrations pattern already used in the repository.

## Implementation plan
1. Extend the schema with Module 4 tables and indexes.
2. Add backend route handlers for chat, location, notifications, SOS, incidents.
3. Add RBAC checks and request/assignment validation.
4. Add transactional notification creation and duplicate protection.
5. Add Supabase realtime broadcast for job events and unread notifications.
6. Add frontend screens for driver and mechanic views with loading, empty, stale, permission-denied and reconnect states.
7. Add tests for authorization, duplicate prevention, persistence, and admin access.

## Known limitation in this repo
The repo currently contains a Next.js + Supabase implementation, not a Spring Boot/JPA backend. This module should therefore be implemented as a repository-native backend extension, not as a separate Java stack.

## Files in this folder
- `schema.sql` — PostgreSQL schema for Module 4
- `api-spec.md` — API contract and validation notes
