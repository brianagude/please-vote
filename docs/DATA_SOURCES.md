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
- **PSC District 5:** Thomas Blooming (L) is confirmed on the ballot by Ballotpedia News (Aug 10, 2026).
- **Snapshot age:** candidate lists were assembled from Wikipedia, WABE, Branch, and Ballotpedia. Re-verify against the Georgia Secretary of State's certified candidate list.
