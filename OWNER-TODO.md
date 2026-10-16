# Owner to-do

Things only you can do, or that need your call. Claude keeps this list current: it adds items when they come up and checks them off once they're done. Newest dates first within each section. Last updated Oct 16, 2026.

## Dates coming up

- **Nov 3, 2026:** Election day. After this, the redesign can start (`docs/REDESIGN.md`).
- **Dec 1, 2026:** Georgia runoff, if any race goes to one. Decide whether the site covers it (`docs/ROADMAP.md`).
- **Dec 11, 2026:** California certifies its results. That's California's take-down date for the Nov 3 election. Georgia's and New York's dates still need looking up; Claude will add them here.

## Now

- [ ] **Photos.** Send photos for candidates who don't have one: 17 in New York, 54 in California. Ask Claude for the current list. Drag the image files into the chat with the person's name and the page each one came from.
- [ ] **Merge `california` into main** once Claude says it's finished and the pull request check is green. Then make a new `florida` branch from main.
- [ ] **Submit the sitemap** (`https://vote.brianagude.com/sitemap.xml`) to Google Search Console. Claude can walk you through it.
- [ ] **Open States second key (optional).** If you want a separate key for testing, check Open States' terms first. If it's allowed, put the new key in your own `.env.local` and leave the nightly job's key alone.

## Before the redesign starts

- [ ] **Decide how the new pages should look first:** a quick mockup of the home page and a state page to approve before building (`docs/REDESIGN.md`, decision 8).
- [ ] **Get quotes for paid data** (Ballotpedia, BallotReady, Democracy Works, Cicero), for the paid-data plan in `docs/REDESIGN.md`.

## Whenever you can (never blocks anything)

- [ ] **Statewide officials** beyond governor, lieutenant governor, attorney general, and secretary of state, for each covered state, from each state's official pages. Claude can gather a draft list for you to check. Until then, state pages show the 4 that come in automatically.
- [ ] **Hand-sourced bios** for California's U.S. House challengers, if you want them. Until then, their cards show their ballot job title.

## Done

- [x] **Georgia photos:** every candidate has one (Oct 15).
- [x] **Redesign decisions 1–7** answered (Oct 16).
