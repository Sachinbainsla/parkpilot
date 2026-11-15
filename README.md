# ParkPilot

A PostgreSQL-backed Next.js MVP for parking operations. All seeded people, addresses, incidents and payments are fictional. SIMULATED payments never charge real money.

## Windows setup

Install Node.js 22 LTS and Docker Desktop with Linux containers. Open PowerShell:

```powershell
cd "E:\car managment system\parkpilot"
npm install
Copy-Item .env.example .env
# Edit .env; keep POSTGRES_PASSWORD and DATABASE_URL passwords in sync.
docker compose up -d
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open http://localhost:3001. APP_ORIGIN must match the URL used in the browser, including its port. PostgreSQL is bound to localhost. An existing PostgreSQL 17+ instance works too: create a database, set DATABASE_URL, and skip Docker. Migration requires permission to create btree_gist.

This workspace already has a local .env initialized from the example. Do not overwrite a configured .env. Change the example secrets before deployment. The seed is non-destructive and exits when the demo tenant already exists.

## Demo accounts

All accounts use the value of DEMO_PASSWORD at the time you seed. Example default: `ChangeMe-ParkPilot-2026!`.

| Role | Email |
| --- | --- |
| Parking Owner | owner@metro.demo |
| Parking Manager | manager@metro.demo |
| Security Guard | guard@metro.demo |
| Customer | customer@metro.demo |
| Super Admin | admin@parkpilot.demo |
| Second tenant owner (isolation checks) | other@metro.demo |

100 spaces P001-P100; P001-P025 reserved; 40 occupied (18 authorized reserved, 20 general, 2 unauthorized reserved); 60 vacant; 55 general spaces vacant, of which 3 blocked, giving 52 available general spaces. Five reserved spaces are vacant. 45 fictional customer/vehicle records include 25 subscription customers. Historical payments and sessions support analytics.

## Demo workflows

- Sign in as owner; inspect the 100-space live map. Map polls every 10 seconds.
- P025 is vacant and reserved for MH02AB1025. Check it in, then check it out through its detail panel.
- Attempt MH02AB1024 in P025: normal check-in is rejected. Use **Record unauthorized parking** and provide a reason to record a physical incident. Occupied spaces are never overwritten, even by override.
- Reserved P019/P020 have seeded unauthorized parking. Violations can be marked resolved independently of checkout.
- Customers can be registered with a vehicle. Allocate a vacant general space through Reservations. Reservations can be released/suspended only while vacant.
- Subscriptions can be filtered by Expiring soon. Generate mock reminders on days 10, 5, 1, -1 and -5. Unique deduplication keys make repeated runs safe.
- Billing supports partial payments, manual cash/UPI/bank entries and simulated payments. Customer role may pay only its own invoices using SIMULATED. PDF receipts are per-payment downloads.
- Waitlist uses oldest-first ordering. Manager reviews a candidate and explicitly confirms a vacant, unblocked, unallocated space.
- Reports exports occupancy history and payments as CSV, with date-range filtering and formula-injection protection. The historical charts show daily recorded occupancy and six months of collections.
- Customer portal shows only that customer's profile, vehicles, subscriptions and invoices. Recorded parking locations come from check-in records, not GPS.

## Verification

```powershell
npm run typecheck
npm run lint
npm test
npm run build
# Requires a migrated, seeded PostgreSQL database:
npx playwright install chromium
npm run test:e2e
```

Production run: `npm run build`, then `npm start`. HTTPS is required in production because session cookies are Secure. No credentials or tokens are stored in browser localStorage.

## Structure and safeguards

`src/lib/auth.ts`: opaque random server-side sessions (stored as SHA-256 digests), scrypt password hashes, 8-hour expiry, disabled-user checks, persisted rate limiting. Browser roles and tenant IDs are never trusted. Mutation API requires same-origin requests.

`src/lib/operations.ts`: Zod command validation, explicit role allowlists, tenant-scoped lookups, transactional advisory locks shared across processes, audit records and idempotent payment keys. All amounts are integer paise. Contract expiry never automatically frees a space. Allocation date overlaps and duplicate active vehicle/space sessions are prevented by database constraints in the safeguard migration.

`src/lib/snapshot.ts`: server-filtered customer data and restricted guard financial/contact access. Bounded queries prevent unbounded response size. Current MVP uses bounded client-side lists, not full server pagination.

`prisma/`: schema, initial and safeguard migrations, deterministic fictional seed. Timestamp columns store UTC instants; UI uses the configured location timezone. Asia/Kolkata calendar dates determine remaining subscription days.

## Completed scope and limitations

Implemented source: authentication, tenant-scoped role checks, parking map/detail, check-in/out/moves, audited unauthorized override, customer registration, reservation creation/release/suspension, subscriptions and renewal invoicing, partial payment recording, refund API, PDF receipts, mock notification center, customer portal/issue reporting, waitlist allocation, CSV reporting, organization creation and basic branding.

Deferred: camera QR scanner and signed QR passes; automated reminder scheduler/retry worker; real SMS/email/WhatsApp providers; payment gateway/webhooks; multi-location and role administration UI; tenant SaaS billing; advanced hourly/renewal/violations charts; configurable waitlist/policy editor; full record edit/delete forms; reservation transfer/multiple-vehicle editor and suspension resume; notification consent enforcement; privacy deletion/retention jobs; large-data server pagination; tax/GST invoices. Refund command is API-only. Super Admin creates organization records but does not onboard users/locations yet. Branding color is stored but not applied to every UI surface.

Mock notifications are persisted logs only: they are not queued to external providers and have no retry worker. Do not connect a real messaging provider until consent handling and retries are implemented. Subscription renewal extends contract entitlement and generates an invoice; payment does not automatically renew a subscription.

Before production: complete the deferred controls, external security review, monitoring/backups, deployment secrets, retention policy, password reset/invitation flows, real integration verification and full database-backed acceptance testing. This is an MVP, not a certified production deployment.

## Local PostgreSQL without Docker

Run `npm run db:local` in a separate terminal and keep it open. Then run migrate, seed and dev commands from another terminal. The helper starts a persistent PostgreSQL cluster in `.local-postgres-utf8` using DATABASE_URL credentials and creates the requested database if absent. This is development tooling, not a production database supervisor. Uses the [embedded-postgres runtime](https://github.com/leinelissen/embedded-postgres).

`npm run test:integration` runs real database tests, including concurrent guards and idempotent payments, creating and cleaning only uniquely named test organizations.

Development and production commands use port 3001 because port 3000 was already occupied on this machine. APP_ORIGIN must remain consistent.

## Local database notes

The local helper initializes UTF-8 for Hindi templates. Migration 003 configures UTC database defaults; the UI converts to Asia/Kolkata. On Windows, PostgreSQL may need to run outside a restricted sandbox under your normal Windows user account. Keep the database terminal and app terminal running.

## Verification results

See [VERIFICATION.md](VERIFICATION.md) for the completed test results, environment details and remaining dependency-audit findings. Desktop and mobile captures are in `screenshots/`.

## Live hosted demo

Open [ParkPilot on Vercel](https://parkpilot-eta.vercel.app) on desktop or mobile. The hosted demo has separate cloud credentials supplied by the account owner; the sample local password in this README is for local setup. All hosted records and payments are fictional. See [DEPLOYMENT.md](DEPLOYMENT.md) for hosting configuration.
