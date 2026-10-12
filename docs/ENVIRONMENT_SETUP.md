# RescueRide deployment setup

RescueRide currently has two Next.js applications:

- `frontend/` is the standalone production UI. It provides Supabase authentication, role-protected driver/mechanic/admin workspaces, and a same-origin API proxy.
- `web/` is the existing backend and integrated application. Deploy it separately; the standalone UI forwards its allowlisted requests to this service.

## Local development

Create `web/.env.local` for the backend and `frontend/.env.local` for the standalone UI. Use the same Supabase project in both apps.

`frontend/.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-publishable-key
RESCUERIDE_BACKEND_URL=http://localhost:3000
```

`web/.env.local` must include:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret
```

Keep `SUPABASE_SERVICE_ROLE_KEY` only in the backend's environment or secret store. Never add it to `frontend/.env.local`, expose it as a `NEXT_PUBLIC_` variable, or commit it.

Run the backend and frontend in separate terminals:

```powershell
Set-Location E:\RescueRide\web
npm install
npm run dev
```

```powershell
Set-Location E:\RescueRide\frontend
npm install
npm run dev -- --port 3001
```

## Production deployment

Deploy `web/` as the backend service and `frontend/` as the UI service. For a Next.js host such as Vercel, set each application's root directory to its respective folder and use its existing `npm run build` command.

Configure these variables in the **frontend service**:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | The production Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | That project's publishable/anon key |
| `RESCUERIDE_BACKEND_URL` | The HTTPS origin of the deployed `web/` backend, without an `/api` suffix |

Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in the **backend service**. Add any other backend-only provider keys there, not in the frontend. Never use localhost as the production backend URL.

The auth redirect URL in Supabase must include the production frontend's `/auth/login` and `/auth/reset-password` URLs. Apply the repository's Supabase migrations to the same project before enabling request dispatch, safety, or incident workflows. Keep Row Level Security enabled; admin APIs additionally require the backend service-role key.

After configuring host variables, redeploy both services. Verify login and account role routing, request submission/history, mechanic dispatch/status changes, and admin views using test accounts for each role. Do not validate production by enabling demo auth or adding fake operational data.

## Validation

```powershell
Set-Location E:\RescueRide\frontend
npm run lint
npm run build
```

```powershell
Set-Location E:\RescueRide\web
npm test
npm run build
```

Live workflows require valid Supabase credentials, the backend service secret, correct Supabase policies/schema, and accounts with the matching roles. A successful local build alone does not confirm those production integrations.
