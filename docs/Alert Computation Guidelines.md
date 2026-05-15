# Alert & Notification Computation: Cost-Efficient Patterns

This document defines the design patterns DSEasy uses to keep server-side alert detection (price moves, circuit-breaker proximity, volume spikes, watchlist digests, etc.) cheap to run on Firebase. It is intended as a reference for anyone adding a new alert type, scheduled detector, or notification channel.

The goal is simple: **adding a new alert type should not noticeably move the needle on Firestore reads, Function GB-seconds, or FCM cost** — even at user growth of 10–100×.

## 1. Core Principles

### 1.1 Piggyback, don't add new schedules

The existing `monitorIntraday` handler (`functions/src/handlers/monitorIntraday.ts`) already fetches the full intraday `priceMap` every cycle, holds it in memory, and writes a batch to Firestore. New alert checks that need live prices should extend this handler, not stand up a parallel scheduled job.

- **Do**: add a `checkXAlerts(priceMap, baselines)` function called inline.
- **Don't**: add a new `onSchedule` trigger that re-fetches market data.

A new schedule means a duplicate scrape of the DSE API, a duplicate function cold-start, and a duplicate set of Firestore baseline reads.

### 1.2 Compute in RAM; don't query per symbol

Once `priceMap` and a baseline (yesterday's close, day's open, 30-day avg volume) are in memory, all percent-change / threshold math is pure CPU. For DSE's ~30 listed tickers, this is microseconds. The cost only appears when each check turns into a Firestore round-trip.

- **Do**: load all baselines once per cycle, evaluate every symbol in a loop.
- **Don't**: call `getDoc(...)` inside a per-symbol loop.

### 1.3 Cache "today's baselines" once per session

Reference prices that don't change during the day — previous close, today's open, prior-N-day volume averages — should be read **once** and reused. Two acceptable cache layers:

| Layer | Lifetime | Use for |
|---|---|---|
| **Module-level `Map`** in the Cloud Function | ~15 min while instance is warm | Hot path; survives across invocations of the same instance |
| **`dailyBaselines/{YYYY-MM-DD}` Firestore doc** | Full trading day | Cold-start fallback; rebuilt at pre-open |

Pattern:

```ts
let baselinesCache: { date: string; data: Baselines } | null = null;

async function getBaselines(date: string): Promise<Baselines> {
  if (baselinesCache?.date === date) return baselinesCache.data;
  const snap = await db.doc(`dailyBaselines/${date}`).get();
  const data = snap.data() as Baselines;
  baselinesCache = { date, data };
  return data;
}
```

This converts what could be `30 reads × 72 cycles/day = 2,160 reads/day` into `1 read/day` (plus a few warm-instance hits).

## 2. Fan-Out Patterns

### 2.1 Global alerts: use FCM topics

For alerts that fire on a **symbol-level condition** (e.g. "any stock down ≥5% today"), the trigger is independent of which users care. Subscribe interested devices to an FCM **topic** when they enable the relevant notification preference, and send one FCM message to the topic per firing.

- 1 FCM call covers N users.
- Zero Firestore reads to look up tokens at send time.
- Unsubscribing is a single client-side call.

Suggested topic naming: `dseasy-notable-movers`, `dseasy-circuit-breaker`, `dseasy-daily-digest`.

- **Do**: subscribe to topics in `useNotificationsSync` based on `settings.*` flags.
- **Don't**: query `users` collection on every firing to gather tokens.

### 2.2 Per-user custom alerts: one collection read per cycle

User-defined alerts (the existing `alerts` collection, `condition: ABOVE | BELOW | PERCENT_CHANGE`) should be fetched **once per cycle** and evaluated entirely in memory against the in-RAM `priceMap`. The pattern in `monitorIntraday.ts:208` (`db.collection("alerts").where("status", "==", "ACTIVE").get()`) is correct — keep it as a single bulk read, never per-symbol.

If the `alerts` collection grows large (>500 docs), shard the query by an indexed `bucket` field rather than by symbol — symbol-keyed queries multiply reads by `len(symbols)` per cycle.

### 2.3 Cap per-user alert count

User-defined alerts are the only piece of the system whose cost scales linearly with users. Enforce a server-side limit in the `createAlert` callable (e.g. ~5 active alerts per user) before write. Without this, the system has no upper bound.

## 3. Dedupe & State

### 3.1 One dedupe doc per day, not per symbol

Without state, a ticker hovering at -5.1% will re-fire on every intraday tick (~72×/day). A single `notableMovers/{YYYY-MM-DD}` doc holding `{ SYMBOL: { fired: ["-5%", "-10%"] } }` for the whole market deduplicates with **1 read + 1 conditional write per cycle**, regardless of how many tickers triggered.

Per-symbol dedupe docs are an anti-pattern: 30× the reads for the same information.

### 3.2 Idempotency at the firing site

