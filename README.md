# Election Day Need-to-Know

A nonpartisan guide to Georgia's November 3, 2026 election. It covers the dates, which districts you're in, every race on the ballot, what each office does, and who's running.

## What's in this folder

| Path | What it is |
|---|---|
| `prototype/index.html` | Working prototype. Open it in a browser. |
| `data/georgia-2026-snapshot.json` | Candidates, offices, and sources behind the prototype |
| `data/ga-zip-to-congressional-district.json` | ZIP → U.S. House district lookup |
| `docs/DECISIONS.md` | What we decided and why |
| `docs/DATA_SOURCES.md` | APIs, keys, and known data issues |
| `docs/DESIGN.md` | Look, layout, and writing rules |
| `CLAUDE.md` | Standing instructions for Claude Code |
| `PROMPT_FOR_CLAUDE_CODE.md` | The first message to give Claude Code |
| `.env.example` | Names of the API keys you'll need |

## Before you start: accounts and keys

1. **GitHub:** create a new repo and push this folder to it.
2. **Congress.gov API key** (free): api.congress.gov/sign-up
3. **Open States API key** (free): create an account at openstates.org, then request a key on your profile page.
4. **api.data.gov key** (free, for FEC campaign finance): api.data.gov/signup
5. **Anthropic API key** (for shortening bill summaries): console.anthropic.com
6. **Hosting account:** Cloudflare Pages, Netlify, or Vercel. Claude Code will recommend one.
7. **Optional:** request price quotes for full candidate data from Ballotpedia (data@ballotpedia.org), BallotReady, and Democracy Works.

Never paste keys into chat or commit them. Add them as GitHub Actions secrets and hosting environment variables. Claude Code will walk you through it.
