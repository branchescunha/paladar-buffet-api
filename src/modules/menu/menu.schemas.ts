import { z } from 'zod';

const idSchema = z.string().trim().min(1).max(64);
const nameSchema = z.string().trim().min(2).max(120);

export const menuIdParamsSchema = z.object({ id: idSchema }).strict();

export const menuGroupInputSchema = z.object({
  name: nameSchema,
  minSelections: z.coerce.number().int().min(0).max(100),
  maxSelections: z.coerce.number().int().min(0).max(100).nullable(),
  position: z.coerce.number().int().min(0).max(10000),
  isActive: z.boolean().default(true)
}).strict().superRefine((value, context) => {
  if (value.maxSelections !== null && value.maxSelections < value.minSelections) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['maxSelections'], message: 'O máximo deve ser maior ou igual ao mínimo.' });
  }
});

export const menuSectionInputSchema = z.object({
  groupId: idSchema,
  name: nameSchema,
  position: z.coerce.number().int().min(0).max(10000),
  isActive: z.boolean().default(true)
}).strict();

export const menuOptionInputSchema = z.object({
  sectionId: idSchema,
  name: z.string().trim().min(2).max(180),
  position: z.coerce.number().int().min(0).max(10000),
  isActive: z.boolean().default(true)
}).strict();

export type MenuGroupInput = z.infer<typeof menuGroupInputSchema>;
export type MenuSectionInput = z.infer<typeof menuSectionInputSchema>;
export type MenuOptionInput = z.infer<typeof menuOptionInputSchema>;
