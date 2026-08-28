import { z } from 'zod';

const eventTypes = [
  'casamento',
  'aniversario',
  'corporativo',
  'confraternizacao',
  'churrasco',
  'reuniao',
  'coffee-break',
  'brunch',
  'outro'
] as const;

const preferredContacts = ['whatsapp', 'email', 'telefone'] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

const stringArray = z.array(z.string().trim().min(1).max(80)).max(12).optional();

export const quoteRequestSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    email: z
      .string()
      .trim()
      .email()
      .max(180)
      .optional()
      .or(z.literal('').transform(() => undefined)),
    phone: z
      .string()
      .trim()
      .min(10)
      .max(30)
      .transform((value) => value.replace(/\D/g, ''))
      .refine((value) => value.length >= 10 && value.length <= 13, 'Telefone invalido.'),
    eventType: z.enum(eventTypes),
    eventTypeOther: optionalText(80),
    eventDate: z
      .string()
      .trim()
      .optional()
      .or(z.literal('').transform(() => undefined))
      .transform((value) => (value ? new Date(`${value}T12:00:00.000Z`) : undefined))
      .refine((value) => !value || !Number.isNaN(value.getTime()), 'Data invalida.')
      .refine((value) => !value || value >= startOfToday(), 'Data do evento deve ser futura.'),
    guestCount: z.coerce.number().int().min(1).max(10000),
    location: optionalText(140),
    message: optionalText(1200),
    preferredContact: z.enum(preferredContacts).default('whatsapp'),
    menuPreferences: stringArray,
    serviceNeeds: stringArray,
    dietaryRestrictions: optionalText(600),
    acceptedPrivacy: z.literal(true),
    website: optionalText(200)
  })
  .superRefine((value, context) => {
    if (value.eventType === 'outro' && !value.eventTypeOther) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['eventTypeOther'],
        message: 'Informe o tipo de evento.'
      });
    }
  });

export type QuoteRequestInput = z.infer<typeof quoteRequestSchema>;

function startOfToday() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
