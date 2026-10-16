# Adding a state

How a new state goes from nothing to live, based on how New York was added (Oct 2026). Order on the roadmap: California, then Texas, Indiana, Illinois.

**The short version:** the site and the nightly job already work for any state. A folder `data/states/<code>/` with a `state.json` in it is all it takes for the state to appear in the state picker, get its own page at `/<code>/`, and be included in the nightly job. Most of the work is gathering and checking the data.

Each state is built on its own branch (e.g. `california`), which gets a preview link. It goes live only when the owner merges it into main.

## The steps

### 1. Find the official sources (Claude, with the owner's OK)

- The state's elections office: the certified candidate list, key dates (registration, early voting, mail ballots), poll hours, and the page where voters check their registration.
- Anything paid, or anything that isn't a simple pull from a source that's easy to check, goes to the owner first. Per the owner's rule, if it can't be pulled and easily checked, leave it out for now.
- Record what you find in `docs/DATA_SOURCES.md`, including dead ends.

### 2. Hand-checked basics (Claude)

Create `data/states/<code>/` with:

| File | What it holds |
|---|---|
| `state.json` | Name, time zone, election date, key dates, poll hours, voter lookup link |
| `offices.json` | A plain-language description of each office on the ballot |
| `sources.json` | Where each fact came from (the sources list in the footer) |
| `zip-to-house.json` | Which ZIP codes are in which U.S. House district |

Copy New York's files as a starting point (`data/states/ny/`). Every date and hour must match the state's official page.

### 3. Candidates (Claude; the most hands-on step)

- Download the certified candidate list into `data/states/<code>/sources/`. That folder isn't kept in the repo (the site doesn't use it), so record the download link in `sources.json` and `docs/DATA_SOURCES.md`. Each state publishes it differently:
  - Georgia: an .xlsx from the Secretary of State, read by `pipeline/import-sos.ts`.
  - New York: a PDF from the State Board of Elections. `scripts/ny-certification.py` turns it into `certification.json`, and `pipeline/import-ny.ts` turns that into `races.json`.
- A new state usually needs its own short import script (`pipeline/import-<code>.ts`). It must keep anything added by hand (bios, links, photos) when it runs again.
- For each candidate: party, incumbent or not, running mate if any, and FEC ID (for federal races).
- Bios: short, plain, with a source for every line. If a fact has no source, leave it out.
- List candidates alphabetically by last name. No party colors.

### 4. Automatic data (Claude, one command)

```
npm run data -- --state <code>
```

This runs every nightly step for just that state: members of Congress, state legislators, official photos, federal campaign money, voting records, bills each legislator wrote, and contact info. Downloads are saved for 24 hours in `.cache/`, so re-running doesn't use up Open States requests (`PV_FRESH=1` skips the saved copy). A state uses about 8–12 of the 250 Open States requests a day.

### 5. The state's quirks (Claude, checking with the owner)

Every state has some. Places in the code that handle one state specially:

- **State legislature votes:** `pipeline/votes.ts` has a function per state (`georgia`, `newYork`). A new state needs its own, working from the Open States bulk downloads (`pipeline/osbulk.ts`).
- **Bills:** `pipeline/bills.ts` has Georgia-only fixes (sponsor order and vetoes from the General Assembly). Check a new state's bills against its legislature's website for author order, passage, vetoes, and laws.
- **State campaign money:** New York's comes from data.ny.gov (`pipeline/nymoney.ts`). Georgia publishes nothing usable, so it's skipped. Check whether the new state has a free, official download.
- **Statewide ballot questions:** check the wording against a sample ballot.
- **"Good to know" notes:** only things that are true for every voter in the state.

### 6. Check it (Claude)

- Spot-check numbers against official sites: a few bills, a few votes, attendance, campaign money totals. Write down what was checked.
- `npm test`, `npm run build`, `npm run test:a11y`. The pull request check runs these too.
- Look at the state page and a few person pages at phone width (360px).

### 7. Finishing touches (Claude)

- Background crowd with state-name signs: `node scripts/make-people.mjs`
- Link-preview image: `node scripts/make-share-image.mjs` (writes `public/share-<code>.png`)
- Promo posts, if the owner wants them: `node scripts/make-promo.mjs added <code>` (needs `npx astro preview --port 4329` running)
- Add the state to the sitemap check and the README if anything there is Georgia-only.

### 8. Photos (owner)

For candidates without a photo, the owner drags image files into the chat with the person's name and the page the photo came from. Claude crops them to 300×375 into `public/photos/manual/<id>.jpg` and adds a `photo` entry (with credit and source) to `races.json`.

### 9. Review and go live (owner)

Open a pull request from the state's branch, look at the preview link, and merge once the check is green. Pushing to main deploys the live site, so only the owner merges.
