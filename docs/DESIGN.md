# Design and copy spec

`prototype/index.html` is the source of truth for the look. This file records the decisions behind it and what the owner rejected, so they don't come back.

## Direction

The page should feel like a vintage printed form or label: ruled cells, small spaced-caps labels, a speckled paper texture, and one muted red used like a rubber stamp. It should be reserved and considered. The design must never get in the way of informing.

## Tokens (from the prototype)

**Colors**

| Token | Value | Use |
|---|---|---|
| paper | `#f2eee3` | Page background, with an SVG noise texture |
| card | `#f7f4ec` | Card background |
| race header shade | `#e8e2d4` | Race header rows |
| ink | `#2b2824` | Text and rules |
| soft | `#6d675d` | Secondary text |
| red | `#ad3f2c` | Accent only (darkened slightly from `#b3412e` on Oct 14, 2026 to pass contrast on the pink and header backgrounds) |
| red wash | `#efe0d6` | "Open now" date card |
| faded | `#857f73` | Passed dates, large text only (was `#a39d91`, which failed contrast). The small "Passed" label uses soft. |

Labels are ink at 68% opacity (raised from 55% on Oct 14, 2026 to meet 4.5:1 contrast).

**Type**

- **Display:** Archivo at 68% width, weight 700, uppercase.
- **Labels:** Archivo at 115% width, weight 500, 0.68rem, letter-spacing 0.2em, uppercase.
- **Body:** Instrument Sans.

**Red is reserved for urgent or time-sensitive items only:**
- Step numbers
- Countdown number
- "Open now" / "Coming up"
- The "Has the job now" stamp
- Link underlines

Everything else is ink.

## Layout (top to bottom)

1. **Masthead form:** the "General election" label and the title "Election Day Need-to-Know", with a "Days to go" cell holding the red number. Below them, a row with State, Election day, and Polls open.
2. **01 Mark your calendar:**
   - Date cards: 3 on the first row and 2 stretched across the second. On mobile, 2 per row and the last one spans the full width.
   - Status (Passed / Open now / Coming up / Upcoming) sits at the bottom of each card so they line up.
   - Below the cards is a "Registered? Know where you vote?" row with the only link to My Voter Page.
3. **02 Where do you live?:** the form. On the real site this becomes a single address field (Census Geocoder). The prototype uses ZIP plus two district dropdowns. Inputs have a dotted underline, and the ZIP placeholder is `#####`.
4. **03 Who's on your ballot:** collapsible sections (Federal, State, State lawmakers, Ballot question), all closed by default. Each closed section shows a one-line description and the list of races inside it.
   - **Steps 01 and 02 are never collapsible.** The owner doesn't want people skipping them.
   - **Race cards** sit flush inside a section, with no padding between them, separated by a 1.5px ink line. Each has a header row (Office + Term) in the darker shade, then a single "What they do" cell, then Candidates, then "Also handles".
   - **Candidate row:**
     - Photo or initials
     - Name, party (as text), and the "Has the job now" stamp
     - A one-line background
     - A short career list
     - "Committee work"
     - Links: Campaign site, Official site, Ballotpedia
5. **Footer:** date of the information and a collapsible Sources list.

## Rejected (don't reintroduce)

- Bright red/white/blue poster styling, huge bold blocky type, and "in your face" color.
- Monospace or typewriter fonts.
- Too many boxes, and padding or gaps between the race cards.
- A light serif design with no boxes. The owner hated it.
- Long fine print under the date cards and wordy intros.
- Links to voting-record websites as a substitute for showing records.
- Coloring candidates by party.

## Small screens

- 560px and under: "Find my ballot" is full width; section cards hide their list of offices, and Open/Close becomes a full-width bar along the bottom of the card.
- 480px and under: the masthead is a single column ("Days to go" above the number).
- 420px and under: candidate photo and name/party stay side by side; everything else folds under at full width.
- 375px and under: a race's Office and Term stack.

## Interaction

- Everything clickable shows a pointer cursor.
- Hover feedback is small: buttons lift 1px, link underlines drop slightly, "Campaign site →" links nudge right, and section headers shade. Movement is turned off when the device asks for reduced motion.
- Motion (the background people's line boil and a slow, soft "Open now" dot blink) runs continuously. A "Pause motion" text button in the footer toggles it and remembers the choice (WCAG 2.2.2). Everything is off, and the button hidden, for reduced motion.
- Running text uses `text-wrap: pretty` so lines don't end with a single orphaned word.
- `npm run test:a11y` checks WCAG 2.2 AA at desktop and 360px on every push.

## Copy rules

- **Voice:** a knowledgeable friend. Short sentences, plain words.
  - Bad: "A plain-language guide to…"
  - Good: "See the races, who's running, and what they do."
- **Every candidate fact must be:**
  - **Clear without context.** No bare vote percentages like "with about 73%".
  - **Explained.** Say what a committee covers, who someone lost to, and what an organization is.
  - **Sourced**, and not repeated between the one-line background and the career list.
- **Candidates are listed alphabetically by last name.** Party is shown as text only.
- **Office explanations** say what the job does and why it matters to you, in one combined block.
- **Don't** use emoji as markers.
