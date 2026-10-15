# Please Vote

A nonpartisan guide to Georgia's November 3, 2026 election. It covers the dates, which districts you're in, every race on the ballot, what each office does, and who's running. The page itself is titled "Election Day Need-to-Know". Live at https://vote.brianagude.com.

## How it works

- **The site** is plain pages built by [Astro](https://astro.build) from the JSON files in `data/states/ga/`.
- **Address lookup:** a small Cloudflare function (`worker/index.ts`) asks the Census Geocoder which districts an address is in. Addresses aren't stored or logged.
- **Every night**, a GitHub Action (`.github/workflows/nightly.yml`) pulls fresh data, checks it against the rules in `CLAUDE.md`, and commits it. Cloudflare sees the commit and redeploys.

## What's in this folder

| Path | What it is |
|---|---|
| `src/` | The site: page, components, styles, browser script |
| `worker/index.ts` | Address → districts function |
| `data/states/ga/` | Georgia's data. Hand-checked files at the top, nightly output in `generated/` |
| `pipeline/` | The nightly data job, one file per source |
| `public/photos/` | Candidate photos saved by the nightly job |
| `tests/` | Rule checks: sources, alphabetical order, completeness |
| `docs/` | Decisions, data sources, and design spec |
| `prototype/index.html` | The approved design prototype (reference only) |

## Which file to edit

| To change… | Edit |
|---|---|
| Dates, poll hours, voter-page link | `data/states/ga/state.json` |
| What an office does | `data/states/ga/offices.json` |
| Candidates, their facts, and sources | `data/states/ga/races.json` |
| Footer sources list | `data/states/ga/sources.json` |
| Who's running for State Senate / State House | Save the new SoS list in `data/states/ga/sources/`, then run `node pipeline/import-sos.ts "<file>"` |
| A candidate's photo, by hand | Put it in `public/photos/manual/` and add a `photo` entry (with credit and source) in `races.json` |

Don't edit files in `data/states/ga/generated/` or `legislature.json` by hand; the nightly job overwrites them.

## Keys

| Name | Used for | Where it lives |
|---|---|---|
| `DATA_GOV_API_KEY` | Congress.gov and OpenFEC (one key covers both) | GitHub Actions secret, and `.env.local` on your computer |
| `OPENSTATES_API_KEY` | State legislators and bills | GitHub Actions secret, and `.env.local` |
| `ANTHROPIC_API_KEY` | Phase 2 bill summaries only | Not needed yet |

The website itself uses no keys.

## Running it on your computer

```
npm install
npm run data      # fetch fresh data (uses .env.local)
npm test          # check the rules
npm run preview   # build and open at http://localhost:8787
```
