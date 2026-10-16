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

## Person pages: contact, bill status, donors, past results (checked Oct 15, 2026)

- **Contact, Congress:** `legislators-current.json` (last term: `phone`, `address`, `contact_form`, `url`) and `legislators-social-media.json` (twitter, facebook, instagram, youtube). No key.
- **Contact, Georgia legislators:** Open States `/people?id=...&include=offices` gives the Capitol office phone and address, plus `email`.
- **How far each federal bill got:** GovInfo BILLSTATUS. **Read only the bill's own `<actions>`.** The file also lists related bills with their own latest actions; reading the whole file wrongly marked 6 of Ossoff's bills as laws (a related bill, the 2024 defense bill, became law).
- **How far each Georgia bill got:** passage votes in the General Assembly vote files the votes step saves, plus Open States' "became law" action.
- **PACs that gave to the campaign:** `/candidate/{id}/committees/?designation=P` (the main campaign committee), then `/schedules/schedule_a/?committee_id=...&line_number=F3-11C&two_year_transaction_period=2026` (keyset paging with `last_index` and `last_contribution_receipt_amount`), keeping `entity_type` PAC and adding up per PAC. Filed with `is_individual=false` alone, the list also has ActBlue and Democracy Engine (individual donations passed along) and transfers from the candidate's own committees, which aren't PAC money.
- **Outside spending (super PACs and other groups):** `/schedules/schedule_e/by_candidate/?cycle=2026&election_full=false`, per group, for (S) or against (O). With `election_full=true`, a senator's list reaches back to the 2021 runoff, so we use the current two years only. Super PACs can't give to campaigns; this is their own spending.
- Tried and dropped (owner, Oct 15): small-donor share (`by_size`) and in-state share (`by_state`). `/schedules/schedule_b/by_purpose/` (what campaigns spend on) isn't usable: most spending is filed as "OTHER" (75% for McBath).
  - **Rate limit: about 60 requests a minute** (`x-ratelimit-limit: 60`). The money step waits about 1 second between requests.
- **Past election results (not built yet):**
  - **OpenElections** (`github.com/openelections/openelections-data-ga`): Georgia results as CSV, covering Congress and the legislature. 2020 general matched official totals exactly (Ossoff 2,374,519). But the Jan 2021 runoff file is missing 4 of 159 counties (Ossoff 2,254,592 vs. 2,269,262 official), so it can't be trusted without a check.
  - **MIT Election Lab** on Harvard Dataverse: U.S. Senate 1976–2024 downloads freely. **U.S. House requires filling in a "guestbook" form** (terms) before download.
  - **FEC official results spreadsheets** (`fec.gov/resources/cms-content/documents/federalelectionsYYYY.xlsx`): 2018–2022 download; 2024 returns 403.
  - **Georgia Secretary of State** results: blocks automated access, like the candidate list.

## Open States limits (Oct 15, 2026)

- **The free API key allows 250 requests a day** (`{"detail":"exceeded limit of 250/day"}`). Testing used it up on Oct 15. With more states, the nightly job has to stay under it. Lean on the bulk downloads instead (`data.openstates.org/csv/latest/...`, no key, not counted) wherever possible.

## New York (checked Oct 15, 2026)

- **Certified candidates:** the State Board of Elections' "Certification for the November 3, 2026 General Election" PDF (Sept 17, 2026, 136 pages), linked from `elections.ny.gov/ballot-certifications-elections`. **elections.ny.gov blocks automated access (HTTP 403)**, like Georgia's site, so the owner downloads it by hand into `data/states/ny/sources/`. The Board can issue amended certifications; check for a newer one.
- **Dates:** New York Attorney General, `ag.ny.gov/election-key-dates` (reachable):
  - Register by Sat, Oct 24. That's also "Golden Day": register and vote early the same day.
  - Early voting Oct 24–Nov 1.
  - Mail or early mail ballot: request online or by mail by Oct 24, or in person by Nov 2. Postmark by Nov 3; the county must receive it by Nov 10.
