// Plain-language lines about a person's votes, shared by the card and their page.
const n = (x: number) => x.toLocaleString("en-US");
const pct = (part: number, whole: number) => {
  const p = (part / whole) * 100;
  return p > 0 && p < 1 ? "less than 1%" : `${Math.round(p)}%`;
};

export const personPath = (id: string) => `/person/${id}/`;

/** Only people with bills or votes get a page; for everyone else the card already says it all. */
export const hasPage = (c: { record?: { bills?: unknown; votes?: unknown } }) => !!(c.record?.bills || c.record?.votes);

/** "Didn't vote on 185 of 1,618 votes (11%). They had permission to be away (excused) for 148 of them." */
export function attendanceLine(a: { missed: number; excused: number; total: number }) {
  if (a.missed === 0) return `Voted on all ${n(a.total)} votes they could have.`;
  const base = `Didn't vote on ${n(a.missed)} of ${n(a.total)} votes (${pct(a.missed, a.total)}).`;
  if (!a.excused) return base;
  return `${base} They had permission to be away (excused) for ${a.excused === a.missed ? "all" : n(a.excused)} of them.`;
}

/** The rule from DECISIONS #4, in one sentence. */
export function ruleLine(chamber: string, sinceYear: string) {
  // Federal votes are "House"/"Senate"; state ones carry the state's name ("Georgia House").
  const state = chamber.match(/^(.+) (House|Senate|Assembly)$/)?.[1];
  const where = state ? `either chamber of the ${state} legislature` : "the U.S. House or Senate";
  return `Final votes on bills that passed ${where}, since ${sinceYear}. Votes on amendments, committees, and procedure are left out.`;
}

export const countLine = (listed: number) => `${n(listed)} ${listed === 1 ? "vote" : "votes"} on bills that passed at least one chamber.`;

/** Votes grouped by topic: most votes first, "Other" and local laws last. A vote can sit under more than one topic. */
export function voteTopics<T extends { topics: string[] }>(votes: T[]): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const x of votes) for (const t of x.topics) groups.set(t, [...(groups.get(t) ?? []), x]);
  const last = (t: string) => (/^Other|^Local/.test(t) ? 1 : 0);
  return [...groups].sort((a, b) => last(a[0]) - last(b[0]) || b[1].length - a[1].length || a[0].localeCompare(b[0]));
}
