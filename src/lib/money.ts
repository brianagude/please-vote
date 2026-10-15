// Campaign money in plain, consistent numbers. All amounts in one record use
// the same rounding, and "started with" is worked out from the others, so the
// lines a reader sees always add up: started + raised − spent = left.

export interface MoneyLines {
  start?: string;
  raised: string;
  transfers?: string;
  spent: string;
  left: string;
  /** False when the campaign's own reports don't reconcile (left < raised − spent). */
  addsUp: boolean;
}

export function moneyLines(m: { raised: number; spent: number; cashOnHand: number; transfersIn?: number }): MoneyLines {
  const big = Math.max(m.raised, m.spent, m.cashOnHand) >= 1e6;
  // Work in whole display units: tenths of a million, or hundreds of dollars.
  const unit = big ? 1e5 : 100;
  const r = (n: number) => Math.round(n / unit);
  const fmt = (u: number) =>
    big ? `$${String(Math.round(u) / 10)} million`.replace(".0 ", " ") : `$${(u * 100).toLocaleString("en-US")}`;

  const raised = r(m.raised);
  const spent = r(m.spent);
  const left = r(m.cashOnHand);
  const start = left - raised + spent;
  const transfers = r(m.transfersIn ?? 0);
  return {
    start: start > 0 ? fmt(start) : undefined,
    raised: fmt(raised),
    transfers: transfers > 0 ? fmt(transfers) : undefined,
    spent: fmt(spent),
    left: fmt(left),
    addsUp: start >= 0,
  };
}

/** "$10,000", or "$1.9 million" for big amounts. */
export const usd = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(1).replace(/\.0$/, "")} million` : `$${Math.round(n).toLocaleString("en-US")}`);

// Short words and acronyms that stay in capitals when FEC names are made readable.
const KEEP = new Set(["PAC", "PACS", "AFL", "CIO", "UAW", "USA", "LLC", "II", "III", "IV", "NRA", "AIPAC", "AFT", "SEIU", "IBEW", "NEA", "AARP", "TIAA", "UPS", "AT&T", "LGBTQ", "GOP", "DC"]);
const SMALL = new Set(["of", "the", "and", "for", "to", "in", "on", "a", "an", "at", "by"]);

/** FEC names are filed in capitals ("COX ENTERPRISES PAC (COXPAC) INC."); show them in normal case. */
export function orgName(s: string) {
  return s
    .split(/(\s+|[(),/-])/)
    .map((w, i) => {
      const bare = w.replace(/[.,]/g, "");
      if (!/[A-Za-z]/.test(w)) return w;
      if (KEEP.has(bare.toUpperCase()) || /PAC$/i.test(bare) || (bare.length <= 4 && !/[AEIOUY]/i.test(bare))) return w.toUpperCase();
      const lower = w.toLowerCase();
      if (i > 0 && SMALL.has(lower)) return lower;
      // Capitalize the first letter only: "oilmen's" → "Oilmen's", not "Oilmen'S".
      return lower.replace(/^([^a-z]*)([a-z])/, (_, p, c) => p + c.toUpperCase());
    })
    .join("");
}
