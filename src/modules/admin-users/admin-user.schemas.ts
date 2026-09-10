import { z } from 'zod';

export const adminUserIdSchema = z.object({ id: z.string().trim().min(1).max(64) }).strict();
export const adminUserActiveSchema = z.object({ isActive: z.boolean() }).strict();
export const adminProfileSchema = z.object({ name: z.string().trim().min(2).max(120) }).strict();
