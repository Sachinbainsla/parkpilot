-- Physical occupancy and reservation status are separate invariants.
CREATE UNIQUE INDEX "one_active_session_per_space" ON "ParkingSession" ("organizationId", "spaceId") WHERE "exitAt" IS NULL;
CREATE UNIQUE INDEX "one_active_session_per_vehicle" ON "ParkingSession" ("organizationId", "vehicleId") WHERE "exitAt" IS NULL;
ALTER TABLE "ParkingSession" ADD CONSTRAINT "session_dates" CHECK ("exitAt" IS NULL OR "exitAt" >= "entryAt");
ALTER TABLE "Reservation" ADD CONSTRAINT "reservation_dates" CHECK ("endAt" IS NULL OR "endAt" > "startAt");
ALTER TABLE "Invoice" ADD CONSTRAINT "positive_invoice" CHECK ("amountPaise" > 0);
ALTER TABLE "Payment" ADD CONSTRAINT "nonzero_payment" CHECK ("amountPaise" <> 0);
ALTER TABLE "Subscription" ADD CONSTRAINT "positive_subscription" CHECK ("amountPaise" > 0 AND "graceDays" >= 0);
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "Reservation" ADD CONSTRAINT "no_overlapping_allocations" EXCLUDE USING gist (
 "organizationId" WITH =,
 "spaceId" WITH =,
 tsrange("startAt", COALESCE("endAt", 'infinity'::timestamp), '[)') WITH &&
) WHERE (status IN ('ACTIVE', 'SUSPENDED'));
ALTER TABLE "Reservation" ADD CONSTRAINT "reservation_customer_tenant" FOREIGN KEY ("customerId", "organizationId") REFERENCES "Customer"(id, "organizationId");
ALTER TABLE "Invoice" ADD CONSTRAINT "invoice_customer_tenant" FOREIGN KEY ("customerId", "organizationId") REFERENCES "Customer"(id, "organizationId");
ALTER TABLE "Subscription" ADD CONSTRAINT "subscription_customer_tenant" FOREIGN KEY ("customerId", "organizationId") REFERENCES "Customer"(id, "organizationId");
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "waitlist_customer_tenant" FOREIGN KEY ("customerId", "organizationId") REFERENCES "Customer"(id, "organizationId");
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "waitlist_vehicle_tenant" FOREIGN KEY ("vehicleId", "organizationId") REFERENCES "Vehicle"(id, "organizationId");
ALTER TABLE "Violation" ADD CONSTRAINT "violation_space_tenant" FOREIGN KEY ("spaceId", "organizationId") REFERENCES "ParkingSpace"(id, "organizationId");
