# Guest House Management System

Full-stack Guest House Management System for colleges/institutions with role-based workflows.

## Stack

- Frontend: Next.js 14 (App Router) + TypeScript
- UI: Tailwind CSS + shadcn-style component primitives
- Backend: Next.js API routes
- Database: PostgreSQL
- Driver: `pg`
- Auth: JWT cookie session + role-based access

## Roles

- `EMPLOYEE`: Create, modify, cancel own bookings
- `APPROVER`: Approve/reject official bookings
- `ESTATE_PRIMARY`: Monitoring dashboard with booking details

## Features Implemented

- Ecode login with JWT session
- Role-based dashboard access
- Booking form with:
  - total guest auto-calculation
  - rooms required auto-calculation
- Cancellation/modify flow with search filters
- Approver action screen
- Estate manager primary and secondary screens
- Reports:
  - date-range based booking report
- Export reports to CSV/PDF

## API Routes

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/bookings`
- `GET /api/bookings`
- `GET /api/bookings/:id`
- `PUT /api/bookings/:id`
- `POST /api/approval`
- `POST /api/room-allocation`
- `GET /api/reports?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`
- `GET /api/reports/export?format=csv|pdf&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create your env file:

```bash
copy .env.example .env.local
```

3. Update `.env.local` with your PostgreSQL connection details:

```env
DB_HOST=aws-1-ap-northeast-2.pooler.supabase.com
DB_PORT=5432
DB_USER=postgres.blcocysbvqftdldanejj
DB_PASSWORD=your-password
DB_NAME=postgres
DB_SSL=true
```

4. Create the database and tables in PostgreSQL:

```sql
-- Open and run: database/schema.sql
```

5. Insert sample data:

```sql
-- Open and run: database/seed.sql
```

6. Run the app:

```bash
npm run dev
```

7. Verify database connection:

- Open `http://localhost:<port>/login`.
- Sign in with a seed user.
- If login works and dashboard data loads, DB connection is successful.

## Step-by-Step: Connect to Database (Quick Guide)

1. Create a PostgreSQL database, including Supabase if you prefer hosted Postgres.
2. Run `database/schema.sql`.
3. Run `database/seed.sql`.
4. Set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and `DB_SSL` in `.env.local`.
5. Add your Cloudflare Turnstile keys if you want login protection enabled locally:
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
   - `TURNSTILE_SECRET_KEY`
6. Start app with `npm run dev` and test login.

## Default Seed Logins

- `EMP001 / password`
- `APP001 / password`
- `EST001 / password`
- `EST002 / password`

## Deployment Notes

- Use a managed PostgreSQL database or Supabase for easiest deployment.
- If the app is hosted on Vercel, set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL=true`, `JWT_SECRET`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, and `TURNSTILE_SECRET_KEY` in the Vercel Environment Variables screen.
- The login form uses Cloudflare Turnstile invisible mode, so you must create a Turnstile widget in Cloudflare and paste its site key and secret key into those env vars.
- Keep database, Turnstile, and JWT secrets in environment variables, never in source control.

## Folder Structure

- `app/` App Router pages and API routes
- `components/` UI and dashboard components
- `lib/` DB, auth, validation, reports utilities
- `database/schema.sql` SQL schema
- `database/seed.sql` sample seed data
