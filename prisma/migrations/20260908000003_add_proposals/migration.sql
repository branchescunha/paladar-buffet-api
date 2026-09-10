CREATE TYPE "ProposalStatus" AS ENUM ('RASCUNHO', 'ENVIADA', 'APROVADA', 'RECUSADA', 'CANCELADA');

CREATE TABLE "Proposal" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "eventId" TEXT,
  "quoteRequestId" TEXT,
  "description" TEXT,
  "notes" TEXT,
  "validUntil" TIMESTAMP(3) NOT NULL,
  "status" "ProposalStatus" NOT NULL DEFAULT 'RASCUNHO',
  "subtotalCents" INTEGER NOT NULL DEFAULT 0,
  "adjustmentCents" INTEGER NOT NULL DEFAULT 0,
  "totalCents" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProposalItem" (
  "id" TEXT NOT NULL,
  "proposalId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPriceCents" INTEGER NOT NULL,
  "subtotalCents" INTEGER NOT NULL,
  "position" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProposalItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Proposal_customerId_idx" ON "Proposal"("customerId");
CREATE INDEX "Proposal_eventId_idx" ON "Proposal"("eventId");
CREATE INDEX "Proposal_quoteRequestId_idx" ON "Proposal"("quoteRequestId");
CREATE INDEX "Proposal_status_idx" ON "Proposal"("status");
CREATE INDEX "Proposal_validUntil_idx" ON "Proposal"("validUntil");
CREATE UNIQUE INDEX "Proposal_quoteRequestId_draft_key" ON "Proposal"("quoteRequestId") WHERE "status" = 'RASCUNHO' AND "quoteRequestId" IS NOT NULL;
CREATE UNIQUE INDEX "ProposalItem_proposalId_position_key" ON "ProposalItem"("proposalId", "position");
CREATE INDEX "ProposalItem_proposalId_idx" ON "ProposalItem"("proposalId");

ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_quoteRequestId_fkey" FOREIGN KEY ("quoteRequestId") REFERENCES "QuoteRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProposalItem" ADD CONSTRAINT "ProposalItem_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