- **Poll hours:** 6 a.m.–9 p.m. (State Board of Elections home page, via search; the page itself blocks us).
- **Races in 2026:**
  - Governor and lieutenant governor (one joint vote in November), attorney general, comptroller.
  - All 26 U.S. House seats, 63 State Senate seats, and 150 Assembly seats.
  - No U.S. Senate race: Schumer's term runs to 2028 and Gillibrand's to 2030.
  - No statewide ballot questions confirmed yet.
- **Fusion voting:** a candidate can run on several party lines (e.g. Democratic and Working Families). The `party` field holds the full list as text.
- **Congressional map:** a state judge ordered NY-11 redrawn (Jan 21, 2026), but the U.S. Supreme Court stayed that order on March 2, 2026, so the current map is used. ZIP-to-district is from `us-zipcodes-congress` (119th Congress maps): 1,826 ZIPs, 345 split.
- **Voter lookup:** `voterlookup.elections.ny.gov`.

## New York state campaign money (checked Oct 15, 2026)

- **Source:** data.ny.gov "Campaign Finance Disclosure Reports Data: Beginning 1999" (`e9ss-239a`, Socrata, no key; filer list `7x2g-h32p`). It's every itemized transaction from the State Board of Elections' filings, current through the 32-day pre-general report (Sept 28, 2026). The Board's own site (`publicreporting.elections.ny.gov`) blocks automated access.
- **Built by `pipeline/nymoney.ts`** for statewide candidates. Each candidate's committee is set by hand as `ids.nysboe` in `races.json` (filer IDs checked against the filer list):
  - Hochul 16851, Blakeman 580499 (his governor committee, not "Blakeman for Nassau"), DiNapoli 308716, Hernandez 569719, James 308810, Komatireddy 580355.
- **What's counted:**
  - Donations: monetary contributions plus LLC/partnership contributions.
  - Spent: "Expenditures/ Payments" plus "Qualified Expenditures". Committees in the public campaign finance program report spending under the second one, so Blakeman shows $8,000 without it.
  - Public matching funds ("Public Fund Receipts") and transfers in are shown on their own lines, not as donations.
  - No cash-on-hand figure: the transactions don't give a starting balance.
- **Amendments:** the dataset keeps only the amended version of an amended report (`r_amend = Y`, with no original rows), and the code also keeps only amended rows when both exist.
- **Checked:** Hochul's July 2026 periodic report adds up to $5.88M; news reported "$5.8 million since January." City & State's ~$11.4M for Blakeman by July likely includes public funds and transfers, which we show separately.
- **Data quirk:** one transaction is dated 2027 (Komatireddy); dates in the future are ignored.

## Bills they wrote, from bulk downloads (checked Oct 15, 2026)

- **State legislators' bills now come from the Open States bulk CSV** (`pipeline/osbulk.ts`, shared with the votes step), not the API. That's one API request per state per night (the session list) instead of paging through every person's bills.
- **Author:** the bulk CSV has no sponsor order. New York marks exactly one primary sponsor per bill (0 of 25,518 bills have more), so that's used directly. Georgia marks every sponsor "primary", and the CSV's row order doesn't always match the official order (SB 135, 2023: Kay Kirkpatrick is first, not Brian Strickland). So for Georgia the author is sponsor #1 ("Sequence" 1) from the General Assembly's `GetLegislationSearchResultsPaged`. That's matched to Open States people through the `legis.ga.gov/members/...` link Open States keeps for each legislator.
- **How far it got:**
  - New York: the bill's actions in the bulk CSV ("passage" by chamber, "executive-veto", "became-law"/"executive-signature"). Checked S 8938 against nysenate.gov.
  - Georgia: recorded passage votes (as before), because Open States marks some Georgia actions as "passage" that weren't (SB 28, 2025, was reported out of committee and then recommitted).
  - Georgia laws vs. vetoes: Georgia's own `ActVetoNumber` ("631" = became law; "V12" = vetoed). Open States labels a Georgia veto as an "executive-signature" (SB 569, 2026, was vetoed).
- Checked against the old API results for every Georgia legislator, both sessions: the same bills and counts, with three statuses now more accurate (SB 569 Vetoed, SB 572 Became law, SB 371 Passed the Senate).
- New status: **"Vetoed"** (passed both chambers; the governor rejected it).
