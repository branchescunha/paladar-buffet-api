CREATE TYPE "ProposalPricingMode" AS ENUM ('ITEMIZED', 'PER_GUEST');

ALTER TABLE "Proposal"
ADD COLUMN "pricingMode" "ProposalPricingMode" NOT NULL DEFAULT 'ITEMIZED',
ADD COLUMN "guestCount" INTEGER,
ADD COLUMN "pricePerGuestCents" INTEGER,
ADD COLUMN "baseTotalCents" INTEGER,
ADD COLUMN "responsibleAdminId" TEXT;

CREATE TABLE "MenuSelectionGroup" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "minSelections" INTEGER NOT NULL DEFAULT 0,
  "maxSelections" INTEGER,
  "position" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MenuSelectionGroup_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MenuSelectionGroup_selection_limits_check" CHECK (
    "minSelections" >= 0 AND ("maxSelections" IS NULL OR "maxSelections" >= "minSelections")
  )
);

CREATE TABLE "MenuSection" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MenuSection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MenuOption" (
  "id" TEXT NOT NULL,
  "sectionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MenuOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuoteRequestMenuSelection" (
  "id" TEXT NOT NULL,
  "quoteRequestId" TEXT NOT NULL,
  "menuOptionId" TEXT,
  "groupName" TEXT NOT NULL,
  "groupPosition" INTEGER NOT NULL,
  "sectionName" TEXT NOT NULL,
  "sectionPosition" INTEGER NOT NULL,
  "optionName" TEXT NOT NULL,
  "optionPosition" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuoteRequestMenuSelection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentMethod" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "instructions" TEXT,
  "pixKey" TEXT,
  "position" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProposalIncludedService" (
  "id" TEXT NOT NULL,
  "proposalId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProposalIncludedService_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProposalPaymentInstallment" (
  "id" TEXT NOT NULL,
  "proposalId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "percentage" INTEGER NOT NULL,
  "position" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProposalPaymentInstallment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProposalPaymentInstallment_percentage_check" CHECK ("percentage" > 0 AND "percentage" <= 100)
);

CREATE UNIQUE INDEX "MenuSelectionGroup_name_key" ON "MenuSelectionGroup"("name");
CREATE INDEX "MenuSelectionGroup_position_idx" ON "MenuSelectionGroup"("position");
CREATE INDEX "MenuSelectionGroup_isActive_idx" ON "MenuSelectionGroup"("isActive");
CREATE UNIQUE INDEX "MenuSection_groupId_name_key" ON "MenuSection"("groupId", "name");
CREATE INDEX "MenuSection_groupId_position_idx" ON "MenuSection"("groupId", "position");
CREATE INDEX "MenuSection_isActive_idx" ON "MenuSection"("isActive");
CREATE UNIQUE INDEX "MenuOption_sectionId_name_key" ON "MenuOption"("sectionId", "name");
CREATE INDEX "MenuOption_sectionId_position_idx" ON "MenuOption"("sectionId", "position");
CREATE INDEX "MenuOption_isActive_idx" ON "MenuOption"("isActive");
CREATE UNIQUE INDEX "QuoteRequestMenuSelection_quoteRequestId_menuOptionId_key" ON "QuoteRequestMenuSelection"("quoteRequestId", "menuOptionId");
CREATE INDEX "QuoteRequestMenuSelection_quoteRequestId_groupPosition_sectionPosition_optionPosition_idx" ON "QuoteRequestMenuSelection"("quoteRequestId", "groupPosition", "sectionPosition", "optionPosition");
CREATE INDEX "QuoteRequestMenuSelection_menuOptionId_idx" ON "QuoteRequestMenuSelection"("menuOptionId");
CREATE UNIQUE INDEX "PaymentMethod_name_key" ON "PaymentMethod"("name");
CREATE INDEX "PaymentMethod_position_idx" ON "PaymentMethod"("position");
CREATE INDEX "PaymentMethod_isActive_idx" ON "PaymentMethod"("isActive");
CREATE UNIQUE INDEX "ProposalIncludedService_proposalId_position_key" ON "ProposalIncludedService"("proposalId", "position");
CREATE INDEX "ProposalIncludedService_proposalId_idx" ON "ProposalIncludedService"("proposalId");
CREATE UNIQUE INDEX "ProposalPaymentInstallment_proposalId_position_key" ON "ProposalPaymentInstallment"("proposalId", "position");
CREATE INDEX "ProposalPaymentInstallment_proposalId_idx" ON "ProposalPaymentInstallment"("proposalId");
CREATE INDEX "Proposal_responsibleAdminId_idx" ON "Proposal"("responsibleAdminId");

ALTER TABLE "MenuSection" ADD CONSTRAINT "MenuSection_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "MenuSelectionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MenuOption" ADD CONSTRAINT "MenuOption_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "MenuSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuoteRequestMenuSelection" ADD CONSTRAINT "QuoteRequestMenuSelection_quoteRequestId_fkey" FOREIGN KEY ("quoteRequestId") REFERENCES "QuoteRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuoteRequestMenuSelection" ADD CONSTRAINT "QuoteRequestMenuSelection_menuOptionId_fkey" FOREIGN KEY ("menuOptionId") REFERENCES "MenuOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProposalIncludedService" ADD CONSTRAINT "ProposalIncludedService_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProposalPaymentInstallment" ADD CONSTRAINT "ProposalPaymentInstallment_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_responsibleAdminId_fkey" FOREIGN KEY ("responsibleAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "MenuSelectionGroup" ("id", "name", "minSelections", "maxSelections", "position", "updatedAt") VALUES
  ('menu-group-hot-starters', 'Entradas quentes', 2, 2, 1, CURRENT_TIMESTAMP),
  ('menu-group-cold-starters', 'Entradas frias', 1, 1, 2, CURRENT_TIMESTAMP),
  ('menu-group-sides', 'Acompanhamentos', 3, 3, 3, CURRENT_TIMESTAMP),
  ('menu-group-salads', 'Saladas', 2, 2, 4, CURRENT_TIMESTAMP),
  ('menu-group-proteins', 'Proteínas', 2, 2, 5, CURRENT_TIMESTAMP),
  ('menu-group-drinks', 'Bebidas', 0, NULL, 6, CURRENT_TIMESTAMP),
  ('menu-group-coffee', 'Mesa do café', 0, NULL, 7, CURRENT_TIMESTAMP);

INSERT INTO "MenuSection" ("id", "groupId", "name", "position", "updatedAt") VALUES
  ('menu-section-hot-starters', 'menu-group-hot-starters', 'Entradas quentes', 1, CURRENT_TIMESTAMP),
  ('menu-section-cold-starters', 'menu-group-cold-starters', 'Entradas frias', 1, CURRENT_TIMESTAMP),
  ('menu-section-rice', 'menu-group-sides', 'Arroz', 1, CURRENT_TIMESTAMP),
  ('menu-section-pasta', 'menu-group-sides', 'Massas', 2, CURRENT_TIMESTAMP),
  ('menu-section-salads', 'menu-group-salads', 'Saladas', 1, CURRENT_TIMESTAMP),
  ('menu-section-proteins', 'menu-group-proteins', 'Proteínas', 1, CURRENT_TIMESTAMP),
  ('menu-section-drinks', 'menu-group-drinks', 'Bebidas', 1, CURRENT_TIMESTAMP),
  ('menu-section-coffee', 'menu-group-coffee', 'Mesa do café', 1, CURRENT_TIMESTAMP);

INSERT INTO "MenuOption" ("id", "sectionId", "name", "position", "updatedAt") VALUES
  ('menu-option-hot-01', 'menu-section-hot-starters', 'Escondidinho de costela desfiada', 1, CURRENT_TIMESTAMP),
  ('menu-option-hot-02', 'menu-section-hot-starters', 'Fricassê de frango', 2, CURRENT_TIMESTAMP),
  ('menu-option-hot-03', 'menu-section-hot-starters', 'Mini Strogonoff de filé com batata palha', 3, CURRENT_TIMESTAMP),
  ('menu-option-hot-04', 'menu-section-hot-starters', 'Polenta cremosa com ragu de costela', 4, CURRENT_TIMESTAMP),
  ('menu-option-hot-05', 'menu-section-hot-starters', 'Arroz carreteiro', 5, CURRENT_TIMESTAMP),
  ('menu-option-hot-06', 'menu-section-hot-starters', 'Camarão internacional', 6, CURRENT_TIMESTAMP),
  ('menu-option-cold-01', 'menu-section-cold-starters', 'Barquete de guacamole', 1, CURRENT_TIMESTAMP),
  ('menu-option-cold-02', 'menu-section-cold-starters', 'Barquete de salpicão', 2, CURRENT_TIMESTAMP),
  ('menu-option-cold-03', 'menu-section-cold-starters', 'Mini caprese no palito', 3, CURRENT_TIMESTAMP),
  ('menu-option-rice-01', 'menu-section-rice', 'Arroz branco', 1, CURRENT_TIMESTAMP),
  ('menu-option-rice-02', 'menu-section-rice', 'Arroz com brócolis', 2, CURRENT_TIMESTAMP),
  ('menu-option-rice-03', 'menu-section-rice', 'Arroz piemontese', 3, CURRENT_TIMESTAMP),
  ('menu-option-pasta-01', 'menu-section-pasta', 'Fettucine ao molho branco', 1, CURRENT_TIMESTAMP),
  ('menu-option-pasta-02', 'menu-section-pasta', 'Penne ao molho quatro queijos', 2, CURRENT_TIMESTAMP),
  ('menu-option-pasta-03', 'menu-section-pasta', 'Talharim ao molho sugo', 3, CURRENT_TIMESTAMP),
  ('menu-option-salad-01', 'menu-section-salads', 'Mix de folhas nobres', 1, CURRENT_TIMESTAMP),
  ('menu-option-salad-02', 'menu-section-salads', 'Salada Caesar', 2, CURRENT_TIMESTAMP),
  ('menu-option-salad-03', 'menu-section-salads', 'Salada tropical', 3, CURRENT_TIMESTAMP),
  ('menu-option-salad-04', 'menu-section-salads', 'Salada de legumes', 4, CURRENT_TIMESTAMP),
  ('menu-option-protein-01', 'menu-section-proteins', 'Filé mignon ao molho madeira', 1, CURRENT_TIMESTAMP),
  ('menu-option-protein-02', 'menu-section-proteins', 'Escalope ao molho de ervas', 2, CURRENT_TIMESTAMP),
  ('menu-option-protein-03', 'menu-section-proteins', 'Lagarto ao molho madeira', 3, CURRENT_TIMESTAMP),
  ('menu-option-protein-04', 'menu-section-proteins', 'Filé de frango ao molho de queijo', 4, CURRENT_TIMESTAMP),
  ('menu-option-protein-05', 'menu-section-proteins', 'Filé de frango ao molho de ervas', 5, CURRENT_TIMESTAMP),
  ('menu-option-protein-06', 'menu-section-proteins', 'Coxa e sobrecoxa recheada', 6, CURRENT_TIMESTAMP),
  ('menu-option-protein-07', 'menu-section-proteins', 'Lombo suíno ao molho de laranja', 7, CURRENT_TIMESTAMP),
  ('menu-option-drink-01', 'menu-section-drinks', 'Coca-Cola', 1, CURRENT_TIMESTAMP),
  ('menu-option-drink-02', 'menu-section-drinks', 'Coca-Cola Zero', 2, CURRENT_TIMESTAMP),
  ('menu-option-drink-03', 'menu-section-drinks', 'Guaraná Antarctica', 3, CURRENT_TIMESTAMP),
  ('menu-option-drink-04', 'menu-section-drinks', 'Guaraná Antarctica Zero', 4, CURRENT_TIMESTAMP),
  ('menu-option-drink-05', 'menu-section-drinks', 'Coquetel de morango sem álcool', 5, CURRENT_TIMESTAMP),
  ('menu-option-drink-06', 'menu-section-drinks', 'Coquetel de maracujá sem álcool', 6, CURRENT_TIMESTAMP),
  ('menu-option-drink-07', 'menu-section-drinks', 'Suco de abacaxi com hortelã', 7, CURRENT_TIMESTAMP),
  ('menu-option-drink-08', 'menu-section-drinks', 'Suco de acerola', 8, CURRENT_TIMESTAMP),
  ('menu-option-drink-09', 'menu-section-drinks', 'Suco de goiaba', 9, CURRENT_TIMESTAMP),
  ('menu-option-drink-10', 'menu-section-drinks', 'Suco de manga', 10, CURRENT_TIMESTAMP),
  ('menu-option-drink-11', 'menu-section-drinks', 'Suco de caju', 11, CURRENT_TIMESTAMP),
  ('menu-option-drink-12', 'menu-section-drinks', 'Suco de morango', 12, CURRENT_TIMESTAMP),
  ('menu-option-drink-13', 'menu-section-drinks', 'Água', 13, CURRENT_TIMESTAMP),
  ('menu-option-drink-14', 'menu-section-drinks', 'Água saborizada', 14, CURRENT_TIMESTAMP),
  ('menu-option-coffee-01', 'menu-section-coffee', 'Café tradicional', 1, CURRENT_TIMESTAMP),
  ('menu-option-coffee-02', 'menu-section-coffee', 'Café sem açúcar', 2, CURRENT_TIMESTAMP),
  ('menu-option-coffee-03', 'menu-section-coffee', 'Chá de camomila', 3, CURRENT_TIMESTAMP),
  ('menu-option-coffee-04', 'menu-section-coffee', 'Chá de hortelã', 4, CURRENT_TIMESTAMP),
  ('menu-option-coffee-05', 'menu-section-coffee', 'Chá de erva-doce', 5, CURRENT_TIMESTAMP),
  ('menu-option-coffee-06', 'menu-section-coffee', 'Petit four', 6, CURRENT_TIMESTAMP),
  ('menu-option-coffee-07', 'menu-section-coffee', 'Biscoitos amanteigados', 7, CURRENT_TIMESTAMP);

INSERT INTO "PaymentMethod" ("id", "name", "position", "updatedAt") VALUES
  ('payment-method-pix', 'Pix', 1, CURRENT_TIMESTAMP),
  ('payment-method-credit', 'Crédito', 2, CURRENT_TIMESTAMP),
  ('payment-method-debit', 'Débito', 3, CURRENT_TIMESTAMP);

UPDATE "AdminUser" SET "role" = 'ADMIN' WHERE "role" = 'OWNER';
