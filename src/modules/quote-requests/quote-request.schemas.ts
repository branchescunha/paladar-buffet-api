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
const menuPreferenceValues = ['jantar', 'churrasco', 'coffee-break', 'brunch', 'sobremesas'] as const;
const serviceNeedValues = ['garcons', 'loucas', 'montagem', 'bebidas'] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

const menuPreferences = z.array(z.enum(menuPreferenceValues)).max(menuPreferenceValues.length).optional();
const serviceNeeds = z.array(z.enum(serviceNeedValues)).max(serviceNeedValues.length).optional();

function normalizeBrazilianPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  return (digits.length === 12 || digits.length === 13) && digits.startsWith('55') ? digits.slice(2) : digits;
}

function isValidBrazilianPhone(value: string) {
  const digits = normalizeBrazilianPhone(value);
  const hasAreaCode = /^[1-9]{2}/.test(digits);
  const isFixedLine = digits.length === 10 && /^[2-5]/.test(digits.slice(2));
  const isMobile = digits.length === 11 && digits[2] === '9';

  return hasAreaCode && (isFixedLine || isMobile);
}

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
      .min(10, 'Telefone inválido.')
      .max(30, 'Telefone inválido.')
      .refine(isValidBrazilianPhone, 'Telefone inválido.')
      .transform(normalizeBrazilianPhone),
    eventType: z.enum(eventTypes),
    eventTypeOther: optionalText(80),
    eventDate: z
      .string()
      .trim()
      .optional()
      .or(z.literal('').transform(() => undefined))
      .transform((value) => (value ? new Date(`${value}T12:00:00.000Z`) : undefined))
      .refine((value) => !value || !Number.isNaN(value.getTime()), 'Data inválida.')
      .refine((value) => !value || value >= startOfToday(), 'Data do evento deve ser futura.'),
    eventTime: z
      .string()
      .trim()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido.'),
    guestCount: z.coerce.number().int().min(1).max(10000),
    location: optionalText(140),
    message: optionalText(1200),
    preferredContact: z.enum(preferredContacts).default('whatsapp'),
    menuPreferences,
    serviceNeeds,
    dietaryRestrictions: optionalText(600),
    acceptedPrivacy: z.literal(true),
    website: optionalText(200)
  })
  .strict()
  .superRefine((value, context) => {
    if (value.eventType === 'outro' && !value.eventTypeOther) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['eventTypeOther'],
        message: 'Informe o tipo de evento.'
      });
    }
  })
  .transform((value) => ({
    ...value,
    eventTypeOther: value.eventType === 'outro' ? value.eventTypeOther : undefined
  }));

export type QuoteRequestInput = z.infer<typeof quoteRequestSchema>;

function startOfToday() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
