import fs from "node:fs";
import path from "node:path";
import type { Candidate, Fact, StateData } from "./types";

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
    legislature: read(code, "legislature.json"),
    sources: read(code, "sources.json"),
    zipToHouse: read(code, "zip-to-house.json"),
  };
  // Nightly output, keyed by candidate id. Merged over the hand-checked files.
  const photos: Record<string, Candidate["photo"]> | undefined = readIfExists(code, "generated/photos.json");
  if (photos) for (const c of allCandidates(data)) if (photos[c.id]) c.photo = photos[c.id];
  return data;
}

export function allCandidates(d: StateData): Candidate[] {
  return [...Object.values(d.races.statewide), ...Object.values(d.races.house)].flatMap((r) => r.candidates);
}

/** Hard rule #2: a fact without a source is not shown. */
export const sourced = (f?: Fact): f is Fact & { source: NonNullable<Fact["source"]> } => !!f?.source;
