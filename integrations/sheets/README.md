# Google Sheets Integration

Apps Script that exposes the DSEasy `getTickerPrice` Cloud Function as a Google
Sheets custom function: `=latestDSEasyPrice("NMB", $Z$1)`.

## Files

- [`Code.gs`](./Code.gs) — the script. Paste into Extensions → Apps Script.

## Live code lives in Google, not here

Apps Script runs inside the user's Google Sheet, so this file is a
**documentation copy**, not a deployment artifact. When the response shape of
`getTickerPrice` changes (see `functions/src/handlers/prices.ts`), update this
file *and* re-paste it into any sheet that uses it.

## Endpoint contract this script depends on

`GET https://europe-west1-dse-easy.cloudfunctions.net/getTickerPrice?ticker=<SYM>&key=<KEY>`

| Response | Meaning | Cell behavior |
| --- | --- | --- |
| `200` with `{ price, change, date, source, … }` | Price found | Number returned |
| `404` | Ticker not in our data (e.g. unlisted, typo) | Blank cell (negative-cached 60 s) |
| `401` / `5xx` | Real error | `#ERROR!` with hover text |

Symbol normalization (e.g. `IEACLC-ETF` → `IEACLC ETF`) is handled
server-side, so callers can pass the dashed form.

## Setup in a sheet

1. Extensions → Apps Script → paste `Code.gs` → save.
2. Run `setupDSEasy` once to store your API key in Script Properties.
3. Reload the sheet so the DSEasy menu appears.
4. Use `=latestDSEasyPrice("NMB", $Z$1)`. `Z1` is the refresh cell that the
   "Refresh All Prices" menu writes into to bust Sheets' custom-function
   cache. The cell name is configurable via the `REFRESH_CELL` constant at
   the top of `Code.gs` — keep the formula's second argument in sync.
