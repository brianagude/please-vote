# Roadmap

What's left and what's next, in rough order. Last updated Oct 14, 2026.

## Before Election Day (Nov 3)

1. **Confirm the first nightly data run.** GitHub → Actions → "Nightly data refresh". If it fails, the site keeps the last good data.
2. **Check the sample ballot** (owner) on My Voter Page for a 4th statewide question. One source mentioned a possible veterans' homestead tax break.
3. **Campaign money for statewide candidates** (22 people). Georgia's Ethics Commission has no download or API, so read each report by hand (Claude can do it with the Chrome extension connected) and record totals with links.
4. **Spot-check "became law" counts** against a second source, starting with Ossoff's "none".
5. **Seven hidden candidate facts** need sources, or stay hidden.
6. **Bills for former state legislators** (Harper, Waites). Open States v3 only lists current members.

## Phase 2

7. **Voting records and attendance** (DECISIONS #4 and #7).
8. **Plain-language bill summaries**, reviewed by the owner before publishing (DECISIONS #5). Needs the Anthropic key.

## After the election

9. **Officeholder pages.** Once results are in, show who holds each office and keep it updated with what they're doing: a page per person.
10. **Dec 1 runoff.** Decide whether to cover it if any race goes to a runoff.

## Growing the site

11. **More states.** The code is already organized by state (`data/states/<code>/`). Each state needs its own dates, offices, candidate list, and data sources checked. Certified candidate lists come in different formats per state, and some states don't publish one in a usable form.

12. **A "how elections work" page, possibly the new home page.** For people who mainly vote for president and don't think about other elections. It would cover:
    - The kinds of elections and when they happen: presidential, midterm, primary, runoff, special, and local and municipal elections.
    - What each one decides, and why it matters to you (for example, primaries often decide who really wins in districts that lean one way, and midterms pick most of Congress, governors, and state lawmakers).
    - Key dates on a calendar, by state.

    Open question: if this becomes the home page, the Georgia guide moves to its own address (for example `/ga`). Links already shared point to the current home page, so make the change after Nov 3, or keep a clear path from the home page to "your ballot".

13. **Use the real terms, with a small dictionary.** Teach the vocabulary instead of avoiding it, so people get used to seeing it. For example "Incumbent" instead of "Has the job now", plus terms like primary, midterm, runoff, district, constituent, PAC, sponsor, and ballot measure.
    - Each term links or expands to a one-line plain definition the first time it appears, and a glossary page lists them all.
    - Legal jargon in bill titles stays out of scope. Plain-language summaries (item 8) handle that.
    - This changes the copy rules in DESIGN.md ("plain words") and the stamp text. Update DESIGN.md when it's built.
