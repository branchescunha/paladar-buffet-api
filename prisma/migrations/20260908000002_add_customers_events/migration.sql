CREATE TYPE "EventStatus" AS ENUM ('PLANEJAMENTO', 'CONFIRMADO', 'CONCLUIDO', 'CANCELADO');

CREATE TABLE "Customer" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Event" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "quoteRequestId" TEXT,
  "eventType" TEXT NOT NULL,
  "eventDate" TIMESTAMP(3) NOT NULL,
  "eventTime" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "guestCount" INTEGER NOT NULL,
  "notes" TEXT,
  "status" "EventStatus" NOT NULL DEFAULT 'PLANEJAMENTO',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "QuoteRequest" ADD COLUMN "customerId" TEXT;

CREATE UNIQUE INDEX "Customer_email_phone_key" ON "Customer"("email", "phone");
CREATE INDEX "Customer_name_idx" ON "Customer"("name");
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");
CREATE UNIQUE INDEX "Event_quoteRequestId_key" ON "Event"("quoteRequestId");
CREATE INDEX "Event_customerId_idx" ON "Event"("customerId");
CREATE INDEX "Event_eventDate_idx" ON "Event"("eventDate");
CREATE INDEX "Event_status_idx" ON "Event"("status");
CREATE INDEX "QuoteRequest_customerId_idx" ON "QuoteRequest"("customerId");

ALTER TABLE "QuoteRequest" ADD CONSTRAINT "QuoteRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Event" ADD CONSTRAINT "Event_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Event" ADD CONSTRAINT "Event_quoteRequestId_fkey" FOREIGN KEY ("quoteRequestId") REFERENCES "QuoteRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
