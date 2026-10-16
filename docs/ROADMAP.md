# Roadmap

What's left and what's next. Last updated Oct 15, 2026.

This is an ongoing project. The Georgia guide stays as-is through Election Day (Nov 3). New work happens on a separate branch and launches after the election.

## Done

- First nightly data run (Oct 15).
- Ossoff's "none became law" checked on Congress.gov: 90 bills since 2023, none became law.
- Sample ballot checked (Oct 15): only the 3 statewide amendments already on the site. No veterans' question. Ballot wording and all 24 statewide and congressional candidate names match the site.

## Done in `states-and-voting-records` (merged Oct 15)

Built off to the side so the live Georgia guide isn't touched. Launches after Nov 3.

1. **Voting records and attendance** (DECISIONS #4 and #7). How each officeholder voted on bills that passed, grouped by topic, and how many votes they missed. The owner's top priority.
   - **Done (Oct 15):** nightly votes and attendance, and a page for each candidate with bills or votes (`/person/<id>/`).
   - **Done (Oct 15):** on those pages, how to reach them, every bill they wrote with how far it got, and which PACs gave and which outside groups spent for or against them.
## Now: branch `more-states`

2. **More states.** The code is already organized by state (`data/states/<code>/`). Each state needs its own dates, offices, candidate list, and data sources checked. Certified candidate lists come in different formats per state, and some states don't publish one in a usable form, so states are added one at a time (owner, Oct 15).
   - **Order:** New York, California, Texas, Illinois, Indiana.
   - **Before Nov 3, each state gets:** key dates and its "check your registration" link; U.S. Senate (if up) and U.S. House races with person pages for incumbents; statewide offices and ballot questions; and current state legislators by district (full legislative candidate lists later).
   - **Switching states:** the "State" box in the masthead becomes a dropdown. Georgia stays at `/` so shared links keep working; other states live at `/<code>/` (e.g. `/ny/`). A state-picker home page waits until after the election.

## The bigger picture (ongoing)

The long-term goal: a place to check in any time, not just before one election.

3. **What's coming up.** Which elections are next where you live, what each one is for, and key dates.
4. **A page for every candidate and officeholder.** A quick, simple snapshot of who they are and what they're doing, pulled from trusted APIs (Congress.gov, Open States, FEC, state sources) and kept up to date. Same rules as the guide: sourced, neutral, plain language.
5. **A "how elections work" page, possibly the new home page.** For people who mainly vote for president and don't think about other elections. It would cover:
    - The kinds of elections and when they happen: presidential, midterm, primary, runoff, special, and local and municipal elections.
    - What each one decides, and why it matters to you (for example, primaries often decide who really wins in districts that lean one way, and midterms pick most of Congress, governors, and state lawmakers).
    - Key dates on a calendar, by state.

    If this becomes the home page, the Georgia guide moves to its own address (for example `/ga`). Links already shared point to the current home page, so make the change after Nov 3 and keep a clear path from the home page to "your ballot".
6. **Use the real terms, with a small dictionary.** Teach the vocabulary instead of avoiding it, so people get used to seeing it. For example "Incumbent" instead of "Has the job now", plus terms like primary, midterm, runoff, district, constituent, PAC, sponsor, and ballot measure.
    - Each term links or expands to a one-line plain definition the first time it appears, and a glossary page lists them all.
    - Legal jargon in bill titles stays out of scope. Plain-language summaries (below) handle that.
    - This changes the copy rules in DESIGN.md ("plain words") and the stamp text. Update DESIGN.md when it's built.
7. **Dec 1 runoff.** Decide whether to cover it if any race goes to a runoff.
8. **A donate section** (after the site goes live in full). Ask readers to help pay for the paid data, and say plainly what the money would buy: full candidate data for every race and state (Ballotpedia, BallotReady), election dates and polling places for all states (Democracy Works), and the AI bill summaries (Anthropic API).

## Later

- **Campaign money for statewide candidates** (22 people). Georgia's Ethics Commission has no download or API, so read each report by hand (Claude can do it with the Chrome extension connected) and record totals with links.
- **Seven hidden candidate facts** (Kingston, Day, Kozycki, Harris, McBath career line, Blooming). They stay hidden until each has a source.
- **Bills for former state legislators** (Harper, Waites). Open States v3 only lists current members.
- **Spot-check other "became law" counts** against Congress.gov.
- **Past election results on the person pages.** The owner downloads official results from the Georgia Secretary of State by hand (the site blocks automated downloads) into `data/states/ga/sources/results/`: the Nov 2020 general, Jan 2021 runoff, Nov 2022 general, Dec 2022 runoff, and Nov 2024 general, then each new election. A script turns them into each person's past races, checked against totals we've already confirmed (Ossoff 2020: 2,374,519). Automatic sources were checked and rejected: OpenElections is missing counties in some files, MIT's House data requires agreeing to terms, and the FEC's 2024 file is blocked.
- **Maybe later: things that aren't a simple pull from a data source** (owner, Oct 15, 2026: if it can't be pulled from an API and easily checked, leave it out for now):
  - Local ballot questions and races (city, county, school board), e.g. the 5 New York City Charter questions. They differ by city, so they'd need ballot data for every city and county (paid services like Ballotpedia or BallotReady).
  - Judicial races (State Supreme Court, Civil Court, Surrogate's Court, etc.).
  - Campaign money for Georgia's statewide candidates: Georgia's Ethics Commission has no API or download.
  - Outside spending in state races (super PACs spending on state candidates). The FEC only covers federal races.
- **More for the person pages** (owner: maybe later):
  - All their committees, not just the ones where they hold a title.
  - Bills they co-signed (cosponsored).
  - Outside spending for or against them (FEC independent expenditures).
  - Personal financial disclosures and stock trades (House Clerk PDFs; the Senate's site blocks automated downloads).
  - Not planned, because they turn into ratings: ideology scores, interest-group ratings, "votes with their party" percentages.
- **Plain-language bill summaries**, reviewed by the owner before publishing (DECISIONS #5). Needs an Anthropic API key.
