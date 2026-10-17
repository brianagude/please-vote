# Owner to-do

Things only you can do, or that need your call, with dates. Claude keeps this list current: it adds items as they come up and checks them off when they're done. Last updated Oct 16, 2026.

## Every week

- [ ] **Check the nightly data job ran.** On GitHub, open the repo's **Actions** tab and look at "Nightly data refresh". Every night should have a green check. A red X means a source failed. That's usually fine for one night (yesterday's data stays up), but if it's red two nights in a row, tell Claude.
- [ ] **Look at the live site once,** on your phone: https://vote.brianagude.com. Check that the countdown is right and that nothing looks broken.

## Dates coming up

### Before Nov 3, 2026 (election day)

- [ ] **Merge `california`.** Claude finished it on Oct 17. Open the pull request, wait for the green check, and merge (squash). Then make a new `florida` branch from main for the next state. California's missing photos can come later; they don't block the merge.
- [ ] **Photos** (see the list below), as many as you can before people use the guides.

### Nov 4, 2026: the day after the election

- [ ] **Look at each guide** (Georgia `/`, New York `/ny/`, California `/ca/`). The countdown should say "Done / Thanks for voting". Everything else stays up for now.
- [ ] **Georgia runoff:** check whether any Georgia race goes to a Dec 1 runoff (the Secretary of State posts results at https://results.sos.ga.gov). Then decide if the site covers it, and tell Claude.

### Nov 20, 2026: Georgia certifies its results

- [ ] Georgia's take-down date for the Nov 3 election (by law, 17 days after it). After this the Georgia ballot guide can come down. Nothing to do until the redesign does this automatically; until then, tell Claude when you want each guide replaced with an "election's over" note.

### Dec 1, 2026: Georgia runoff (if there is one)

- [ ] Only if you decided to cover it on Nov 4.

### Dec 7, 2026: California's new legislators take office

- [ ] **Check, about a week later:** open 3 California State Senate or Assembly seats that changed hands. The "Has the seat now" name should be the new member. If it isn't by Dec 21, tell Claude (Open States sometimes takes a while to update). *(Date from California's rule, the first Monday in December; confirm when it's close.)*

### Dec 10, 2026: New York's results are final

- [ ] New York's take-down date: the deadline for counties to send certified results to the state. Same as Georgia's.

### Dec 11, 2026: California certifies its results

- [ ] California's take-down date (the Secretary of State certifies the Statement of Vote).

### Jan 3, 2027: the new Congress starts

- [ ] **Check, about a week later:** the members of Congress on each state page should be the winners. Congress's data usually updates within days.
- [ ] **New members' photos:** if a challenger won, their official portrait replaces the photo you sourced, once it's published (often a few weeks later). Tell Claude when you notice one is still showing the old photo.

### Jan 6, 2027: New York's legislature starts · Jan 11, 2027: Georgia's

- [ ] **Check, about a week later:** same as California's: 3 seats that changed hands should show the new member. *(Dates from each state's rule for its first day, the first Wednesday after the first Monday in January for New York and the second Monday for Georgia; confirm when they're close.)*

## Now

- [ ] **Photos: 71 people.** Drag the image files into the chat, with the person's name and the page each one came from. Claude crops and adds them.
  - **New York (17):**
    - NY-10 Jennifer E. Moore (you couldn't find one yet)
    - NY-13 Jomo M. Williams
    - NY-14 Diamant Hysenaj
    - NY-15 Stylo Sapaskis, Gonzalo Duran, Andre Easton, Jose Vega
    - NY-16 Joseph J. Cinquemani
    - NY-18 Jackie Mary Auringer
    - NY-20 Ralph F. Ambrosio
    - NY-21 Blake Gendebien, Anthony Constantino
    - NY-22 Kailee Buller
    - NY-23 Aaron Gies
    - NY-24 Alissa J. Ellman
    - NY-25 Virginia E. McIntyre
    - NY-26 Dennis E. Hannon
  - **California, statewide (8):**
    - Governor: Steve Hilton
    - Secretary of State: Don Wagner
    - Controller: Herb Morgan
    - Treasurer: Eleni Kounalakis, Jennifer Hawks
    - Attorney General: Michael Gates
    - Superintendent of Public Instruction: Richard Barrera, Sonja Shaw
  - **California, U.S. House (46):**
    - CA-2 Robin Littau
    - CA-3 Robb Tucker
    - CA-4 Eric Jones
    - CA-5 Michael Masuda
    - CA-8 Rudy Recile
    - CA-9 John McBride
    - CA-10 Jeff Frese
    - CA-11 Connie Chan
    - CA-12 Jamie Joyce
    - CA-14 Melissa Hernandez
    - CA-15 Charles Hoelter
    - CA-16 Peter Sundin Soulé
    - CA-17 Ritesh Tandon
    - CA-18 Shane Lewis
    - CA-19 Peter Coe Verbica
    - CA-20 Sandra Van Scotter
    - CA-21 Kyle Kirkland
    - CA-22 Randy Villegas
    - CA-23 Tessa Lynn Hodge
    - CA-24 Bob Smith
    - CA-25 Joe Males
    - CA-26 Sam Gallucci
    - CA-27 Jason Gibbs
    - CA-28 April A. Verlato
    - CA-29 Angélica María Dueñas
    - CA-30 Scott Alan Meyers
    - CA-31 Eric Ching
    - CA-32 Larry Thompson
    - CA-33 Stephanie M. Vargas
    - CA-34 Angela Gonzales-Torres
    - CA-35 Mike Cargile
    - CA-36 Houston Brignano
    - CA-37 Samantha Mota
    - CA-38 Pedro Antonio Casas
    - CA-39 Steve Manos
    - CA-41 Mitch Clemmons
    - CA-42 Brian Burley
    - CA-43 Cristian Morales
    - CA-44 Genevieve Angel
    - CA-45 Chuong V. Vo
    - CA-46 David Pan
    - CA-47 Jenny Rae Le Roux
    - CA-49 Armen Kurdian
    - CA-50 Steve Cohen
    - CA-51 Ricardo Cabrera
    - CA-52 Jeff Belle
  - Florida, Texas, Indiana, and Illinois will be added here as each state goes in.
- [ ] **Submit the sitemap** (https://vote.brianagude.com/sitemap.xml) to Google Search Console, so search engines find every page. Claude can walk you through it.
- [ ] **Open States second key (optional).** If you want a separate key just for testing, check Open States' terms first. If it's allowed, put it in your own `.env.local` file and leave the nightly job's key alone.

## Before the redesign starts (after Nov 3)

- [ ] **Approve the mockups** of the new home page and state pages: https://claude.ai/artifact/HsBbyfSNagG9XrASQH3e1f (private to you). Leave comments right on the page or tell Claude what to change.
- [ ] **Get quotes for paid data:** Ballotpedia, BallotReady, Democracy Works, and Cicero. Ask each what it covers (candidates, statewide officials, election dates, all 50 states) and what it costs. This feeds the paid-data plan in `docs/REDESIGN.md`.

## Whenever you can (never blocks anything)

- [ ] **Statewide officials** beyond the 4 that come in automatically (governor, lieutenant governor, attorney general, secretary of state), for each covered state, from each state's official pages. Claude can draft the list for you to check. Until then, state pages show only the 4.
- [ ] **Bios for California's U.S. House challengers,** if you want them, hand-sourced (not from Wikipedia). Until then, their cards show their ballot job title.

## Done

- [x] **Georgia photos:** every candidate has one (Oct 15).
- [x] **Redesign decisions 1–7** answered (Oct 16).
