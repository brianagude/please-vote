import fs from "node:fs";
import path from "node:path";
import type { Candidate, Fact, StateData } from "./types";
import { buildRecord } from "./record";
import type { VotesFile } from "../../pipeline/votes";

const DATA_DIR = path.resolve("data/states");

const read = (code: string, file: string) =>
  JSON.parse(fs.readFileSync(path.join(DATA_DIR, code, file), "utf8"));

const readIfExists = (code: string, file: string) =>
  fs.existsSync(path.join(DATA_DIR, code, file)) ? read(code, file) : undefined;

/** Every state with a data folder. */
export function stateCodes(): string[] {
  return fs.readdirSync(DATA_DIR).filter((d) => fs.existsSync(path.join(DATA_DIR, d, "state.json")));
}

export function loadState(code: string): StateData {
  const data: StateData = {
    config: read(code, "state.json"),
    offices: read(code, "offices.json"),
    races: read(code, "races.json"),
    legislature: { ...read(code, "legislature.json"), running: read(code, "legislature-races.json") },
    sources: read(code, "sources.json"),
    zipToHouse: read(code, "zip-to-house.json"),
  };
  // Nightly output, keyed by candidate id. Merged over the hand-checked files.
  const photos: Record<string, Candidate["photo"]> | undefined = readIfExists(code, "generated/photos.json");
  const gen = {
    congress: readIfExists(code, "generated/congress.json"),
    money: readIfExists(code, "generated/money.json"),
    bills: readIfExists(code, "generated/bills.json"),
    votes: readIfExists(code, "generated/votes.json"),
  };
  const cycle = data.config.election.date.slice(0, 4);
  for (const c of allCandidates(data)) {
    // A photo set by hand in races.json wins over the nightly one.
    if (!c.photo && photos?.[c.id]) c.photo = photos[c.id];
    c.record = buildRecord(c, gen, cycle, data.config.name);
  }
  return data;
}

export function allCandidates(d: StateData): Candidate[] {
  return [...Object.values(d.races.statewide), ...Object.values(d.races.house)].flatMap((r) => r.candidates);
}

/** Every vote for one person, with the bill details filled in (for their own page). */
export function loadVotes(code: string, id: string) {
  const f: VotesFile | undefined = readIfExists(code, "generated/votes.json");
  const p = f?.people[id];
  if (!f || !p) return undefined;
  return {
    ...p,
    votes: p.votes.map(([key, date, chamber, what, vote, passed]) => ({ ...f.bills[key], key, date, chamber, what, vote, passed: !!passed })),
  };
}

/** Hard rule #2: a fact without a source is not shown. */
export const sourced = (f?: Fact): f is Fact & { source: NonNullable<Fact["source"]> } => !!f?.source;