Always read-modify-write the dedupe doc inside a transaction (or with an `arrayUnion` if order doesn't matter), so a function retry doesn't double-send.

```ts
await db.doc(`notableMovers/${date}`).set(
  { [symbol]: { fired: admin.firestore.FieldValue.arrayUnion(threshold) } },
  { merge: true },
);
```

## 4. Workload Tiering

Not every check needs to run every tick. Tier detectors by the cost of their input data, not by enthusiasm.

| Detector | Frequency | Input cost | Notes |
|---|---|---|---|
| % move vs prev close | every intraday tick | in-memory | Free once baselines cached |
| Circuit-breaker proximity (Distance-to-Limit) | every tick | in-memory | DSE-specific, high signal |
| Volume vs 30-day avg | hourly OR end-of-day | historical read | Don't compute every 5 min |
| 52-week high/low crossing | once at close | full series read | Daily |
| Watchlist daily digest | once at 16:30 EAT | one fan-out | Single push per user |
| News / sentiment | as available | external API | Defer until paid feeds available |

The intraday scheduler should stay focused on the "every tick" row. Move slow checks to their own scheduled handlers running at coarser intervals.

## 5. Write Discipline

### 5.1 One batch per cycle

`monitorIntraday` already constructs a single `db.batch()` for the snapshot write. New alert state writes (`notableMovers`, alert-firing logs, dedupe updates) should join the **same batch** wherever possible. Firestore prices per write op; batched commits don't change per-op price but eliminate round-trip latency that affects function GB-seconds.

### 5.2 No write on no-op

If no thresholds newly triggered in a cycle, write nothing. The dedupe doc should only be touched when something changes.

### 5.3 Avoid logging firings as separate documents

If you need an audit trail of fired alerts, append to a daily log doc (`alertLog/{date}` with a single growing array) rather than creating one doc per firing. For DSE-scale data, this trades unbounded growth for bounded daily docs — easier to TTL and cheaper to query.

## 6. Push Computation to the Client When Possible

Anything the user only sees when the app is open can be computed client-side from data already loaded in the Ticker Trends view.

- 52-week high/low **badge** in the UI? Client-side, no scheduled job needed.
- Volume-vs-average **chip**? Client-side.
- "Down ≥5% today" **push** that needs to reach a closed phone? Server-side.

The rule of thumb: **server-side detection is for "you would have missed it" cases.** Everything else is presentation.

## 7. Quiet Hours

Detectors that need live market data should respect DSE session hours (~10:00–16:00 EAT) and skip cleanly outside them. The intraday scheduler already gates this implicitly; ad-hoc handlers should not.

The exception is the **daily digest** style of alert, which is the *complement* — it runs exactly once, after close, and is the cheapest possible notification pattern (one scheduled invocation, one topic send).

## 8. Cost Sizing for DSEasy

Concrete back-of-envelope for a complete % move + circuit-breaker proximity feature, using the patterns above, at the current DSE scale (~30 tickers, ~72 intraday cycles/day, ~22 trading days/month):

| Resource | Per cycle | Per month | % of free tier |
|---|---|---|---|
| Firestore reads (added) | 1–2 (baselines cached after first) | ~3,500 | <0.5% |
| Firestore writes (added) | 0–1 (only on new trigger) | <500 | negligible |
| FCM messages | 0–1 per topic per trigger | <100 | free |
| Function GB-seconds | sub-ms math added | negligible | negligible |

The patterns are not premature optimization — they are the difference between a feature that disappears into the free tier and one that scales linearly with users and ends up dominating the bill.

## 9. Anti-Patterns to Avoid

- **Per-user query loops on the hot path.** `for (user of users) { query alerts where userId == user.id }` is the worst shape this system can take.
- **Per-symbol Firestore reads inside a tick.** Always batch upfront.
- **Re-deriving baselines every cycle.** Once per day, cached.
- **One Firestore doc per firing.** Use a daily log array.
- **A new `onSchedule` per detector.** Extend the existing handler.
- **Token lookups on send.** Use FCM topics for global alerts.
- **No per-user cap on custom alerts.** Cost becomes unbounded.
- **Storing user FCM tokens in a way that requires N reads to fan out.** Topics or a single `notificationGroups/{topic}` doc.

## 10. Checklist for Adding a New Alert Type

When PR-reviewing a new detector, confirm:

- [ ] Reuses `monitorIntraday` (or a tier-appropriate existing schedule) — no new ad-hoc cron.
- [ ] All required baselines loaded once per cycle, cached at module level.
- [ ] Per-symbol evaluation is in-memory, not per-symbol Firestore reads.
- [ ] Dedupe lives in a single per-day doc, mutated via transaction or `arrayUnion`.
- [ ] Fan-out is via FCM topic (global) or single bulk `alerts` read (per-user).
- [ ] Writes are joined to the existing cycle batch where possible.
- [ ] Detector respects market hours, or is explicitly a post-close/pre-open job.
- [ ] Per-user version (if any) has a server-enforced cap.
- [ ] The added cost has been estimated in reads/writes/messages per day.

---

_Generated for DSEasy - Notifications & Alerts Architecture_
