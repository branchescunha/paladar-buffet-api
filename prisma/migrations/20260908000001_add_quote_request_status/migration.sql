CREATE TYPE "QuoteRequestStatus" AS ENUM ('NOVA', 'EM_ANALISE', 'PROPOSTA_ENVIADA', 'APROVADA', 'RECUSADA', 'CANCELADA');

ALTER TABLE "QuoteRequest"
ADD COLUMN "status" "QuoteRequestStatus" NOT NULL DEFAULT 'NOVA';

CREATE INDEX "QuoteRequest_status_idx" ON "QuoteRequest"("status");
