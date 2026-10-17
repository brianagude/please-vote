# Redesign plan: from ballot guide to hub

Written Oct 16, 2026, before any code, so the decisions are made when the branch starts. The goal and page list come from the owner (Oct 15, 2026; see `docs/ROADMAP.md`). Everything marked **Decide** needs the owner's answer before or at the start of the branch. Each one has a recommendation.

**Timing:** after the election (owner, Oct 16). The four remaining states (Florida, Texas, Indiana, Illinois) are added first, as ballot guides like today's.

## The goal, in one line

Know who represents you, and see clearly what they're doing and how they're representing you. Federal and state only. Upcoming elections, never past results.

## Principles (owner, Oct 16, 2026)

These come first in every choice on the branch, ahead of features.

1. **Accurate and cited.** With far more people and facts on the site, accuracy matters more than coverage. Every fact comes from a verified source or official API and links to it. If it can't be verified, it isn't shown.
2. **Accessible first.** Everyone should be able to read and understand every page easily: plain words, clear structure, keyboard and screen reader friendly, good contrast, works at 360px wide, respects reduced motion. Passing the automated check is the floor, not the goal.
3. **Small and fast.** The cleanest, smallest, quickest build possible. Plain pages first, as little JavaScript as possible, nothing loaded until it's needed (like today's vote lists), and no heavy libraries. Measure page sizes and load times before and after each step.
4. **Easy to digest.** Lead with what a visitor came for, keep each section short, and fold the details away until someone asks for them.
5. **Thoughtful with APIs.** Ask each source only for what changed, as rarely as possible. Cache everything that can be cached, prefer free bulk downloads over API calls, never retry a "limit reached" answer, and keep testing runs to a minimum.
6. **Modular and easy to change** (owner, Oct 16). Styles and pages are built from shared pieces, never rewritten per page:
   - **Shared styles:** colors, type, spacing, and common blocks (sheets, rows, cells, labels, buttons, fields, section headings) are defined once as tokens and classes in one stylesheet, and every page reuses them. No one-off restyling of something that already exists. (The site uses plain CSS today, not Tailwind; if Tailwind is ever added, these become Tailwind tokens and component classes.)
   - **Shared components:** one Astro component per repeated piece (header, footer, address box, date cards, person row, officials list, collapsible section, race card), used everywhere it appears. Changing the component changes it on every page.
   - **Use what Astro gives us** (owner, Oct 16): each component keeps its markup, its small bit of logic, and its own styles in the same `.astro` file (Astro scopes a component's `<style>` to that component, so it can't leak onto other pages). Only the shared tokens and base styles live in the one global stylesheet.
   - **State differences, in this order** (owner, Oct 16):
     1. **Data first.** Most differences come from the state's own files, not code: how many key dates, which offices and notes, propositions vs. amendments, New York's party lines, California's ballot job titles. Shared components read these and adapt (like today's date cards fitting 4 or 5 dates).
     2. **Small switches next.** A component can take an option for a known variation (for example, a race card that shows running mates), set in the state's data.
     3. **An override only when a state truly needs its own look or block.** It lives in one place, `src/states/<code>/` (for example `src/states/ca/Propositions.astro`). The shared page uses a state's override if one exists and the shared component if not. Overrides reuse the shared tokens and classes, so they still match the rest of the site.
   - **Clear structure:** a new developer should be able to find anything quickly. Pages in `src/pages/`, components in `src/components/`, styles in `src/styles/`, data in `data/states/<state>/`, the nightly job in `pipeline/`, with a short map in `README.md` of what lives where and which file to edit for what.

## What we know (decided)

- **Audience and rules don't change.** Neutral, sourced, plain language, accessible (CLAUDE.md hard rules). The vintage printed-form look stays (`docs/DESIGN.md`, `prototype/index.html`).
- **Scope:** federal and state offices only. No local offices. Mayors of state capitals, local measures, and judges are on the maybe-later list.
- **Who gets a page:** everyone who writes bills and votes on laws: members of Congress and state legislators. That's every one of them in each covered state, not just the ones on a ballot.
- **Who gets a card:** everyone else (governors and other statewide officials, challengers), on their state's page.
- **Elections:** show each state's upcoming elections. No past results. The most recent election's data stays up for a short while, then comes down.
- **Pages to build:** a header or link bar on every page (Home, States, Upcoming elections, Find your officials, How elections work, Glossary), a home page pointing to all of those, state pages, an upcoming elections page, find your officials, person pages (as today), how elections work, a glossary, and a "something look wrong or missing?" link.
- **Glossary changes the copy rules:** use the real terms ("Incumbent", not "Has the job now"), each with a one-line plain definition.
- **Feedback starts as an email link.** A form needs email setup first.
- **When a challenger wins,** switch to their new official photo and remove the one we sourced.
- **Wikipedia is never the source for official information** (who holds an office, election dates and rules, votes, bills, money). Photos from Wikimedia Commons are fine (owner, Oct 16), and so is background copy (bio and career lines) cited as Wikipedia, so everyone has some background (owner, Oct 17).
- **The owner handles all git.** The redesign is its own branch and pull request. Pull requests are squash-merged. The git history cleanup happens with or after this branch.
- **More states come after this.** New states get added into the hub. The rest of the states wait until after the election.

