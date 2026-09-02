import { z } from 'zod';
import { isValidCategoryId } from './categories';

export const entryInputSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
    type: z.enum(['expense', 'deposit']),
    category: z.string().nullish(),
    amount: z.number().positive('Amount must be > 0'),
    note: z.string().default(''),
  })
  .refine(
    (e) => e.type === 'deposit' || isValidCategoryId(e.category ?? undefined),
    { message: 'Category required for expenses', path: ['category'] }
  );

export const bulkImportSchema = z.object({
  entries: z.array(entryInputSchema).min(1).max(5000),
  replace: z.boolean().optional().default(false),
});

export const budgetSchema = z.object({
  category: z.string().refine(isValidCategoryId, 'Unknown category'),
  // 0 is meaningful here: it means "remove this budget", handled by the route.
  amount: z.number().min(0).max(100_000_000),
});

export const recurringSchema = z
  .object({
    type: z.enum(['expense', 'deposit']),
    category: z.string().nullish(),
    amount: z.number().positive('Amount must be > 0'),
    note: z.string().default(''),
    dayOfMonth: z.number().int().min(1).max(31),
    startMonth: z.string().regex(/^\d{4}-\d{2}$/, 'startMonth must be YYYY-MM'),
    endMonth: z.string().regex(/^\d{4}-\d{2}$/).nullish(),
    active: z.boolean().optional().default(true),
  })
  .refine((r) => r.type === 'deposit' || isValidCategoryId(r.category ?? undefined), {
    message: 'Category required for expenses',
    path: ['category'],
  })
  .refine((r) => !r.endMonth || r.endMonth >= r.startMonth, {
    message: 'endMonth cannot precede startMonth',
    path: ['endMonth'],
  });
