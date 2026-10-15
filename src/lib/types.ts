// Shapes of the files in data/states/<code>/. A paid candidate feed
// (Ballotpedia, BallotReady) would be mapped into these same shapes.

export interface Source {
  label: string;
  url: string;
}

/** One fact about a person. Facts without a source are never shown. */
export interface Fact {
  text: string;
  source?: Source;
}

export interface Photo {
  src: string;
  /** Credit line, required for anything that isn't public domain. */
  credit?: string;
  license?: string;
  source: Source;
}

export interface Candidate {
  id: string;
  name: string;
  /** D, R, L, I, or a full party name. Shown as text only. */
  party: string;
  incumbent?: boolean;
  bio?: Fact;
  career?: Fact[];
  committees?: { items: string[]; source?: Source };
  links: { campaign?: string; official?: string; ballotpedia?: string };
  ids?: { bioguide?: string; fec?: string; openstates?: string };
  photo?: Photo;
  /** Filled from data/states/<code>/generated/ by the nightly job. */
  record?: CareerRecord;
}

export interface CareerRecord {
  offices?: { items: { title: string; from: string; to?: string }[]; source: Source };
  roles?: { items: string[]; source: Source };
  bills?: { since: string; wrote: number; becameLaw: number; laws: { id: string; title: string; url: string; date?: string }[]; source: Source };
  money?:
    | { raised: number; spent: number; cashOnHand: number; fromIndividuals: number; fromPACs: number; from?: string; through?: string; source: Source }
    | { none: true; source: Source };
}

export interface Race {
  candidates: Candidate[];
  note?: string;
}

export interface Office {
  title: string;
  term?: string;
  one: string;
  why: string;
  also: string[];
  /** Ballot questions: the exact wording printed on the ballot. */
  ballot?: string;
  source?: Source;
}

export interface Seat {
  name?: string;
  party?: string;
  vacant?: boolean;
  source: Source;
}

export interface RunningFor {
  name: string;
  party: string;
  incumbent?: boolean;
}

export interface KeyDate {
  what: string;
  when: string;
  start: string;
  end?: string;
  sub?: string;
}

export interface Group {
  id: string;
  title: string;
  sub: string;
  /** Office keys. "@house", "@upper", "@lower" are district races; "?key" is a ballot question. */
  races: string[];
}

export interface StateConfig {
  code: string;
  name: string;
  asOf: string;
  election: { kind: string; date: string; label: string; polls: string };
  voterPage: string;
  dates: KeyDate[];
  districts: {
    house: { label: string; count: number };
    upper: { label: string; count: number; office: string };
    lower: { label: string; count: number; office: string };
  };
  groups: Group[];
  footerNote: string;
  records: { since: string; sinceLabel: string };
}

export interface StateData {
  config: StateConfig;
  offices: Record<string, Office>;
  races: { statewide: Record<string, Race>; house: Record<string, Race> };
  legislature: {
    asOf: string;
    upper: Record<string, Seat>;
    lower: Record<string, Seat>;
    /** Who's running for each seat, from the Secretary of State's list. */
    running: { source: Source; upper: Record<string, RunningFor[]>; lower: Record<string, RunningFor[]> };
  };
  sources: { what: string; label: string; url: string }[];
  zipToHouse: Record<string, number[]>;
}
