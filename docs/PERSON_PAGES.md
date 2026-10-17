# Person pages: plan (owner, Oct 17, 2026)

Build now, on its own branch, before Florida. Follows the modular rule in `CLAUDE.md`: one shared list component and one page layout, used everywhere.

## Decisions (owner, Oct 17)

1. **Everyone on any ballot gets a page.** All statewide and congressional candidates (about 350 across Georgia, New York, California, and Texas) and all state lawmaker candidates (1,284). A person with no voting record still gets how to reach them and campaign money where we have it.
2. **Long lists show 20 at a time,** with "Showing 1–20 of 139" and Previous / Next buttons. No carousels.
3. **Campaign site, Ballotpedia, and other sites move into "How to reach them"** in the Overview.
4. **Vote topics are A to Z,** with "Other" and local laws last (done Oct 17).
5. **Everyone gets a background line,** even if it's from Wikipedia (owner, Oct 17). Wikipedia is fine for background copy, cited as "Wikipedia" with the article link, but never for official information: who holds an office, dates, votes, bills, or money.

## What each page shows

| Section | Who has it |
|---|---|
| Name, party, photo, race | Everyone |
| Background (sourced bio, career) | Everyone we can find one for, from an official page, news, or Wikipedia (cited). Otherwise: "We don't have a sourced background for them yet." |
| How to reach them: campaign site, official site, Ballotpedia, office phone and address, email, contact form, official social accounts | Everyone with at least one link. Campaign sites for congressional candidates come from their FEC registration when the state's list has none (done Oct 17). |
| Campaign money | Congressional candidates (FEC); New York state candidates (state data). Other states' state-level money: later, per state. |
| Bills they wrote, How they voted | Current and recent lawmakers |

A section with nothing to show is left out, not shown empty.

## Steps

1. **Links into "How to reach them."** Move the campaign, official, and Ballotpedia links out of the bio block. Show the section whenever there's any link, not only when there's office contact info.
2. **A shared `Paged` list.** One component and one small script: 20 rows a page, "Showing 1–20 of N", Previous / Next buttons. Works with a keyboard, announces the new range to screen readers, and keeps focus on the list. Without JavaScript, every row shows. Replaces the current "Show more" cap. Used for: votes in each topic, bills they wrote, PAC and outside-group lists, the directory's groups, and any main-page list over 20.
3. **Pages for every statewide and congressional candidate.** Drop the "only people with bills or votes" rule in `personPages()`. The race cards link every name to its page.
4. **State lawmaker candidates.**
   - Give them IDs and a race label ("State House, District 50") in the shared candidate shape, so the same page layout works.
   - Run the votes, bills, and contact steps for sitting legislators on the ballot, not just people running for Congress or statewide.
   - Link each name in the State Senate and State House cards to their page.
   - The directory lists them under each state.
5. **A background for everyone.** Go through every candidate without a bio, in every state. Use an official or news page when one is easy to find, otherwise their Wikipedia article, cited. One or two plain sentences: what they do or did for work and any office they've held. If there's no article and nothing else, they keep "We don't have a sourced background for them yet." Same-name check: the article has to be about someone in that state and race.
6. **Size check before step 4 goes live.** Build with every page and confirm build time, total size, and file count fit Cloudflare's limits (about 20,000 files, 25 MB per file). Expected: about 1,600 pages, about a minute to build, and 150–200 MB, mostly vote files that only load when a topic is opened.
7. **Checks:** tests, build, the accessibility check (add a newcomer's page and a state lawmaker's page), and a look at 360px wide.

## Not changing

- Neutral order: candidates A to Z by last name, no party colors.
- Every line still needs a source; newcomers' pages stay short rather than filled with unsourced text.
