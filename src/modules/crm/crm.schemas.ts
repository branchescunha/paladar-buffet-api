import { z } from 'zod';

const eventStatusValues = ['PLANEJAMENTO', 'CONFIRMADO', 'CONCLUIDO', 'CANCELADO'] as const;
export const eventStatusSchema = z.enum(eventStatusValues);
export type EventStatus = z.infer<typeof eventStatusSchema>;

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || undefined);
const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\D/g, ''))
  .pipe(z.string().min(10).max(13));
const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .transform((value) => new Date(`${value}T12:00:00.000Z`))
  .refine((value) => !Number.isNaN(value.getTime()));
const timeSchema = z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const customerInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: phoneSchema,
  email: z.string().trim().email().max(180).optional().or(z.literal('').transform(() => undefined)),
  notes: optionalText(1200)
}).strict();

export const customerListSchema = z.object({ search: optionalText(120) }).strict();
export const idParamsSchema = z.object({ id: z.string().trim().min(1).max(64) }).strict();

export const eventInputSchema = z.object({
  customerId: z.string().trim().min(1).max(64),
  eventType: z.string().trim().min(2).max(80),
  eventDate: dateSchema,
  eventTime: timeSchema,
  location: z.string().trim().min(2).max(140),
  guestCount: z.coerce.number().int().min(1).max(10000),
  notes: optionalText(1200),
  status: eventStatusSchema.default('PLANEJAMENTO')
}).strict();

export const eventListSchema = z.object({ search: optionalText(120), status: eventStatusSchema.optional() }).strict();
export const eventUpdateSchema = eventInputSchema.partial().strict();
export const quoteConversionSchema = z.object({ customerId: z.string().trim().min(1).max(64).optional(), customerNotes: optionalText(1200), eventNotes: optionalText(1200) }).strict();

export type CustomerInput = z.infer<typeof customerInputSchema>;
export type EventInput = z.infer<typeof eventInputSchema>;
export type EventUpdate = z.infer<typeof eventUpdateSchema>;
