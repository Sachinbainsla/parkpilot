# ParkPilot verification — 15 November 2026

- PostgreSQL 18.4 local runtime initialized with UTF-8; all three migrations applied.
- Fictional demo seeded: 100 spaces, 25 reserved, 40 occupied, 60 vacant, 52 available general spaces, 3 blocked, 45 customers.
- Vitest unit tests: 15 passed.
- PostgreSQL integration tests: 6 passed, including concurrent check-in, payment retries, tenant/role enforcement, database uniqueness and waitlist allocation.
- Playwright with headless Brave: 7 passed. Owner map, customer isolation, guard permissions, anonymous rejection, check-in/out/unauthorized incident, simulated payment/PDF receipt, reminder deduplication and CSV export verified.
- ESLint passed; final production build includes TypeScript validation.
- Desktop and mobile screenshots are in screenshots/.

The first database test run found a two-second transaction acquisition timeout on this machine. The service now permits a bounded ten-second acquisition wait; all six tests passed on rerun. The first browser run used a five-second login assertion while Next.js compiled cold routes. The login assertion now waits up to thirty seconds; all seven browser tests passed on rerun.

The browser suite records small simulated payments and fictional parking incidents. These are demo ledger/history entries; it checks out test vehicles before finishing.

The full production feature scope is not complete. See README.md for deferred features. The latest completed dependency audit reported 10 advisories (3 high, 7 moderate) in Prisma/tooling dependencies; the subsequent audit-fix request failed with ECONNRESET. Further toolchain upgrades and deployment security review remain outstanding.

Local services: http://localhost:3001 and PostgreSQL 127.0.0.1:5432. Keep their terminals/processes running. Restart with npm run db:local in one terminal and npm run dev in another.

## Hosted verification — 15 November 2026

Production URL: https://parkpilot-eta.vercel.app

- Vercel deployment READY: dpl_Cc9YLxxbHPCuZWRNxBFhptP4sCjx.
- Public login returned HTTP 200 without Vercel authentication.
- Hosted HTTPS, owner login, customer login, 100 parking spaces and customer isolation passed.
- Recorded check-in and check-out in P025 passed; the space was returned to its original vacant/reserved state.
- A fictional INR 1 simulated payment and its downloadable PDF receipt passed. No real money was charged.
- Mobile viewport 390 px passed without horizontal page overflow; cloud screenshots are in screenshots/cloud-desktop.png and screenshots/cloud-mobile.png.
- Deployment-origin unit tests increased the unit suite to 20 passing tests. TypeScript, source lint and the production build passed.
- Cloud demo credentials were generated separately and stored as a Vercel Secret, without copying local passwords.
