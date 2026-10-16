# Roadmap

What's next, in three lists. Last updated Oct 15, 2026.

## Where the site is going (owner, Oct 15, 2026)

**The main goal: know who represents you, and see clearly what they're doing and how they're representing you.** A nonpartisan hub for elections and the people in office, not just a ballot guide for one election.

- **Scope:** federal and state only. No local offices (city, county, school board) for now.
- **Who gets what:**
  - Everyone who writes bills and votes on laws (members of Congress and state legislators) gets their own page.
  - Everyone else (governors, other statewide officials, challengers) gets a card on their state's page.
- **Elections:** show upcoming elections for each state. No past election results. The most recent election's data can stay up for a short while afterward, then come down.

**Site layout (to build after Nov 3):**
Question: Could the page layout be automated? like, if there is currently an election show x, if an election is coming up soon show y, if no election prioritize z. 
- **A header or top link bar** on every page: Home, States, Upcoming elections, Find your officials, How elections work, Glossary.
- **Home page:** a section pointing to everything you can do on the site: state pages, upcoming elections, finding your officials, how elections work, and the glossary.
- **State pages:** everyone in office now (U.S. senators and representatives, statewide officials, state legislators), and who's up for re-election. Same style of cards as today. The current ballot guide becomes part of this, shown when an election is coming up.
- **Upcoming elections:** each state's next elections (general, primaries, runoffs, special elections), what's on the ballot, and the key dates.
- **Find your officials:** type your address, see everyone who represents you, with a link to each person's page. The address lookup we have today already finds all the districts.
- **Person pages:** as today (overview, campaign money, bills they wrote, how they voted), for everyone who writes bills and votes.
- **How elections work:** its own page (kinds of elections, what each decides, why primaries and midterms matter).
- **Glossary:** its own page, linked in the header. Use the real terms (e.g. "Incumbent" instead of "Has the job now"), each with a one-line plain definition. This changes the copy rules in DESIGN.md when it's built.
- **"Does something look wrong or missing?"** A small box or link on pages so people can tell the owner. Start with an email link (no setup); a form that emails the owner would need a Cloudflare email setup.
- **Moving the Georgia guide:** if the home page changes, the Georgia guide moves to `/ga/`, with the old address still leading there so shared links keep working.

**Where the data comes from:**
- **Members of Congress:** congress-legislators (all 50 states, no key).
- **State legislators:** Open States (all 50 states).
- **Governors and other statewide officials:** Open States' GitHub data (`data/<state>/executive/`, all 50 states, no key).
- **Election dates:** no free official feed. Either hand-entered from each state's official page (a few dates per state, a few times a year) or Democracy Works (paid).
- **Candidates for each election:** each state's certified list, downloaded by hand, as now.
- Note: If a chalenger gets elected, use their new official photo and remove the one we sourced.

## To do now

1. **Photos** for candidates without one (owner): Georgia is done; 17 left in New York.
2. **Check the first nightly run with New York**, including that the bills step (now on bulk downloads) regenerates everything correctly.
3. **Submit the sitemap** to Google Search Console (owner, with Claude's help).
4. **Testing and tooling** (branch `cleanup-and-optimize`):
   - A local copy of everything downloaded during work sessions, so re-running a data step doesn't ask Open States again.
   - Run one state at a time (`npm run data -- bills --state ny`).
   - Test the data logic against small saved samples instead of live runs.
   - A GitHub check on every pull request: tests, build, and the accessibility check.
5. **Next state:** California, then Texas, Indiana, and Illinois. One at a time, each with certified candidates, dates, bios, and records, checked like New York.

## Bigger picture (after the election)

- **The hub layout above:** header, home page, state pages, upcoming elections, find your officials, person pages for everyone who writes and votes on laws.
- **How elections work** page and the **glossary**.
- **Clean up the git history** (with the new layout): squash main's older one-off commits into a few clear ones, so the history reads as one commit per finished piece of work plus the nightly refreshes. It overwrites main (a force push, which redeploys the live site), so do it after Nov 3, and only after any open branches are merged or restarted from the new main. Claude writes the steps; the owner runs them. From Oct 16 on, pull requests are squash-merged, so new history is already clean.
- **Dec 1 runoff:** decide whether to cover it if any race goes to a runoff.
- **A donate section** (once the hub is live): ask readers to help pay for the paid data, and say plainly what it buys: full candidate data for every race and state (Ballotpedia, BallotReady), election dates and polling places for every state (Democracy Works), and the plain-language bill summaries (Anthropic API).

## Later

**Records:**
- **Seven hidden candidate facts** (Kingston, Day, Kozycki, Harris, McBath career line, Blooming) stay hidden until each has a source.
- **Bills for former state legislators** (Harper, Waites). Open States only lists current members.
- **Spot-check other "became law" counts** against Congress.gov.
- **Plain-language bill summaries**, reviewed by the owner before publishing (DECISIONS #5). Needs an Anthropic API key.
- **More for person pages:** all their committees (not just titled roles), bills they co-signed, outside spending for or against them, and personal financial disclosures and stock trades (House Clerk PDFs; the Senate's site blocks automated downloads).
- Not planned, because they turn into ratings: ideology scores, interest-group ratings, "votes with their party" percentages.

**Data plumbing:**
- **Legislature rosters from Open States' public GitHub data** (`github.com/openstates/people`, no key, no limit) instead of the API. The roster is the biggest remaining API use (one request per 50 legislators). Switching would bring each state to about 4 requests a night, enough for all 50 states. Now each state uses about 8–12 a night, and the limit is 250 a day.

**Maybe later: not a simple pull from a data source** (owner, Oct 15, 2026: if it can't be pulled from an API and easily checked, leave it out for now):
- Mayors of state capitals (their races and a card for each). No free data feed, so they'd be hand-entered.
- Local ballot questions and races (city, county, school board), e.g. the 5 New York City Charter questions. They differ by city, so they'd need ballot data for every city and county (paid services like Ballotpedia or BallotReady).
- Judge races.
- Campaign money for Georgia's statewide candidates. Georgia's Ethics Commission has no API or download.
- Outside spending in state races. The FEC only covers federal races.
- Kept anyway (owner, Oct 15): statewide ballot questions (the same for every voter in the state, checked against a sample ballot) and hand-written candidate bios (each line sourced). Certified candidate lists, dates, and office descriptions are core to the site.

**Dropped (owner, Oct 15):** past election results. Only the most recent election's data stays up, for a short while.

## Done

- **Oct 14–15:** the Georgia guide (dates, address lookup, every race, candidates with sourced facts, campaign money, bills, nightly data job). Sample ballot and Ossoff's "none became law" checked.
- **Oct 15, `states-and-voting-records`:** voting records and attendance; person pages with contact info, every bill and how far it got, PACs, and outside spending.
- **Oct 15, `more-states`:** New York (certified candidates, bios, records, legislature votes, state campaign money), the state picker, per-state crowds and link previews, site directory, 404 page, sitemap, and robots.txt.
- **Oct 15:** vote lists on person pages load per topic when opened (both terms kept, owner); the longest page went from 3 MB to 92 KB.
- **Oct 15:** the bills step moved to Open States' bulk downloads (one API request per state per night), with Georgia's sponsor order and vetoes fixed.
