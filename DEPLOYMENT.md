# Vercel deployment

The app requires a persistent PostgreSQL database. Vercel project: `parkpilot`, team: `sachin-bainsla-portfolio`. The Neon resource is on its Free plan, in Singapore; app functions use Mumbai.

Production environment:

- `DATABASE_URL`: pooled hosted database URL, managed by the Neon integration.
- `DATABASE_URL_UNPOOLED` or `POSTGRES_URL_NON_POOLING`: direct URL for migrations; supplied by Neon.
- `DEMO_PASSWORD`: a separate cloud-only password stored as a Vercel Secret. It is not the local demo password and is not committed.
- `SEED_DEMO=true`: enables the non-destructive, idempotent fictional demo seed.
- `APP_ORIGIN`: optional explicit canonical HTTPS origin. Otherwise the app uses trusted Vercel system URL variables. Enable Vercel system environment variables.

`npm run vercel-build` regenerates Prisma, applies migrations over the direct database connection, seeds only when enabled, and builds Next.js. Preview builds skip migrations and seeding; configure a separate preview database before using them.

`.vercelignore` excludes local databases, environment files, dependencies, generated builds and test artifacts. `.vercel/` and all real environment files are also excluded from Git.

Deploy after linking: `vercel deploy --prod --yes`.

GitHub source is published at https://github.com/Sachinbainsla/parkpilot. Automatic GitHub deployments additionally require connecting that GitHub account in Vercel Account Settings / Login Connections; CLI deployments work independently.

This deployment is a fictional demo with simulated payments. See README.md for completed and deferred production features, and VERIFICATION.md for local test results.

## Verified live URL

https://parkpilot-eta.vercel.app — public production alias, verified on desktop and a phone-sized viewport. Deployment ID: `dpl_Cc9YLxxbHPCuZWRNxBFhptP4sCjx`.
