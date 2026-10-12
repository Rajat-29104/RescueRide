# RescueRide API server

`web/` contains the existing Next.js API routes and server-side integrations. The user interface is served from the sibling `frontend/` app.

## Local development

Configure `web/.env.local` with:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Keep the service-role key on the server and do not commit credentials.

Install dependencies with `npm ci`, then start the API server on port 3001:

```bash
npm run dev -- --port 3001
```

In a second terminal, configure `frontend/.env.local` with the same public Supabase URL and anon key, plus:

```env
RESCUERIDE_BACKEND_URL=http://localhost:3001
```

Install the frontend dependencies with `npm ci` from `frontend/`, then start its development server on port 3000:

```bash
npm run dev
```

Open `http://localhost:3000`. Both servers must be running. Backend operations requiring Supabase will fail until the public Supabase variables and the required server-side service-role key are configured.
