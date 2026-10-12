# RescueRide local and deployment setup

## Applications and services

- `frontend/` is the active Next.js/React UI.
- `backend-spring/` is the Java 21 / Spring Boot REST API. The frontend's same-origin proxy forwards the supported API routes to this service.
- PostgreSQL is provided by the existing Supabase project. Supabase Auth remains the login provider; the Java API validates the forwarded Supabase session and resolves the role from `public.profiles`.
- `web/` contains the legacy Next.js API implementation. It is not the target of `RESCUERIDE_BACKEND_URL` when running the migrated UI.

## Local development

Install a JDK 21 or newer and Apache Maven 3.9 or newer for the Java backend. The Java compiler targets Java 21.

Create `frontend/.env.local` from `frontend/.env.example`. Use the same Supabase project URL and public/anon key configured in the Java backend:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-or-anon-key
RESCUERIDE_BACKEND_URL=http://localhost:8081
```

Set these variables in the backend process environment (or a local, untracked `backend-spring/.env` file loaded by your shell):

```dotenv
SUPABASE_DB_URL=jdbc:postgresql://db.your-project.supabase.co:5432/postgres?sslmode=require
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=replace-with-your-database-password
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-or-anon-key
FRONTEND_ORIGINS=http://localhost:3000,http://localhost:3001
```

Use the PostgreSQL connection string and database password from Supabase's database connection settings. Do not use the Supabase service-role key as a database password. Never commit real credentials or expose secrets through `NEXT_PUBLIC_` variables.

Apply the checked-in SQL migrations to the intended Supabase project before using tables added by this backend, including `supabase/migrations/20261013000000_create_driver_vehicles.sql`. Migrations are not run automatically by the Java application; its JPA schema mode is `none`.

Start the Java API in one terminal:

```powershell
Set-Location E:\Projects\RescueRide\backend-spring
mvn spring-boot:run
```

Start the frontend in a separate terminal:

```powershell
Set-Location E:\Projects\RescueRide\frontend
npm run dev
```

The UI runs on port 3000 and the API on port 8081 by default, avoiding the existing non-RescueRide listener on 8080. The frontend proxy forwards the Supabase session cookie (or Authorization header) to Java; the browser never receives database credentials.

## Deployment

Deploy `frontend/` and `backend-spring/` as separate services. Configure the frontend service with the two public Supabase Auth values and `RESCUERIDE_BACKEND_URL` set to the Java API's HTTPS origin (no `/api` suffix). Configure the Java service with `SUPABASE_DB_URL`, `SUPABASE_DB_USER`, `SUPABASE_DB_PASSWORD`, the Supabase URL and public/anon key, and `FRONTEND_ORIGINS` containing the exact deployed frontend origin(s).

Apply reviewed SQL migrations explicitly before enabling the corresponding workflows. Do not enable Hibernate schema creation/update in production. Live authentication, PostGIS matching, and database integration require valid Supabase configuration and an accessible migrated PostgreSQL database.

## Validation

```powershell
Set-Location E:\Projects\RescueRide\backend-spring
mvn test
```

```powershell
Set-Location E:\Projects\RescueRide\frontend
npm run lint
npm run build
```

Passing local tests and builds does not by itself verify a live Supabase Auth or PostgreSQL connection.
