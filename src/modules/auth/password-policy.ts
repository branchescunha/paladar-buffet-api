import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(10, 'A senha deve ter pelo menos 10 caracteres.')
  .regex(/[a-z]/, 'A senha deve conter letra minúscula.')
  .regex(/[A-Z]/, 'A senha deve conter letra maiúscula.')
  .regex(/[0-9]/, 'A senha deve conter número.');

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
