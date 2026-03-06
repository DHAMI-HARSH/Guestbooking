# Guest House Management System

Full-stack Guest House Management System for colleges/institutions with role-based workflows.

## Stack

- Frontend: Next.js 14 (App Router) + TypeScript
- UI: Tailwind CSS + shadcn-style component primitives
- Backend: Next.js API routes
- Database: Microsoft SQL Server
- Driver: `mssql`
- Auth: JWT cookie session + role-based access

## Roles

- `EMPLOYEE`: Create, modify, cancel own bookings
- `APPROVER`: Approve/reject official bookings
- `ESTATE_PRIMARY`: Monitoring dashboard with booking details
- `ESTATE_SECONDARY`: Room allocation, service approval, estate rejection

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
  - monthly bookings
  - guest history
  - room usage
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
- `GET /api/reports?type=monthly|guest-history|room-usage`
- `GET /api/reports/export?type=...&format=csv|pdf`

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create your env file:

```bash
copy .env.example .env.local
```

3. Update `.env.local` with your SQL Server details:

```env
DB_SERVER=192.168.1.20
DB_PORT=1433
DB_USER=sa
DB_PASSWORD=your_password
DB_NAME=guesthouse
DB_ENCRYPT=false
DB_TRUST_CERT=true
```

4. In SQL Server Configuration Manager:

- Enable `TCP/IP` for your SQL Server instance.
- Restart the SQL Server service.

5. In Windows Firewall, allow inbound TCP `1433` from trusted machines.

6. Create database and tables in SQL Server Management Studio:

```sql
-- Open and run: database/schema.sql
```

7. Insert sample data:

```sql
-- Open and run: database/seed.sql
```

8. Run the app:

```bash
npm run dev
```

9. Verify database connection:

- Open `http://localhost:3000/login`.
- Sign in with a seed user.
- If login works and dashboard data loads, DB connection is successful.

## Step-by-Step: Connect to Database (Quick Guide)

1. Install SQL Server and SQL Server Management Studio.
2. Enable SQL Authentication and create a login (for example `sa`).
3. Enable `TCP/IP` and confirm port `1433`.
4. Create database `guesthouse`.
5. Run `database/schema.sql`.
6. Run `database/seed.sql`.
7. Set database values in `.env.local`.
8. Start app with `npm run dev` and test login.

## Default Seed Logins

- `EMP001 / password`
- `APP001 / password`
- `EST001 / password`
- `EST002 / password`

## LAN + Vercel Deployment Notes

- Host SQL Server on LAN machine with static private IP (example: `192.168.1.20`).
- Ensure SQL Server TCP/IP is enabled on port `1433`.
- Allow inbound firewall rules for SQL Server from trusted internal subnets.
- For Vercel-hosted frontend/API to reach on-prem SQL Server, expose backend securely:
  - preferred: site-to-site VPN or private tunnel (Cloudflare Tunnel / Tailscale Funnel / reverse proxy),
  - avoid direct public SQL port exposure.
- If internal-only deployment is required, run this Next.js app on an internal server instead of public Vercel.

## Folder Structure

- `app/` App Router pages and API routes
- `components/` UI and dashboard components
- `lib/` DB, auth, validation, reports utilities
- `database/schema.sql` SQL schema
- `database/seed.sql` sample seed data
