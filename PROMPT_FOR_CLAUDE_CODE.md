I'm building "Election Day Need-to-Know", a nonpartisan voter guide for people who don't usually vote. It starts with Georgia's November 3, 2026 general election. This repo is the handoff from the design phase.

Start by reading CLAUDE.md, then everything in docs/. After that, open prototype/index.html and data/georgia-2026-snapshot.json. The decisions in docs/DECISIONS.md are settled, so don't reopen them unless something is technically impossible. If it is, tell me why and give me options.

Your job is to turn the prototype into a real site that pulls live data. Work in this order:

**Phase 1: ship before Election Day (Nov 3)**
1. Propose the project structure and stack, following DECISIONS #1 (static site, nightly data refresh, Astro + TypeScript suggested). Wait for my OK.
2. Port the prototype exactly, matching docs/DESIGN.md. Render it from data files instead of hard-coded data, organized by state (data/states/ga/...).
3. Replace the ZIP and district dropdowns with one address field. It calls a small server function that queries the Census Geocoder and returns the voter's U.S. House, State Senate, and State House districts. Keep ZIP lookup as a fallback.
4. Build the nightly data job (GitHub Actions) for:
   - officeholders: congress-legislators and Open States
   - federal campaign money: OpenFEC
   - bills each lawmaker sponsored and which became law: Congress.gov and Open States
   - photos: unitedstates/images, plus Wikimedia Commons filtered by license, with credit lines
5. Add the candidate "career record" from DECISIONS #7: offices held, bills written, attendance, leadership roles, and campaign money. Facts only, each with its source.
6. Walk me through creating the API keys and adding them as GitHub Actions secrets and host environment variables, step by step. Then deploy.

**Phase 2: voting records**
7. Voting records per DECISIONS #4 (final-passage votes only, grouped by topic, rule shown on the site). Federal votes come from the Congress.gov house-vote endpoints and senate.gov XML; state votes come from Open States.
8. Bill summaries per DECISIONS #5: shorten the official summary with the Anthropic API, queue the result, and open a PR for my review. Nothing publishes without my merge.

**Throughout**
- Check every API by calling it before building on it. docs/DATA_SOURCES.md lists what's unverified.
- Re-check the candidate list in the snapshot against the Georgia Secretary of State's certified list, and fix the known issues in DATA_SOURCES.md.
- Never show an unsourced fact, never put keys in the browser, and keep copy plain and short.
- I'm not a developer by trade. Explain decisions briefly, ask before anything expensive or hard to undo, and tell me exactly what I need to do by hand.

Start with step 1.
