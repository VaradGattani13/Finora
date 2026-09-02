import type { EntryDTO } from '@/types/entry';
import { isoDate } from './format';

// Uses `any` to avoid a hard dep on generated Prisma types at type-check time;
// runtime shape matches Prisma's `Entry` model.
export function toDTO(e: any): EntryDTO {
  return {
    id: e.id,
    date: isoDate(e.date),
    type: e.type,
    category: e.category,
    amount: Number(e.amount),
    note: e.note,
    recurringRuleId: e.recurringRuleId ?? null,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}
