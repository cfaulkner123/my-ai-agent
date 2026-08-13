# Paid Domain Research (default domain-research skill)

Ask the agent to research a business domain and this skill runs. It reads the public home page, then adds **real search data** from DataForSEO: what the site already ranks for, who competes with it in Google, and which keywords are worth going after. It saves everything on your computer so later conversations can use it without paying again.

This is the default. The free [`domain-research`](../domain-research/README.md) skill is the fallback.

## Before you start

You need a DataForSEO account and its API login and password, plus the Anthropic credential you already created for workflow `00`.

Set both up as described in [docs/PAID_DOMAIN_RESEARCH.md](../../docs/PAID_DOMAIN_RESEARCH.md). In short: create an **HTTP Basic Auth** credential in n8n named `DataForSEO API`, put its ID in `n8n/credentials.local.json`, then run:

```bash
node scripts/bind-local-credentials.mjs
```

Your API login and password stay in n8n's encrypted local store. They never enter this repository, a prompt, a log, or the chat.

**Until that credential is bound, paid research is unavailable** and the agent quietly falls back to the free website-only scan. That is by design, not a failure.

## Turn it on

1. Open `skills/enabled.txt` and add this line at the end:

   ```text
   paid-domain-research
   ```

2. Save the file. Do not change any other line in it.
3. With the app running, sync:
   - macOS: double-click `sync-skills.command`
   - Windows: double-click `sync-skills-windows.cmd`
4. Wait for **Enabled skills synced successfully**. This takes up to three minutes because n8n restarts twice.
5. Open the chat and select **New conversation**.

## Try it

```text
Research yourbusiness.com and give me the best keywords, competitors, and next steps.
```

It will not ask whether you own the domain. It starts a standard paid run for Australia in English, costing up to US$0.20, and takes up to a minute.

## What it costs

Three modes, each with a ceiling the application enforces:

| Ask for | What you get | Costs up to |
| --- | --- | ---: |
| `refresh` | Current rankings and organic competitors | US$0.10 |
| standard (default) | Refresh plus keyword expansion and up to three live searches | US$0.20 |
| `deep` | Wider expansion and up to five live searches | US$0.50 |

Asking for a mode accepts its ceiling — there is no second confirmation. The agent reports the actual cost once, at the end.

These are **application ceilings based on prices reviewed on 10 August 2026**, not a promise from DataForSEO. Set an account budget on the DataForSEO side as your real billing control.

A repeat request for the same domain, market, language and depth within 24 hours reuses the saved snapshot and costs nothing.

## Read the results honestly

Competitors come in separate kinds, and the difference matters:

- **Direct competitor** — similar offer, similar buyer.
- **SEO competitor** — overlaps with you in Google rankings. May not be a real business rival at all.
- **SERP competitor** — showed up in a captured search result for one query.
- **Adjacent** — directories, publishers, partners, substitutes.

A directory outranking you is a search problem, not a competitor. Keep the two apart when deciding anything.

Search positions and monthly search volumes are **estimates for one market on one date**, not guarantees.

## What it will not do

- It reads **one page** of the site, not the whole site.
- It **never retries a paid call automatically**. If a run fails, it says so and falls back to the free scan; it does not quietly spend again.
- A failed attempt **never overwrites** the last good saved research.
- It never reports a provider failure as "no results" — those are different, and it distinguishes them.
- It will not pad thin results with guesses. Partial results are labelled partial.
- It only researches public business domains. Internal addresses, IP addresses and `localhost` are refused.
- It cannot read a site whose content is built by JavaScript after loading.

## Where research is stored

In the chat app's local SQLite database, alongside your saved conversations, as a dated snapshot per attempt. Failed attempts are kept as history. Nothing is uploaded anywhere; what leaves your machine is the page request, the DataForSEO queries, and the analysis request to Claude.

## Turn it off

Delete the `paid-domain-research` line from `skills/enabled.txt` and sync again. The agent falls back to the free `domain-research` skill. Saved research stays saved.
