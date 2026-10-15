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
