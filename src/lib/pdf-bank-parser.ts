// Parser for HDFC / ICICI / SBI style bank statement text.
// Strategy: use the closing-balance delta between adjacent rows to determine
// direction (deposit vs withdrawal) — same approach we've been using manually.

export type ParsedRow = {
  date: string;        // YYYY-MM-DD
  narration: string;
  amount: number;
  type: 'expense' | 'deposit';
  balance: number;
  raw: string;
};

// Row-detection regex: dd/mm/yy or dd/mm/yyyy at line start, then everything.
// We also capture the closing-balance number (last decimal on the line).
const ROW_START = /^(\d{2})[\/\-](\d{2})[\/\-](\d{2,4})\s/;
const AMOUNT_RE = /([\d,]+\.\d{2})/g;

export function parseBankStatement(text: string, opts?: { year?: number }): ParsedRow[] {
  const lines = text.split(/\r?\n/);
  // Group multi-line rows by "starts with a date"
  const groups: string[] = [];
  let cur: string[] = [];
  for (const line of lines) {
    if (ROW_START.test(line)) {
      if (cur.length) groups.push(cur.join(' '));
      cur = [line];
    } else if (cur.length) {
      cur.push(line);
    }
  }
  if (cur.length) groups.push(cur.join(' '));

  const rows: (ParsedRow & { direction?: 'in' | 'out' })[] = [];
  for (const g of groups) {
    const m = g.match(ROW_START);
    if (!m) continue;
    const [, dd, mm, yyRaw] = m;
    let year = parseInt(yyRaw, 10);
    if (year < 100) year += 2000;

    // Last two decimal numbers on the line: amount (2nd last) and balance (last)
    const nums = [...g.matchAll(AMOUNT_RE)].map((x) => parseFloat(x[1].replace(/,/g, '')));
    if (nums.length < 2) continue;
    const balance = nums[nums.length - 1];
    const amount = nums[nums.length - 2];

    // Narration = everything between the date and the first amount
    const withoutDate = g.replace(ROW_START, '').trim();
    const firstAmtIdx = withoutDate.search(/[\d,]+\.\d{2}/);
    const narration = (firstAmtIdx > 0 ? withoutDate.slice(0, firstAmtIdx) : withoutDate)
      .replace(/\s+/g, ' ')
      .trim();

    rows.push({
      date: `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`,
      narration,
      amount,
      balance,
      type: 'expense', // placeholder, corrected below
      raw: g,
    });
  }

  // Determine direction by balance delta vs previous row
  for (let i = 0; i < rows.length; i++) {
    if (i === 0) {
      // Without prev balance we can't be sure; default to expense (user reviews it)
      rows[i].type = 'expense';
      continue;
    }
    const prev = rows[i - 1].balance;
    const cur = rows[i].balance;
    // Increase → deposit; decrease → expense
    rows[i].type = cur > prev ? 'deposit' : 'expense';
  }

  return rows;
}

// Sniff a category from the narration text — best-effort defaults the user can override.
export function guessCategory(narration: string, amount: number): string | null {
  const s = narration.toLowerCase();
  if (/salary|zs assoc|payroll|hdfc bank ltd/.test(s)) return null; // it's a deposit anyway
  if (/rent/.test(s)) return 'rent';
  if (/upi.*swiggy|zomato|food|restaurant|hotel|cafe|bakery|sandwich|kitchen|pani puri|puri|snack|dine|treat|noodl/.test(s)) return 'food';
  if (/mf|mutual fund|sip|bse mf|sbifunds|indomim|hlic|hdfc life|geojit|ipo|ulip|ppf|nps/.test(s)) return 'invest';
  if (/uber|ola|auto|rapido|petrol|fuel|bharatpe|okbizaxis/.test(s)) return 'travel';
  if (/electricity|bill|mobile|recharge|dth|internet|wifi|insurance|cred\.telecom|dreamplug/.test(s)) return 'bills';
  if (/kirana|grocery|provision|instamart|zepto|blinkit|bigbasket/.test(s)) return 'grocery';
  if (/cred club|credit card|amex|hdfc card/.test(s)) return 'credit';
  if (/amazon|flipkart|myntra|messho|meesho|zudio|shopping|store/.test(s)) return 'shopping';
  return null;
}
