import { z } from 'zod';

export const quoteRequestStatusValues = [
  'NOVA',
  'EM_ANALISE',
  'PROPOSTA_ENVIADA',
  'APROVADA',
  'RECUSADA',
  'CANCELADA'
] as const;

export const quoteRequestStatusSchema = z.enum(quoteRequestStatusValues);

export const adminQuoteRequestListSchema = z
  .object({
    search: z.string().trim().max(120).optional().transform((value) => value || undefined),
    status: quoteRequestStatusSchema.optional()
  })
  .strict();

export const adminQuoteRequestParamsSchema = z.object({ id: z.string().trim().min(1).max(64) }).strict();

export const updateQuoteRequestStatusSchema = z.object({ status: quoteRequestStatusSchema }).strict();

export type QuoteRequestStatus = z.infer<typeof quoteRequestStatusSchema>;
export type AdminQuoteRequestListInput = z.infer<typeof adminQuoteRequestListSchema>;
