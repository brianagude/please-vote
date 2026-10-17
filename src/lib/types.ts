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
  /** Lieutenant governor on the same ticket, where the two are elected together (New York). */
  runningMate?: string;
  /** The short job title printed under their name on the ballot (California). */
  ballotAs?: Fact;
  bio?: Fact;
  career?: Fact[];
  committees?: { items: string[]; source?: Source };
  links: { campaign?: string; official?: string; ballotpedia?: string };
  ids?: { bioguide?: string; fec?: string; openstates?: string; /** New York State Board of Elections filer ID */ nysboe?: string };
  photo?: Photo;
  /** Filled from data/states/<code>/generated/ by the nightly job. */
  record?: CareerRecord;
}

export interface CareerRecord {
  offices?: { items: { title: string; from: string; to?: string }[]; source: Source };
  roles?: { items: string[]; source: Source };
  bills?: {
    since: string;
    wrote: number;
    becameLaw: number;
    laws: { id: string; title: string; url: string; date?: string }[];
    /** Every bill they wrote, laws first, with how far it got. */
    all?: { id: string; title: string; url: string; introduced?: string; status: string }[];
    source: Source;
  };
  money?:
    | {
        raised: number;
        spent: number;
        /** Federal only; state data doesn't give a balance. */
        cashOnHand?: number;
        /** State races: share from corporations, LLCs, and partnerships (New York allows these). */
        fromCompanies?: number;
        /** State races: matching money from the state's public campaign finance program. */
        publicFunds?: number;
        /** True for state (not FEC) money. */
        state?: boolean;
        fromIndividuals: number;
        fromPACs: number;
        donations?: number;
        transfersIn?: number;
        /** PACs that gave to the campaign, biggest first (FEC line 11C). */
        pacs?: { name: string; id?: string; amount: number }[];
        /** Outside groups' independent spending for or against the candidate. */
        outside?: { name: string; id?: string; for: number; against: number }[];
        /** Start of the period the two lists above cover. */
        groupsSince?: string;
        from?: string;
        through?: string;
        source: Source;
      }
    | { none: true; source: Source };
  /** How to reach them in office (person page only). */
  contact?: {
    phone?: string;
    address?: string;
    email?: string;
    form?: string;
    website?: string;
    social: { label: string; url: string }[];
    source: Source;
  };
  /** Summary for the card; the full list is on the person's own page. */
  votes?: {
    since: string;
    listed: number;
    attendance: { missed: number; excused: number; total: number; note?: string };
    chamber: string;
    source: Source[];
  };
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
  ballotAs?: Fact;
  /** Campaign website, from the state's official candidate contact list. */
  campaign?: string;
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
  /** IANA time zone for judging dates ("America/New_York"). */
  timeZone: string;
  voterPage: string;
  dates: KeyDate[];
  districts: {
    house: { label: string; count: number };
    upper: { label: string; count: number; office: string };
    lower: { label: string; count: number; office: string };
  };
  groups: Group[];
  footerNote: string;
  /** Short "Good to know" notes above the ballot, for things that work differently in this state. */
  notes?: { title: string; text: string; link?: Source }[];
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
    running: {
      source: Source;
      upper: Record<string, RunningFor[]>;
      lower: Record<string, RunningFor[]>;
      /** A sourced note under one district's race, like a special election for the same seat. */
      notes?: { upper?: Record<string, Fact>; lower?: Record<string, Fact> };
    };
  };
  sources: { what: string; label: string; url: string }[];
  zipToHouse: Record<string, number[]>;
}
