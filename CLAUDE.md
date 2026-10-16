# Please Vote

The project is named "Please Vote". The big heading on the page stays "Election Day Need-to-Know"; the browser-tab title is "Please Vote" (owner's calls, Oct 14, 2026). The live site is https://vote.brianagude.com.

This is a nonpartisan voter guide for people who don't usually vote. It covers Georgia first, and the code is organized by state so others can be added.

## Read first

- `docs/DECISIONS.md`: settled product and architecture decisions. Don't change them without asking the owner.
- `docs/DATA_SOURCES.md`: which APIs to use, which are dead, and the known data issues.
- `docs/DESIGN.md`: the visual and copy spec, including what the owner rejected.
- `prototype/index.html`: the approved single-file prototype. Match its look.
- `data/georgia-2026-snapshot.json`: the original hand-checked data behind the prototype. It has been split into `data/states/ga/`, which is now the source of truth.
- `README.md`: how the site, address lookup, and nightly job fit together, and which file to edit for what.
- `docs/ADDING_A_STATE.md`: the step-by-step workflow for adding a new state.
- `docs/ROADMAP.md`: what's left and what's next (more states, a "how elections work" page, a glossary).

## Hard rules

1. **Neutral.** Never recommend, rate, rank, or score candidates. Don't color candidates by party. List candidates alphabetically by last name.
2. **Sourced.** Every fact about a person traces to a source recorded in the data. If it isn't sourced, don't show it.
3. **No unreviewed AI text on the live site.** AI-shortened bill summaries go to a review queue (a PR). They publish only after the owner merges.
4. **No secrets in the browser.** API keys live in CI secrets and server functions only. Commit `.env.example`, never `.env`.
5. **Plain language.** Short sentences, a friendly voice, and no fine print. Every candidate fact must make sense to someone with no political background.
6. **Accessibility.** Keyboard navigable, visible focus, good contrast, works at 360px wide, respects reduced motion.

## Working style

- **The owner handles all git.** Never create or switch branches, commit, push, or merge. When work is ready, write the commit message for the owner to use. Read-only git (status, diff, log) is fine.
- Ask the owner before any decision that's expensive to undo, such as stack, hosting, or paid data.
- Keep the owner informed in plain language. They are not a developer by trade.
- Verify claims about APIs by calling them. Don't rely on memory.
