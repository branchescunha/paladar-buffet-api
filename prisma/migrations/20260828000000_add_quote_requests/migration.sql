-- CreateTable
CREATE TABLE "QuoteRequest" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventTypeOther" TEXT,
    "eventDate" TIMESTAMP(3),
    "guestCount" INTEGER NOT NULL,
    "location" TEXT,
    "message" TEXT,
    "preferredContact" TEXT NOT NULL,
    "menuPreferences" JSONB,
    "serviceNeeds" JSONB,
    "dietaryRestrictions" TEXT,
    "acceptedPrivacy" BOOLEAN NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'public_site',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuoteRequest_createdAt_idx" ON "QuoteRequest"("createdAt");

-- CreateIndex
CREATE INDEX "QuoteRequest_eventType_idx" ON "QuoteRequest"("eventType");
