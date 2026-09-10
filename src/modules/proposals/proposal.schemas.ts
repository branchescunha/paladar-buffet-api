import { z } from 'zod';

export const proposalStatusValues = ['RASCUNHO', 'ENVIADA', 'APROVADA', 'RECUSADA', 'CANCELADA'] as const;
export const proposalStatusSchema = z.enum(proposalStatusValues);
const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || undefined);
const dateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).transform((value) => new Date(`${value}T12:00:00.000Z`));

export const proposalItemSchema = z.object({
  description: z.string().trim().min(2).max(240),
  quantity: z.coerce.number().int().min(1).max(10000),
  unitPriceCents: z.coerce.number().int().min(0).max(100000000)
}).strict();

export const proposalInputSchema = z.object({
  customerId: z.string().trim().min(1).max(64),
  eventId: z.string().trim().min(1).max(64).optional(),
  quoteRequestId: z.string().trim().min(1).max(64).optional(),
  description: optionalText(1200),
  notes: optionalText(2400),
  validUntil: dateSchema,
  adjustmentCents: z.coerce.number().int().min(-100000000).max(100000000).default(0),
  subtotalCents: z.coerce.number().int().optional(),
  totalCents: z.coerce.number().int().optional(),
  items: z.array(proposalItemSchema).min(1).max(100)
}).strict();

export const proposalUpdateSchema = proposalInputSchema;
export const proposalListSchema = z.object({ search: optionalText(120), status: proposalStatusSchema.optional() }).strict();
export const proposalIdSchema = z.object({ id: z.string().trim().min(1).max(64) }).strict();
export const proposalStatusUpdateSchema = z.object({ status: proposalStatusSchema }).strict();

export type ProposalInput = z.infer<typeof proposalInputSchema>;
export type ProposalStatus = z.infer<typeof proposalStatusSchema>;
