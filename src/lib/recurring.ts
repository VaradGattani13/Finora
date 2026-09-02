import { prisma } from './db';
import { currentMonth, daysInMonth, isMonthKey, monthAdd, monthRange } from './month';

/**
 * Materialise recurring rules into real Entry rows.
 *
 * Nothing runs on a timer. The entries API calls this when a month is
 * requested, so the rows exist by the time the dashboard renders them.
 *
 * The generator only moves FORWARD from each rule's `lastRunMonth`, which is
 * what stops a recurring entry the user deleted on purpose from reappearing
 * the next time that month is opened. Future months are never generated —
 * `upTo` is clamped to the current month.
 */
export async function materializeRecurring(userId: string, upTo: string): Promise<number> {
  if (!isMonthKey(upTo)) return 0;

  // Never invent entries for months that have not happened yet.
  const ceiling = upTo > currentMonth() ? currentMonth() : upTo;

  const rules = await prisma.recurringRule.findMany({ where: { userId, active: true } });
  if (rules.length === 0) return 0;

  const rows: any[] = [];
  const advanced: { id: string; month: string }[] = [];

  for (const rule of rules) {
    // Resume after the last generated month, or start at the rule's own start.
    const from = rule.lastRunMonth ? monthAdd(rule.lastRunMonth, 1) : rule.startMonth;
    const to = rule.endMonth && rule.endMonth < ceiling ? rule.endMonth : ceiling;
    const months = monthRange(from < rule.startMonth ? rule.startMonth : from, to);
    if (months.length === 0) continue;

    for (const m of months) {
      // A rule set for the 31st still lands on the 30th in a 30-day month.
      const day = Math.min(rule.dayOfMonth, daysInMonth(m));
      rows.push({
        userId,
        date: new Date(`${m}-${String(day).padStart(2, '0')}T00:00:00.000Z`),
        type: rule.type,
        category: rule.type === 'expense' ? rule.category : null,
        amount: rule.amount,
        note: rule.note,
        recurringRuleId: rule.id,
      });
    }
    advanced.push({ id: rule.id, month: months[months.length - 1] });
  }

  if (rows.length === 0) return 0;

  // One transaction so a failure can't leave rules marked as run without rows.
  await prisma.$transaction([
    prisma.entry.createMany({ data: rows }),
    ...advanced.map((a) =>
      prisma.recurringRule.update({ where: { id: a.id }, data: { lastRunMonth: a.month } })
    ),
  ]);

  return rows.length;
}
