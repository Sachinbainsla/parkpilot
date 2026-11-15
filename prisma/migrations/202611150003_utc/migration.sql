-- Prisma timestamp columns represent UTC instants, including database defaults.
DO $$ BEGIN EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), 'UTC'); END $$;
