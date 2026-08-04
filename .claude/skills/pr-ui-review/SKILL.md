---
name: pr-ui-review
description: Run an interactive local QA pass on a DSEasy pull request before accepting it. Cross-checks what the PR claims to do against its actual code diff, runs an automated screenshot diff of the affected routes on the Vercel preview vs production, and then drives the browser directly to click through the specific new/changed behavior and confirm it actually works — not just that it looks right. Use this whenever the user asks to review, QA, sanity-check, or "look over" a DSEasy PR before merging, asks whether a PR "landed smoothly" or has any "hiccups", says something like "check out PR 194" or "is this PR safe to merge", or names a DSEasy PR number in the context of accepting/merging it. Only applies to this repo (Gideonamani/DSEasy) — it depends on the repo's Vercel preview deployments and scripts.
---

# PR UI Review

A screenshot diff alone tells you a page *looks* the same. It can't tell you
a button now throws on click, or that the feature actually does what the PR
description promises. This skill combines both: `scripts/visual-diff.mjs`
covers the mechanical "did anything render differently or start erroring"
sweep, and you cover the part only a real interaction can catch — does the
specific thing this PR claims to add or fix actually work.

Run both. Neither one alone is the review.

## Step 1 — Read what the PR claims

```bash
gh pr view <N> -R Gideonamani/DSEasy --json title,body,url,comments
```

Extract the PR's stated purpose and acceptance criteria from the title and
body. DSEasy's convention ([CLAUDE.md](../../../CLAUDE.md)) is one issue per
PR with "Closes #N" in the body — if there's a linked issue, pull it too
(`gh issue view <N> -R Gideonamani/DSEasy`) since the issue usually has more
detail on expected behavior than the PR description does.

Write down, concretely: what should a user be able to do after this PR that
they couldn't before (or what bug should no longer reproduce)?

## Step 2 — Cross-check against the real diff

Don't take the description on faith — PR descriptions drift from what the
code actually does, especially after review-round changes.

```bash
gh pr diff <N> -R Gideonamani/DSEasy
```

Read it for:
- Which route(s)/component(s) actually changed (this tells you which routes
  to pass to the visual-diff script — don't just diff the homepage if the
  change is in `src/components/TickerTrends.tsx`).
- Whether the diff matches the claim. A PR titled "add column picker" that
  also touches `firestore.rules` or an unrelated hook is worth a second look
  before you even open a browser.
- Any new dependencies, env vars, or config the preview needs to actually
  exercise the change.

## Step 3 — Run the automated visual-diff sweep

```bash
npm run pr:visual-diff -- <N> --routes=/,<route-from-step-2>,<route-from-step-2-2>
```

Requires `VERCEL_AUTOMATION_BYPASS_SECRET` in the environment (set once via
Vercel Project Settings → Deployment Protection → Protection Bypass for
Automation — the user sets this up, not you). Without it, preview
screenshots will just show the Vercel SSO login page instead of the app;
if you see that in the output, tell the user the token isn't set rather
than treating it as a visual regression.

This writes `.pr-review/pr-<N>/summary.json` plus PNGs (prod/preview/diff
per route). Read the summary — for each route it reports:
- `diff.diffPct` — percent of pixels that differ from prod (flagged above
  the default 0.5% threshold, which is loose enough to absorb chart
  re-renders and date-dependent data but will still catch a broken layout)
- `newConsoleErrors` / `newFailedRequests` — things that error on preview
  but not on prod, i.e. genuinely new problems, not pre-existing noise
- `navError` — the route failed to load at all on one side

A route with real pixel diff isn't automatically bad — this PR is *supposed*
to change the UI. The question is whether the diff matches the claim (a
column-picker PR changing the market-data table region: expected; the same
PR shifting the chart on an unrelated page: not expected).

## Step 4 — Actually use the feature

This is the step the script can't do for you, and it's the point of this
skill. Use your own browser tools (`mcp__Claude_Browser__navigate`,
`computer`, `read_page`, `find`) to open the preview URL from the summary
and interact with the specific thing the PR claims to add or fix:

- Click the new button/toggle/control. Does it do what the description says?
- Try the obvious edge cases a real user would hit: empty state, a second
  click/toggle-off, resizing the panel, switching ticker/date context if the
  feature is data-dependent.
- If it's a bug fix, try to reproduce the original bug on preview and
  confirm it's gone (and ideally confirm it *does* still reproduce on prod,
  so you know you're testing the right thing).
- Compare against production side by side if it helps
  (`node scripts/pr-preview-compare.mjs <N>` opens both as real browser
  tabs — useful when you want your own eyes on a direct A/B rather than a
  diff image).

While you're in there, pull the console and network logs yourself too
(`mcp__Claude_Browser__read_console_messages`,
`read_network_requests`) — the visual-diff script only captures whatever
happened during an unattended page load; it won't see an error that only
fires when you actually click the new control.

## Step 5 — Report

Give the user a short, direct verdict — this isn't a formal document, just
enough for them to decide whether to merge without re-doing the work
themselves.

```
## PR #<N> — <title>

**Claims:** <one line — what this PR says it does>

**Diff touches:** <routes/components from step 2>

**Visual diff:** <N/M routes flagged, or "clean">
  - <route>: <diffPct>% — <expected, given the claim / unexpected, here's why>
  (only list flagged or notable routes, not every clean one)

**Interactive check:** <what you actually clicked through and what happened>
  - <specific behavior confirmed working>
  - <anything broken, with the console/network error if there was one>

**Verdict:** Looks safe to merge / Needs a look at <specific thing> before merging
```

If you found nothing wrong, say so plainly and briefly — don't pad the
report to look thorough. If something's broken, be specific enough that the
user doesn't have to go re-check it themselves (exact button, exact error
text, exact route).
