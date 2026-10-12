# Standalone frontend implementation

## Application behavior

- Supabase login, registration, email confirmation, password recovery, and reset use the configured production project.
- Driver, mechanic, and admin dashboard routes require an authenticated account and verified role. Signing out clears the session and returns to sign-in.
- Driver flows use real request submission/history, available-provider lookup, saved vehicle details, emergency contacts, request-linked SOS, notifications, preferences, and incident reports.
- Mechanics can review pending requests, accept work, progress job status, message request participants, review job history, and update profile/service-area availability.
- Admin pages use the protected backend endpoints for statistics, user records, mechanic verification, requests, and incident/report review. Access is checked again by backend APIs; the frontend role check is not treated as authorization.
- The same-origin proxy forwards only the frontend's explicitly allowlisted API paths and supported HTTP methods to `RESCUERIDE_BACKEND_URL`. It forwards the session cookie and never exposes the backend service-role key.
- Vehicle CRUD uses the authenticated same-origin backend proxy and the driver's ownership-checked API routes; the `driver_vehicles` migration must be applied to the connected Supabase project. Mechanic profiles use the authenticated Supabase browser client and rely on the project's Row Level Security policies.

## Deployment requirements

See [the deployment setup](../docs/ENVIRONMENT_SETUP.md). The frontend must use the same Supabase project as the deployed `web/` backend. Real dispatch and protected admin/provider lookup operations require the backend service-role secret and applied migrations. Keep that secret on the backend only.

## API and product boundaries

- Search and provider selection include only providers returned by the authenticated, verified-and-available mechanic endpoint.
- Mechanic rejection requires confirmation and a reason because the current backend rejection workflow may delete the mechanic's sign-in account.
- User access is read-only in this UI: the existing admin endpoint deletes accounts rather than providing a reversible suspend action, so no delete control is exposed.
- Help/support content is informational because the repository has no support-ticket API. Live maps, mechanic document upload, and status for pending profile-change requests are not presented as completed workflows.
- Backend/schema failures appear as errors; no sample service-provider lists, request counts, or fake successful actions are displayed.

## Validation performed

- `npm run lint` — passed.
- `npm run build` — passed.
- Browser check — an unauthenticated visit to `/dashboard/driver` redirects to `/auth/login`.

An authenticated end-to-end request was not submitted; that requires a test account, active backend configuration, and a migrated Supabase project.
