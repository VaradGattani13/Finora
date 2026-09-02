// Wire-format entry types (what the API sends/accepts)

export type EntryType = 'expense' | 'deposit';

export interface EntryDTO {
  id: string;
  date: string;      // YYYY-MM-DD
  type: EntryType;
  category: string | null;
  amount: number;
  note: string;
  /** Set when the row was generated from a recurring rule. */
  recurringRuleId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface EntryInput {
  date: string;
  type: EntryType;
  category?: string | null;
  amount: number;
  note?: string;
}

export interface BudgetDTO {
  category: string;
  amount: number;
}

export interface RecurringDTO {
  id: string;
  type: EntryType;
  category: string | null;
  amount: number;
  note: string;
  dayOfMonth: number;
  startMonth: string;
  endMonth: string | null;
  active: boolean;
  lastRunMonth: string | null;
}

export interface TrendPoint {
  month: string;
  deposits: number;
  spends: number;
  net: number;
  count: number;
}
