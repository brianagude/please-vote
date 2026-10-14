# Decisions

Settled October 14, 2026, before handoff to Claude Code. Change these only with the owner's sign-off.

## Product

- **Audience:** people who don't know much about government and don't usually vote.
- **Job of the site:** tell them when to vote, what's on their ballot, what each office does, and who the candidates are, including what incumbents have actually done in office.
- **Tone:** a well-informed friend explaining things. Short, plain, and no fine print.
- **Neutrality:** the site never recommends, rates, or ranks candidates. Every fact shown has a source.

## 1. Hosting and architecture: static site with a nightly data refresh

- A scheduled job (GitHub Actions) pulls every data source, writes JSON files, and rebuilds the site.
- API keys live only in the job's secrets, never in the browser.
- One small server function handles address lookup (see the Census Geocoder in DATA_SOURCES.md), because the browser may not be able to call it directly (unverified).
- Suggested stack: Astro + TypeScript, deployed to Cloudflare Pages, Netlify, or Vercel. Claude Code may choose otherwise if it explains why.

## 2. Scope: Georgia first, built to expand

- Code and data are organized by state (`data/states/ga/...`). Adding a state should be config plus data, not new code.
- Offices covered: U.S. Senate, U.S. House, statewide executive offices, Public Service Commission, State Senate, State House, and statewide ballot questions.
- Not covered in v1: county, city, school board, and judicial races.

## 3. Candidate data: free sources only for now

- Federal candidates come from the FEC. The 2026 nominees are already in the snapshot.
- State legislative seats show the **current officeholder only**, plus a note that the full candidate list is on the voter's My Voter Page.
- In parallel, the owner requests quotes from Ballotpedia, BallotReady, and Democracy Works for full candidate data. The code should accept a paid candidate feed later without a rewrite.

## 4. Which votes appear: a fixed, published rule

Show only **final-passage votes** on bills and joint resolutions that passed at least one chamber, in the current and previous term.

- Includes: On Passage, On Motion to Concur, conference reports, and veto overrides.
- Excludes: procedural votes, amendments, cloture, and nominations.
- Votes are grouped by topic (Congress.gov "policy area"). The rule is stated in one plain sentence on the site.
- Each vote shows Yes, No, or Didn't vote.
- State legislators get the same rule using Open States vote data (motion classification `passage`).

## 5. Bill summaries: AI-shortened official summaries, approved by a person

- Start from the official summary: Congress.gov / CRS for federal bills, the bill text or official synopsis for state bills.
- Claude (Anthropic API) shortens each one to a single plain sentence of 25 words or fewer, at about an 8th-grade reading level, with no adjectives that judge the bill.
- New summaries go into a review queue. The nightly job opens a pull request listing them, and **nothing publishes until the owner merges it**.
- Each summary links to the official bill page.

## 6. Photos: official portraits plus free-licensed photos

- Members of Congress use public-domain official portraits from `unitedstates/images`.
- Everyone else uses Wikimedia Commons images, **only** if licensed CC0, public domain, CC BY, or CC BY-SA, with a credit line on the site.
- If no photo is available, show initials.
- Photos are shown for whoever has one. The owner chose this knowing incumbents are more likely to have photos than challengers.

## 7. v1 features, beyond the current prototype

Each candidate gets a **career record** made only of factual, sourced items, with no scores or ratings:

- **Offices held:** a timeline of each office and its years.
- **Bills they wrote:** the number sponsored, the number that became law, and plain-sentence summaries of those that became law. Sources: Congress.gov and Open States.
- **How they voted:** per rule #4, grouped by topic.
- **Attendance:** missed-vote rate for the current term.
- **Leadership roles:** committee chairs and leadership posts.
- **Campaign money:** total raised, spent, and cash on hand, plus the share from individuals vs. PACs. Federal candidates use OpenFEC. For state candidates, find the Georgia Government Transparency & Campaign Finance Commission data source; it's unverified whether it has an API.
- **Impact,** meaning what changed because of them, is expressed only through the facts above: laws they authored, roles held, and votes on bills that became law. No editorializing.

Kept from the prototype:
- Countdown and key-date cards
- The "Check my voter page" link
- What each office does, in plain words
- Campaign site, official site, and Ballotpedia links

## 8. Code home

A new GitHub repository, seeded from this package.

## Deadline reality

Election Day is **November 3, 2026**, and early voting is already open.

- **Phase 1 (ship before Election Day):**
  - Port the prototype
  - Address-to-district lookup
  - Nightly refresh of officeholders
  - Campaign money
  - Bills they wrote
- **Phase 2:** votes plus reviewed summaries.

If Phase 2 isn't ready, launch without it rather than publishing unreviewed summaries.
