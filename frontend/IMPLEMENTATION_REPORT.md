# Standalone frontend implementation

## Application behavior

- Supabase login, registration, email confirmation, password recovery, and reset use the configured production project.
- Driver, mechanic, and admin dashboard routes require an authenticated account and verified role. Signing out clears the session and returns to sign-in.
- Driver flows use the Java API for assistance requests/history, provider lookup, vehicle CRUD, emergency contacts, request-linked SOS, profile preferences, identity-change requests, and incident reports. Notifications still use the authenticated Supabase browser client.
- Mechanics use the Java API for request queues, request details, job status transitions, messages, and mechanic profile/availability updates. Notifications still use the authenticated Supabase browser client.
- Admin pages use protected Java endpoints for statistics, user records, mechanic verification, requests, and incident/report review. Access is checked by the Java backend; frontend role checks are not treated as authorization.
- The same-origin proxy forwards only explicitly allowlisted API paths and supported HTTP methods to `RESCUERIDE_BACKEND_URL`, normally `http://localhost:8081` locally. It forwards the Supabase session cookie or Authorization header and does not expose database credentials.
- Supabase Auth remains the login provider. Java validates access tokens with Supabase Auth and resolves application roles and suspension state from PostgreSQL.

## Deployment requirements

See [the deployment setup](../docs/ENVIRONMENT_SETUP.md). The frontend and Java backend must use the same Supabase project. Java requires database connection variables and the public Supabase Auth key; live use also requires the reviewed migrations to be applied.

## API and product boundaries

- Search and provider selection include only providers returned by the authenticated, verified-and-available mechanic endpoint.
- Mechanic rejection requires a reason and disables access through the profile suspension field; it does not delete the Supabase Auth identity.
- User access remains read-only in this UI; the Java endpoint implements suspension but no user-deletion control is exposed.
- Help/support content is informational because the repository has no support-ticket API. Live maps, mechanic document upload, and status for pending profile-change requests are not presented as completed workflows.
- Backend/schema failures appear as errors; no sample service-provider lists, request counts, or fake successful actions are displayed.

## Validation performed

- `npm.cmd run lint` — passed.
- `npm.cmd run build` — passed; Next.js 16.2.6 compiled the active frontend and generated its routes.
- `mvn test` in `backend-spring/` — passed: 5 tests, 0 failures/errors, including Spring application-context startup against H2 and vehicle/request service tests.
- Live Supabase Auth/PostgreSQL requests were not run because this checkout has no local backend/frontend environment files or configured database credentials. The running local UI returned HTTP 200 on port 3000; the Java API was not started against a real database.

An authenticated end-to-end request was not submitted; that requires a test account, active backend configuration, and a migrated Supabase project.
