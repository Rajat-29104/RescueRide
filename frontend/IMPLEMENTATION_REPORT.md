# Frontend redesign implementation report

## What changed

- Replaced the former red/navy palette and large inline-style blocks with shared brand tokens, Inter typography, responsive layout rules, accessible focus states, reduced-motion handling, and restrained glass surfaces.
- Rebuilt the public landing page with an editorial hero, custom illustrative route map, product capabilities, workflow steps, and mechanic CTA. The map is explicitly illustrative; it does not imply live locations or response times.
- Added role-specific dashboard shells and navigation for driver, mechanic, and admin workspaces, including mobile bottom navigation.
- Reworked the three role dashboards to remove hard-coded requests, ratings, ETAs, user counts, percentages, and fake live status.
- Added route coverage for assistance requests, provider discovery, vehicles, safety, notifications, mechanic requests/jobs, and admin governance workspaces. Unknown routes render the app not-found state.
- Connected authentication and recovery forms to the shared Supabase project. Registration supports Driver or Mechanic roles; sign-in resolves the account role and opens the matching dashboard.

## Backend integration status and blockers

`frontend/` is an independent Next.js app. Authentication uses the same Supabase project as `web/`, while a same-origin, allowlisted backend proxy forwards the session cookie to the existing `web/` API.

Relevant existing contracts were reviewed:

- `web/src/app/api/requests/route.js` accepts authenticated driver POST requests and validates location coordinates and service type before inserting the request.
- `web/src/app/api/safety/sos/route.js` requires an authenticated driver, an existing request, ownership, and a valid SOS status transition.
- Admin and mechanic routes also depend on the `web/` app's Supabase session and role checks.

The driver request flow collects service type, problem, current browser location, address, optional vehicle details, and either automatic matching or a directly selected verified/available mechanic. It uses the authenticated request API, shows backend errors without claiming success, and displays request history/details from the driver-scoped API. The backend verifies mechanic availability again at submission time.

Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the frontend environment and `RESCUERIDE_BACKEND_URL` as the backend origin. The backend also requires `SUPABASE_SERVICE_ROLE_KEY` to perform provider verification and dispatch; keep that secret only in `web/.env.local` or the backend host's secret store, never in the frontend environment. Request creation also requires the hosted database migrations and dispatch functions to be applied. Verify these settings and database migrations before using real roadside requests.

## Verification

- `npm run build` — passed; all current static and dynamic routes compiled.
- `npm run lint` — passed with the ESLint 9 configuration for `app/` and `components/`.
- Route smoke tests returned HTTP 200 for login, registration, all three role overviews, driver assistance/vehicle/SOS routes, mechanic jobs, and admin incidents.
- Browser viewport checks at 360, 390, 768, 1024, 1440, and 1600 CSS pixels found no horizontal overflow on the landing page. The driver dashboard was also checked at these viewport sizes.

## Known scope boundary

The independent frontend has no sample providers, locations, metrics, or successful fake mutations. Real request submission requires an authenticated driver, a running/deployed backend with the service-role secret configured, and the matching database schema.
