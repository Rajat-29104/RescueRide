# RoadRescue — Web app (Developer README)

This README covers local development and a few recent developer-facing changes specific to the web application.

Quick start

1. Install dependencies
```bash
cd web
npm install
```

2. Configure local PostgreSQL
Create `.env.local` in `web/` with your local database connection and any AI key you use:
```
DATABASE_URL=postgresql://postgres:<your-password>@localhost:5432/roadrescue
GEMINI_API_KEY=your_gemini_key
```

Run the local schema migrations and verify the database:
```bash
npm run db:migrate
npm run db:check
```

Email/password registration, login, sessions, and logout now use local PostgreSQL. The rest of the app's data access, realtime, and file storage are still being migrated; do not remove the existing Supabase configuration or packages until those integrations have also been replaced.

3. Run locally
```bash
npm run dev
```

Build
```bash
npm run build
```

Developer notes (recent)
- Local auth: signup, password login, session validation, logout, password reset, and role checks use PostgreSQL-backed profiles and sessions.
- Login/Register gating: login requires a DB-backed role before routing into role dashboards.
- Mechanic Go Online/Offline status and browser location updates use the local PostgreSQL APIs; allow browser location access while online for nearby request matching.
- Sign-out: uses client-side navigation (`router.replace('/auth/login')`) to avoid full reloads.
- Profile preferences API: `/api/profile/preferences` provides GET/PUT endpoints for user theme, language, notification, and communication preferences.
- Mechanic account page: provides comprehensive profile editing including avatar upload, business details, specializations, service radius, hourly rate, license info, and preference toggles.

Files to check when changing behavior
- `src/providers/AuthProvider.jsx`
- `src/lib/auth.js`
- `src/components/layout/Navbar.jsx`
- `src/components/layout/Sidebar.jsx`
- `src/components/layout/Notifications.jsx`
- `src/app/dashboard/mechanic/account/page.jsx`
- `src/app/api/profile/preferences/route.js`

If you change any of the above flows, please update this README and [docs/DEVELOPER_NOTES.md](../docs/DEVELOPER_NOTES.md).
