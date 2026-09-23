import { z } from 'zod';

export const proposalStatusValues = ['RASCUNHO', 'ENVIADA', 'APROVADA', 'RECUSADA', 'CANCELADA'] as const;
export const proposalStatusSchema = z.enum(proposalStatusValues);
export const proposalPricingModeValues = ['ITEMIZED', 'PER_GUEST'] as const;
export const proposalPricingModeSchema = z.enum(proposalPricingModeValues);
const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || undefined);
const dateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).transform((value) => new Date(`${value}T12:00:00.000Z`));

export const proposalItemSchema = z.object({
  description: z.string().trim().min(2).max(240),
  quantity: z.coerce.number().int().min(1).max(10000),
  unitPriceCents: z.coerce.number().int().min(0).max(100000000)
}).strict();

export const proposalPaymentInstallmentSchema = z.object({
  description: z.string().trim().min(2).max(160),
  percentage: z.coerce.number().int().min(1).max(100)
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
  pricingMode: proposalPricingModeSchema.default('PER_GUEST'),
  guestCount: z.coerce.number().int().min(1).max(10000).optional(),
  pricePerGuestCents: z.coerce.number().int().min(1).max(100000000).optional(),
  includedServices: z.array(z.string().trim().min(2).max(240)).max(100).default([]),
  paymentMethodIds: z.array(z.string().trim().min(1).max(64)).max(20).default([]),
  paymentInstallments: z.array(proposalPaymentInstallmentSchema).min(1).max(20).optional(),
  items: z.array(proposalItemSchema).max(100).default([])
}).strict().superRefine((value, context) => {
  if (value.pricingMode === 'ITEMIZED' && value.items.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['items'], message: 'Adicione pelo menos um item à proposta.' });
  }
  if (value.pricingMode === 'PER_GUEST') {
    if (value.guestCount === undefined) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['guestCount'], message: 'Informe a quantidade de convidados.' });
    }
    if (value.pricePerGuestCents === undefined) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['pricePerGuestCents'], message: 'Informe o valor por pessoa.' });
    }
    if (value.paymentMethodIds.length === 0) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['paymentMethodIds'], message: 'Selecione pelo menos uma forma de pagamento.' });
    }
    if (new Set(value.paymentMethodIds).size !== value.paymentMethodIds.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['paymentMethodIds'], message: 'As formas de pagamento não podem ser repetidas.' });
    }
    if (value.paymentInstallments && value.paymentInstallments.reduce((sum, item) => sum + item.percentage, 0) !== 100) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['paymentInstallments'], message: 'Os percentuais de pagamento devem totalizar 100%.' });
    }
  }
});

export const proposalUpdateSchema = proposalInputSchema;
export const proposalListSchema = z.object({ search: optionalText(120), status: proposalStatusSchema.optional() }).strict();
export const proposalIdSchema = z.object({ id: z.string().trim().min(1).max(64) }).strict();
export const proposalStatusUpdateSchema = z.object({ status: proposalStatusSchema }).strict();

type ParsedProposalInput = z.infer<typeof proposalInputSchema>;
export type ProposalInput = Omit<ParsedProposalInput, 'pricingMode' | 'includedServices' | 'paymentMethodIds'> & {
  pricingMode?: ParsedProposalInput['pricingMode'];
  includedServices?: ParsedProposalInput['includedServices'];
  paymentMethodIds?: ParsedProposalInput['paymentMethodIds'];
};
export type ProposalStatus = z.infer<typeof proposalStatusSchema>;
