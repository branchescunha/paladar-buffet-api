ALTER TABLE "Proposal"
ADD COLUMN "responsibleNameSnapshot" TEXT,
ADD COLUMN "responsibleTitleSnapshot" TEXT;

CREATE TABLE "ProposalMenuSelection" (
  "id" TEXT NOT NULL,
  "proposalId" TEXT NOT NULL,
  "groupName" TEXT NOT NULL,
  "groupPosition" INTEGER NOT NULL,
  "sectionName" TEXT NOT NULL,
  "sectionPosition" INTEGER NOT NULL,
  "optionName" TEXT NOT NULL,
  "optionPosition" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProposalMenuSelection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProposalPaymentMethod" (
  "id" TEXT NOT NULL,
  "proposalId" TEXT NOT NULL,
  "paymentMethodId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "instructions" TEXT,
  "pixKey" TEXT,
  "position" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProposalPaymentMethod_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProposalMenuSelection_order_key"
ON "ProposalMenuSelection"("proposalId", "groupPosition", "sectionPosition", "optionPosition");

CREATE INDEX "ProposalMenuSelection_order_idx"
ON "ProposalMenuSelection"("proposalId", "groupPosition", "sectionPosition", "optionPosition");

CREATE UNIQUE INDEX "ProposalPaymentMethod_proposalId_paymentMethodId_key"
ON "ProposalPaymentMethod"("proposalId", "paymentMethodId");

CREATE UNIQUE INDEX "ProposalPaymentMethod_proposalId_position_key"
ON "ProposalPaymentMethod"("proposalId", "position");

CREATE INDEX "ProposalPaymentMethod_proposalId_idx" ON "ProposalPaymentMethod"("proposalId");
CREATE INDEX "ProposalPaymentMethod_paymentMethodId_idx" ON "ProposalPaymentMethod"("paymentMethodId");

ALTER TABLE "ProposalMenuSelection"
ADD CONSTRAINT "ProposalMenuSelection_proposalId_fkey"
FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProposalPaymentMethod"
ADD CONSTRAINT "ProposalPaymentMethod_proposalId_fkey"
FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProposalPaymentMethod"
ADD CONSTRAINT "ProposalPaymentMethod_paymentMethodId_fkey"
FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
