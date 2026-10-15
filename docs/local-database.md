# Local PostgreSQL database

This repository uses PostgreSQL + PostGIS for local development. You can install PostgreSQL directly on Windows and manage it with pgAdmin, or run the optional Docker Compose setup below.

MySQL Workbench manages MySQL servers; it cannot connect to or manage PostgreSQL. Use pgAdmin (installed alongside PostgreSQL, or installed separately) for the PostgreSQL GUI.

## Windows installation

1. Install PostgreSQL for Windows and include pgAdmin 4 in the installer components. Use the PostgreSQL version already installed if it is available (PostgreSQL 18 in the current setup).
2. During installation, choose and save a password for the `postgres` administrator account.
3. If PostGIS is not included, open Stack Builder from the PostgreSQL start menu and install the PostGIS extension matching your PostgreSQL version.
4. Open pgAdmin and connect to your local PostgreSQL server.
5. Right-click **Databases** → **Create** → **Database**, name it `roadrescue`, and save.
6. Open the `roadrescue` database's Query Tool and run:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

If the `postgis` extension is unavailable, install it with Stack Builder and retry.

Add a `DATABASE_URL` entry to `web/.env.local`, using the password you chose during installation. Keep this file private and do not commit it:

```text
DATABASE_URL=postgresql://postgres:<your-password>@localhost:5432/roadrescue
```

From the `web` directory, verify the app can connect and see PostGIS:

```powershell
npm run db:check
```

Apply the current local application schema from the same directory:

```powershell
npm run db:migrate
```

This creates the PostgreSQL tables and nearby-mechanic function tracked in `web/database/migrations/`. It is safe to run again; completed migrations are recorded in `app_schema_migrations`.

## Optional Docker setup

Alternatively, install Docker Desktop and run these commands from the project root:

```powershell
docker compose -f docker-compose.local.yml up -d
docker compose -f docker-compose.local.yml ps
docker compose -f docker-compose.local.yml exec database psql -U roadrescue -d roadrescue -c "SELECT PostGIS_Full_Version();"
```

The Docker database listens on `localhost:55432`.

| Setting | Local value |
| --- | --- |
| Database | `roadrescue` |
| User | `roadrescue` |
| Password | `roadrescue_local_dev` |
| Connection URL | `postgresql://roadrescue:roadrescue_local_dev@localhost:55432/roadrescue` |

These Docker credentials are only for a local development database. Do not reuse them for a deployed database.

Stop the database without deleting its data:

```powershell
docker compose -f docker-compose.local.yml down
```

To remove the database and its persisted data, run `docker compose -f docker-compose.local.yml down -v`.

## Current migration boundary

The local PostgreSQL database and initial application schema are in place. Local email/password signup, login, sessions, logout, and password-reset endpoints use PostgreSQL; password-reset email requires `RESEND_API_KEY`. Rescue request creation and driver history (`/api/requests`), mechanic dispatch feed and verification (`/api/mechanic/requests`, `/api/mechanic/verification`), request detail and status transitions (`/api/requests/[id]`), request chat and ratings, admin incident list/statistics (`/api/admin/requests`, `/api/admin/stats`), and mechanic verification (`/api/admin/mechanics`) also use local PostgreSQL/PostGIS.

Request creation includes request limits, vehicle/mechanic validation, nearby mechanic matching, notifications, and dispatch metrics. Admin and mechanic dispatch feeds, request tracking, chat, and mechanic locations refresh by polling; request lifecycle transitions record status history, metrics, and notifications in PostgreSQL. Vehicle snapshots are stored privately under `web/.local-uploads/` and served only to their owning account. Other application data APIs and browser data access still need migration before Supabase can be removed completely.

Mechanics must be approved and online with browser location access enabled to be included in nearby request matching. The mechanic dashboard's Go Online/Offline control and live location updates write to local PostgreSQL.
