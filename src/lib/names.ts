// Same rules the prototype used: ignore nicknames in quotes and suffixes.
const words = (n: string) =>
  n
    .replace(/["“”][^"“”]*["“”]/g, " ")
    .replace(/,?\s+(Jr|Sr|II|III)\.?\s*$/, "")
    .split(/\s+/)
    .filter(Boolean);

export const initials = (n: string) => {
  const w = words(n);
  return (w[0][0] + (w.length > 1 ? w[w.length - 1][0] : "")).toUpperCase();
};

export const lastName = (n: string) => {
  const w = words(n);
  return w[w.length - 1];
};

/** Hard rule #1: candidates are always listed alphabetically by last name. */
export const byLastName = <T extends { name: string }>(list: T[]) =>
  [...list].sort((a, b) => lastName(a.name).localeCompare(lastName(b.name)) || a.name.localeCompare(b.name));

const PARTY: Record<string, string> = { D: "Democrat", R: "Republican", L: "Libertarian", I: "Independent" };
export const partyName = (p?: string) => (p ? PARTY[p] ?? p : "");