## What we know about the data (checked)

| Need | Source | Status |
|---|---|---|
| Members of Congress (all states) | `unitedstates/congress-legislators` | In use. No key. |
| State legislators (all states) | Open States' current-legislators file (`data.openstates.org/people/current/<state>.csv`) | In use since Oct 16. No key, no limit. |
| Their votes and bills | Open States bulk downloads, Voteview, GovInfo | In use. The bulk files already include every legislator, not just candidates. |
| Address → every district | Census geocoder | In use. Already returns U.S. House, State Senate, and State House districts, on the 2026 maps. |
| Governor, lieutenant governor, attorney general, secretary of state | Open States' GitHub data (`openstates/people`, `data/<state>/executive/`) | Checked Oct 16: **only these 4 offices** per state (Georgia, California, New York, Texas, Florida). New York's list also includes a Board of Elections co-director, who isn't elected, so the list needs filtering. |
| Other statewide officials (comptroller, treasurer, insurance, agriculture, labor, schools, Georgia's Public Service Commission...) | None found | Hand-entered from each state's official pages, with sources. A few people per state; changes after elections. |
| Election dates (primaries, runoffs, specials) | None confirmed free | Hand-entered from each state's official page, as now. Democracy Works is the paid option. Google's Civic Information API still has a free elections list (only its officials lookup was shut down, April 2025); worth checking whether it's complete enough to help. |
| State campaign money | New York only (data.ny.gov) | Other covered states have nothing simple. Federal money comes from the FEC. |

## What we've assumed (not confirmed yet)

- **Size.** Pages for every legislator in 7 states means about 1,240 state legislator pages (Georgia 236, New York 213, Illinois 177, Texas 181, Florida 160, Indiana 150, California 120) plus about 200 members of Congress. We assume the nightly job and the build can handle that. The vote lists already load per topic, so page size is fine; the build time and the nightly job's run time aren't measured yet.
- **Bills and votes for everyone use the same rules** as today's candidates (final-passage votes, bills they wrote). Yes, but it hasn't been run for every legislator.
- **Person page addresses stay the same.** Today a page's address comes from the name on the ballot (`/person/doris-matsui/`). Once officials come from roster data, the same person can have a slightly different name ("Doris O. Matsui"). We assume each person keeps one address, matched by their official ID, so shared links don't break.
- **The page style can stretch to the new pages** without a new look. The home page and the elections page don't exist in the prototype yet.
- **The layout can change itself with the calendar** (the owner's question in the roadmap). Yes: the site rebuilds every night, so each state page can check the date when it's built and put the right thing first (see below). The browser can fine-tune it on the day.
- **Between the election and January,** winners aren't in office yet. We assume state pages show current officials until the new terms start, then the nightly data catches up (Congress's data in early January; Open States soon after each state's swearing-in).

## What we're doing

### Pages and addresses

| Page | Address | What's on it |
|---|---|---|
| Home | `/` | What the site is, in a sentence. Find your officials (address box). Pick your state. Upcoming elections. Links to how elections work and the glossary. |
| State page | `/ga/`, `/ny/`, `/ca/`... | Who represents you in that state: U.S. senators, U.S. House members, statewide officials, state legislators. The ballot guide we have now becomes a section of this page, shown when an election is coming up. |
| Upcoming elections | `/elections/` | Every covered state's next elections and key dates, soonest first, each linking to its state page. |
| Find your officials | `/find/` | Type your address and see everyone who represents you, from Congress to the state legislature, each linking to their page. The current address lookup already finds all the districts. |
| Person page | `/person/<id>/` | As today: overview, how to reach them, campaign money, bills they wrote, how they voted. |
| How elections work | `/how-elections-work/` | Kinds of elections (general, primary, runoff, special), what each decides, why primaries and midterms matter. |
| Glossary | `/glossary/` | Real terms with one-line plain definitions. Terms used on other pages link here. |
| Sources and photo credits | `/sources/` | Every source the site uses and every photo credit, grouped in one place (owner, Oct 16). Replaces the footer's Sources and Photo credits dropdowns; every page's footer links here. Facts on cards still name their own source right where they appear. When built, update DECISIONS #6 (credits move from the footer dropdown to this page, which still gives the visible credit CC BY licenses need). |
| Site directory, 404, sitemap | as today | Updated for the new pages. |

### The page changes with the calendar

Each state page puts first what matters most right now, worked out each night when the site rebuilds:

1. **Election coming up (60 days ahead; owner, Oct 16):** the page is today's ballot guide, as it is now (masthead, 01 Mark your calendar, 02 Where do you live?, 03 Who's on your ballot), with the new header on top. The only addition is a short **04 Who represents you now** section at the end: a minimal list, "In Washington" (U.S. senators, your House member) and "In the state capital" (statewide officials, your state senator and representative), using the districts from step 02. No second address box, and no link to a page that doesn't exist during an election (owner, Oct 16).
2. **Election just happened (until a set date; owner, Oct 16):** a short note that the election happened and a link to the state's official results page. We don't show results ourselves. Officials first. Each election in the data gets a hard **take-down date**: the day the state certifies its results, from the state's official calendar (California: Dec 11, 2026, when the Secretary of State certifies the Statement of Vote). If no date has been entered, it comes down 30 days after the election. Upcoming take-down dates go on the owner's to-do list (`OWNER-TODO.md`, at the top of the project).
3. **No election soon:** 01 Where do you live? (the same address box and district pickers as the ballot guide), then one numbered section per level, matching the ballot guide: 02 Federal (both U.S. senators, then your House member), 03 State (statewide officials), 04 State lawmakers (your state senator and representative). Each level shows yours first, then an "All 14 / All 56 / All 180" list that opens underneath, so no one is listed twice (owner, Oct 16). Then 05 Next election.

### Which elections count (owner, Oct 16)

Any election that puts a **federal office, a state office, or a statewide ballot question** in front of voters in a covered state:

- The general election (November of even years).
- Primaries for those offices, and primary runoffs (Georgia and Texas have them).
- Special elections, like when a seat in Congress or the legislature opens up mid-term.
- Statewide-only elections, like California's November 2025 Prop 50 vote or Texas's odd-year votes on constitutional amendments.

Not covered: elections with only local offices or measures (city, county, school board). Each election's dates come from the state's official calendar and are entered by hand, with a source.

### Data changes

- A new **officials** file per state: everyone in office now, from Congress's data, Open States' roster, Open States' GitHub statewide list (filtered to elected offices), and a hand-entered file for the other statewide offices, each with a source.
- **Races stay separate** from officials. A race lists candidates; an official is a person in office. Someone can be both (an incumbent).
- **One ID per person** (official IDs first: Congress's bioguide ID, Open States' ID), so the page address never changes and records follow the person.
- **Records for every legislator,** not just candidates. The nightly job already downloads the bulk files with everyone in them.

### Design rules from the mockup review (owner, Oct 16)

- **One page width everywhere** (owner, Oct 16): every page, including state pages and the ballot guide inside them, uses the same width as the header (960px), instead of today's narrower 740px guide.
- **Header links line up with the page edges:** the first and last link sit flush with the edges, in line with the "Please Vote" title; only the space between links stays.
- **No missing lines.** Every box in a grid is fully ruled, including the last row: an unfilled spot at the end is closed in by the lines around it, never left open.
- **The state list is a multi-column grid** (owner, Oct 16), so 50 states stay short: each box has the state's name with its next election on the line under it.
- **Home page headline says plainly why you're here:** "Know your representatives" (the owner's choice; it works year round, not just at election time), with one line under it (the owner's edit): "Please Vote helps you keep track of who represents you in Washington and your state capital, and how they vote on the issues you care about."
- **No tacked-on, fragmented extra sentences** (like "Every fact links to where it came from."). Say the main thing once, plainly; sources show where the facts are.
- **Don't explain the site's own timing to visitors** (owner, Oct 16): no "this note comes down on..." lines. Things just appear and come down on schedule.
- **Every address box is the same component** (owner, Oct 16): the home page's "Find your officials" and each state page's "Where do you live?" look and work the same: the address with its button beside it, "We don't save your address.", a shaded "Your districts" bar, the district pickers, a note that the ZIP code sets the U.S. House member, and "Check my voter page". On the home page the district row starts with a State picker, and the voter page link goes to that state's page.
- **Address is never required** (owner, Oct 16): every "who represents you" box also lets people pick it themselves (ZIP code for U.S. House, dropdowns for the State Senate and State House districts), and links to the state's official voter page, where they can find their districts and sample ballot.
- **Every official listed gets their links** (owner, Oct 16): one row per person, with their page here ("Votes and bills", if they have one), official site, and campaign site, each only when a source gives it. The name itself isn't a link, so there's one link per destination.
- **No abbreviations in labels** (owner, Oct 16): "State Senate district", not "State Senate dist.". Today's guide uses "dist." and changes with the redesign.
- **Fields in a row line up:** inputs and dropdowns are the same height, and notes about one field go on their own line below the row so boxes stay even.
- **Runoffs and other state-specific details live on that state's page,** not the home page. The home page's upcoming elections list stays to the main elections.

### Copy

- Switch to the real terms the glossary defines: "Incumbent" instead of "Has the job now", and so on. Each term links to the glossary the first time it appears on a page.
- How elections work and the glossary need written content. Claude drafts it with a source for every fact, and the owner reviews it in the pull request (CLAUDE.md rule 3: nothing AI-written goes live without review).

### Build order inside the branch

Each step is one or more commits the owner can review on the branch preview.

1. **Structure:** the header link bar, the new home page, and Georgia moving to `/ga/`. No new data yet.
2. **Officials data** for the covered states, and state pages showing them.
3. **Person pages for every legislator,** with stable addresses. Check build time and nightly run time.
4. **Find your officials.**
5. **Upcoming elections** and the calendar-driven state pages.
6. **How elections work** and the **glossary**, plus the copy change to real terms.
7. **Feedback link** on every page.
8. Docs (`DESIGN.md`, `DECISIONS.md`, `README.md`, `ADDING_A_STATE.md`) updated to match.

Then the git history cleanup (see `docs/ROADMAP.md`).

## What we need

### Decisions from the owner

Answered Oct 16, 2026:

1. **Georgia's address:** `/` becomes the home page and Georgia moves to `/ga/`. The home page shows a clear "Pick your state" with Georgia in it, and remembers the last state a visitor used. **Agreed.**
2. **"Your ballot" first:** 60 days before an election, for every election that counts (see "Which elections count"). **Agreed.**
3. **How long the most recent election stays up:** until a hard take-down date per election (the state's certification date), 30 days if none is entered. Upcoming take-down dates go on the owner's to-do list. **Agreed.**
4. **Other statewide officials** (beyond the 4 that come automatically): hand-entered from each state's official pages, with sources. It's on the owner's to-do list and **never blocks** anything: a state without them just shows the 4 automatic ones. A paid source might automate this; that goes in the paid-data plan below.
5. **Pages for every legislator** (about 1,400 across 7 states): **yes.** Watch build time and nightly run time; revisit if it slows things down.
6. **Header labels:** Home, States, Elections, Find your officials, How elections work, Glossary. **Agreed.**
7. **Feedback email:** `vote@brianagude.com`.

Still open:

8. **Look of the new pages:** mockups first, approved before building (owner, Oct 16: yes). Draft mockups of the home page and a state page in both modes (election coming up, between elections): https://claude.ai/artifact/HsBbyfSNagG9XrASQH3e1f. Waiting on the owner's review.

### Things to prepare

- **Statewide officials list** for each covered state (owner's to-do list, not a blocker). Claude can gather candidates for the list from official pages for the owner to check.
- **Election dates after Nov 3** for each covered state (2027 specials, 2028 primaries), from each state's official calendar.
- **Glossary terms.** Claude drafts the list from words the site uses; the owner adds or removes.
- **Photos** for any newly elected officials who don't have one yet.

### Not needed (yet)

- No new paid data. Everything above uses the free sources already in use, plus hand entry.
- No new accounts or keys, unless the feedback link becomes a form (email setup) or a second Open States key is set up for testing.

## Paid data plan (to write later)

A separate plan, made after the redesign, for how and when to use paid data, and why. It should cover:

- **What each paid source would add**, checked with real quotes, not guesses. Candidates: Ballotpedia and BallotReady (full candidate data for every race, bios, possibly statewide officeholders), Democracy Works (election dates and polling places for every state), Cicero (officials at every level by address), and the Anthropic API (plain-language bill summaries, reviewed before publishing).
- **What a paid key would make possible:** less hand entry (statewide officials, election dates), coverage for all 50 states, and fewer gaps (like challengers' bios), and replacing Wikipedia-sourced backgrounds with official or verified sources.
- **When it's worth it,** and how it would be paid for (the donate idea on the roadmap).
- **Publishing it on the site:** a plain page saying what the site costs to run, what each paid source would buy, and how donations would be used.

Google's free Civic Information API used to list officials by address, but that part was shut down in 2025, so it isn't an option.
