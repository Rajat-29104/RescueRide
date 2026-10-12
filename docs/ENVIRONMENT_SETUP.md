# RescueRide Environment Setup

## Required local environment

Use a local `.env.local` in the `web/` directory with the following values where applicable:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GEMINI_API_KEY=your_gemini_key
GROQ_API_KEY=your_groq_key
OPENROUTER_API_KEY=your_openrouter_key
RESEND_API_KEY=your_resend_key
```

For the independent frontend, create `frontend/.env.local` with the public Supabase project values and the backend origin:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_publishable_key
RESCUERIDE_BACKEND_URL=http://localhost:3000
```

The frontend request flow requires a running `web/` backend. Keep `SUPABASE_SERVICE_ROLE_KEY` only in `web/.env.local` (or the backend host's secret store); never put it in the frontend environment. Restart both development servers after changing environment values.

## Install and run

```bash
cd E:\RescueRide\web
npm install
npm run dev
```

In a second terminal:

```bash
cd E:\RescueRide\frontend
npm install
npm run dev -- --port 3001
```

## Verify backend behavior

```bash
cd E:\RescueRide\web
npm test
npm run lint
npm run build
```

## Notes

- Do not commit secrets or production credentials into the repository.
- The live backend should be validated against a real Supabase project before relying on production behavior.
- The current local workspace is sufficient for static validation and unit tests, but live features require credentials and a deployed database.
