# Data sources

Status as researched October 13–14, 2026. Verify each source before relying on it. Items marked **unverified** were not tested.

## Dead sources (don't use)

- **Google Civic Information API, Representatives endpoint:** shut down April 30, 2025.
- **ProPublica Congress API:** discontinued.

## Free sources

| Need | Source | Key? | Notes |
|---|---|---|---|
| Address → U.S. House, State Senate, and State House districts | Census Geocoder: `geocoding.geo.census.gov/geocoder/geographies/onelineaddress`, layers "Congressional Districts", "State Legislative Districts - Upper", "State Legislative Districts - Lower" | No key mentioned in docs (unverified) | Browser CORS support is unverified, so call it from a server function. |
| ZIP → U.S. House district (fallback) | `github.com/OpenSourceActivismTech/us-zipcodes-congress` (`zccd.csv`) | No | Built from 2020 Census blocks and 119th Congress maps. 213 of 751 Georgia ZIPs span more than one district. Already in `data/ga-zip-to-congressional-district.json`. |
| Members of Congress, IDs, terms, committees | `github.com/unitedstates/congress-legislators` (`legislators-current`, `committee-membership-current`, `committees-current`) | No | YAML/JSON/CSV. Use the `bioguide` ID as the primary key. |
| Congress photos | `github.com/unitedstates/images` (`congress/225x275/{bioguide}.jpg`) | No | Public domain. Some new members are missing, e.g. F000485 (Fuller) and B001328 (Blair). |
| Bills, sponsors, summaries, members | Congress.gov API v3: `api.congress.gov/v3` (`/member`, `/bill`, `/member/{id}/sponsored-legislation`) | Yes (free, api.congress.gov/sign-up) | A third-party project reports a limit of 5,000 requests/hour per key. |
| House roll-call votes, per member | Congress.gov API `/house-vote/{congress}/{session}/{roll}/members` | Same key | Beta. Covers votes from 2023 (118th Congress) onward. |
| Senate roll-call votes | senate.gov XML: roll call vote lists and individual votes (see `senate.gov/general/XML.htm`) | No | |
| State legislators, bills, votes | Open States API v3: `v3.openstates.org` (`/people`, `/people.geo`, `/bills`) | Yes (free) | Also has bulk data. Person records include Ballotpedia and Vote Smart source URLs. |
| State legislator roster (no key) | `github.com/openstates/people` (`data/ga/legislature/*.yml`, `data/ga/executive/*.yml`) | No | Used for the snapshot. |
| Federal campaign finance | OpenFEC: `api.open.fec.gov/v1` (`/candidates`, `/candidate/{id}/totals`) | Yes (api.data.gov) | A candidate appears only after raising or spending over $5,000. |
| Free-licensed photos | Wikimedia Commons API | No | Filter by license (see DECISIONS #6). |
| Bill summary shortening | Anthropic API | Yes | Used only in the nightly job. Output goes to the review queue. |

## Paid (get quotes, not in v1)

- **Ballotpedia** data (developer.ballotpedia.org): candidates, officeholders, and campaign themes. Annual subscriptions; contact data@ballotpedia.org.
- **BallotReady** (GraphQL API and data exports): every race on a voter's ballot, candidate profiles, and officeholders.
- **Democracy Works Elections API:** election dates, deadlines, and polling/early-voting/drop-off locations. All 50 states + DC for the 2026 general.

## Useful for verification (no API, read by hand)

- **Branch** (branch.vote) and **BallotReady** candidate pages: verified campaign websites.
- **Ballotpedia** profiles: career facts.
- **Georgia Election Guide** (georgia.gov/georgia-election-guide): dates, ID rules, and poll hours.
- **My Voter Page** (mvp.sos.ga.gov): each voter's own registration, polling place, and sample ballot. Linked from the site; there's no public API that we know of.

## Georgia facts used in the prototype (source: Georgia Election Guide)

- Registration deadline: Oct 5
- Early voting: Oct 13–30
- Mail ballot application must be received by: Oct 23
- Mail ballot must be received by: 7 p.m. Nov 3
- Polls: 7 a.m.–7 p.m.
- Runoff: Dec 1
- Photo ID required

## Known data issues to resolve

- **Bárbara Rivera Holmes:** Ballotpedia's dates conflict (it lists a 2024 start and a 2025 appointment). The site shows "appointed by Gov. Kemp in 2025" (Wikipedia).
- **Ceretta Smith:** the Ballotpedia profile's military history couldn't be matched to the Grovetown council member with certainty, so it isn't shown.
- **Ballotpedia blocked automated checks** for Hank Johnson, Nikema Williams, Lucy McBath, Clay Fuller, Shawn Harris, Tony Kozycki, and Matt Day. Their profiles likely exist but weren't verified, so they have no link yet.
- **No Ballotpedia profile found:** Jim Kingston and Thomas Blooming.
- **No campaign site found:** Thomas Blooming and Jim Kingston.
- **GA-14:** Andrew Underwood (L) and Rob Ruszkowski (I) were removed. They ran in the March 2026 special election, and Branch and The Ballot Brief list only Fuller and Harris for November.
- **PSC District 5:** Thomas Blooming (L) was reported by Ballotpedia News (Aug 10, 2026) but is **not** on the Secretary of State's certified list, so he was removed (Oct 14, 2026).
- **Snapshot age:** checked Oct 14, 2026 against the Secretary of State's certified list (`data/states/ga/sources/`). All statewide and U.S. candidates, parties, and incumbents match; names now use the ballot spelling. The list has no ballot questions, so the farm and timber amendment is still unconfirmed.

## Verified by calling them (Oct 14, 2026)

- **Census Geocoder:** works, no key. Sends no CORS headers, so browsers can't call it; the Cloudflare function does. Layer names include a year/Congress number ("120th Congressional Districts", "2026 State Legislative Districts - Upper") and layer IDs change between vintages, so we request `layers=all` and match names.
- **One api.data.gov key covers both Congress.gov and OpenFEC.** Stored as `DATA_GOV_API_KEY`. Limit: 1,000 requests/hour (DEMO_KEY: 40/hour).
- **Congress.gov:** works, but slow from some networks (30–95 seconds per request). The job allows 3 minutes per request.
- **OpenFEC:** `/candidate/{id}/totals/?cycle=2026&election_full=true` works. Latest processed reports run through June 30 or Sept 30, 2026 depending on the campaign; the site shows each one's date.
- **Open States v3:** works with key (`X-API-KEY` header). `per_page` max is 20. `/people` returns current members only (former legislators like Tyler Harper aren't returned). Georgia marks every sponsor as "primary"; the first listed sponsor is the author, so "bills they wrote" counts only first-listed.
- **congress-legislators, unitedstates/images, Wikipedia, Wikimedia Commons:** work, no key. Commons gives license and author per file.
- **Georgia Secretary of State (sos.ga.gov, elections.sos.ga.gov):** blocks all automated access (HTTP 403), including PDFs. The certified candidate list has to be downloaded by hand.
- **Senate District 12:** no current member in Open States (Freddie Sims's term ended April 8, 2026). The site says it couldn't confirm the seat.

## Voting records (verified Oct 15, 2026)

Built by `pipeline/votes.ts` into `generated/votes.json`. Rule: DECISIONS #4.

- **U.S. House and Senate: Voteview** (`voteview.com/static/data/out/{votes,rollcalls,members}/{H|S}{congress}_*.csv`, UCLA, no key). Republishes every official roll call, with each member's bioguide ID. Three downloads per chamber per Congress; the whole federal step runs in seconds. Current to within a few weeks.
  - Checked against Congress.gov's `/house-vote/.../members`: 112 of 112 Georgia member votes matched.
  - Voteview leaves out quorum calls and records Speaker elections properly. Counting straight from the Clerk's files would wrongly mark members as missing those.
  - `vote_question` "On the Motion" (Senate) doesn't say what the motion was. We count it as "agree to the House's changes" only when the bill's history (below) names that Senate record vote as a concurrence.
- **House Clerk (`clerk.house.gov/evs`) and senate.gov roll-call XML:** both work at first, then block automated downloads (HTTP 403 / "Access Denied") after a few hundred requests. Don't use them in the nightly job.
- **Congress.gov `/house-vote`:** works (House only, no Senate endpoint). Good for spot checks; slow for bulk.
- **Federal bill topic and status: GovInfo BILLSTATUS** (`govinfo.gov/bulkdata/BILLSTATUS/{congress}/{type}/BILLSTATUS-{congress}{type}{number}.xml`, no key). Gives Congress.gov's "policy area" (our topic), whether it passed each chamber, and whether it became law. Fast.
- **Georgia: Open States bulk CSV** (one zip per session, linked from `/jurisdictions/ga?include=legislative_sessions` → `downloads`). About 60 MB, downloads in seconds. Has every recorded vote and how each member voted, by Open States person ID.
  - **Open States labels every Georgia vote "passage"**, including amendment votes and batch votes on local bills. Its `motion_text` is just "Senate Vote #26".
  - Open States can't tell members with the same last name apart (David Clark and Jasmine Clark are both "CLARK", with no person ID).
  - Bill subjects come from Georgia's subject index; about 60% of voted-on bills have one. Most of the rest are local acts ("Savannah, City of; ..."), grouped as "Local laws".
- **Georgia General Assembly vote service** (`webservices.legis.ga.gov/GGAServices/Votes/Service.svc`, SOAP, no key). `GetVotes(Branch, SessionId)` lists every vote with its real caption ("PASSAGE BY SUBSTITUTE", "ADOPTION OF AMENDMENT #1"), so we join it to Open States by chamber and vote number. `GetVote(VoteId)` names each member with their district ("CLARK, 108TH"); we use it for anyone Open States didn't match. Session IDs come from `Session/Service.svc` `GetSessions`. Morning roll calls aren't published.
  - Checked 12 of Josh McLaurin's votes against `GetVote`: all matched.
  - Georgia records "Excused" separately from "Not Voting". We show both as "Didn't vote".
