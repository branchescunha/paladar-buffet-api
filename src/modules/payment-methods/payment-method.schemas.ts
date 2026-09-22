import { z } from 'zod';

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || undefined);

export const paymentMethodIdSchema = z.object({ id: z.string().trim().min(1).max(64) }).strict();
export const paymentMethodInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  instructions: optionalText(600),
  pixKey: optionalText(180),
  position: z.coerce.number().int().min(0).max(10000),
  isActive: z.boolean().default(true)
}).strict();

export type PaymentMethodInput = z.infer<typeof paymentMethodInputSchema>;
