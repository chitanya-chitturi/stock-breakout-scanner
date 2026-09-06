# Stock Breakout Scanner

## First run

This repository contains source code and fixed test fixtures, not daily scan output.

1. Install Node 22.18+ and pnpm, then run `pnpm install`.
2. Create an ignored `.env.local` with `APCA_API_KEY_ID` and `APCA_API_SECRET_KEY`.
3. Run `pnpm scan` to generate both versions using the same liquid stock list.
4. Run `pnpm dev` and open the displayed local URL. Before the first scan, both tabs show setup instructions.

Run `pnpm scan` again for fresh results. Generated charts, membership, reports and Version 1 data stay local and are ignored by Git. A production build includes the locally generated outputs; publishing does not require committing those outputs. `pnpm test` runs offline fixtures; `pnpm test:scan` checks the generated shared universe after a scan. Historical notes below describe earlier snapshots, not data included in a fresh checkout.


## Current version 2: liquidity-first universe

Version 2 selects the **500 highest by 20-day average daily dollar volume** among supported US-listed common equities and ADRs with market cap strictly above $5B. It is no longer restricted to the S&P 500. Version 1 uses the same liquidity-selected 500 stocks in its default tab; its consolidation rules are unchanged.

### Run

Requires Node 22.18+ and pnpm. `pnpm install`, then configure ignored `.env.local` with `APCA_API_KEY_ID` and `APCA_API_SECRET_KEY`. Never commit credentials.

- `pnpm patterns:scan --as-of 2026-09-06`: build/reuse the weekly liquidity universe and scan all 500 with price rules.
- `pnpm patterns:scan --symbols SNDK,INTC --as-of 2026-09-06`: scan those symbols if they are selected in the liquidity universe.
- `--refresh-universe`: force a fresh ranking and market-cap snapshot.
- Omit `--as-of` to use the latest completed session.
- `pnpm dev`: open local dashboard; `pnpm build`: production build.
- `pnpm test` and `pnpm typecheck`: regression, discovery, liquidity and type checks.

### Universe construction

1. Load Nasdaq's complete US stock screener response; reject malformed or incomplete responses.
2. Filter market cap >$5B and remove preferred/preference securities, funds, ETFs/ETNs, warrants, rights, notes/debentures and units using provider security names. This is a name-based classification, not an authoritative security master. Include common/ordinary equities, REIT equities and ADRs. Intersect with active, tradable exchange-listed Alpaca equities; OTC securities are excluded.
3. Fetch six months of split-adjusted Alpaca SIP daily bars in batches, using the exchange calendar to exclude unfinished sessions.
4. For exactly the 20 exchange sessions before the signal date, compute `sum(close * volume) / 20`. Do not use `mean(close) * mean(volume)`, today's partial volume, or the signal day's activity. Missing, duplicate or invalid ranking data causes an explicit exclusion.
5. Sort descending by average dollar volume, break ties alphabetically, and take 500. Refuse to claim a 500-stock selection if fewer than 500 can be ranked.

Membership and market caps refresh on the first command run each calendar week (Monday-based), or with `--refresh-universe`. Subsequent runs reuse membership while refreshing analysis bars. A same-session rerun reuses cached data. This is refresh-on-run behavior; no unattended scheduler has been installed. Historical runs use current source market caps, not point-in-time fundamentals, and must not be treated as unbiased backtests.

Liquidity selection needs 20 sessions; pattern discovery separately needs 60. A newly listed liquid stock can enter the top 500 but appear as a pattern-coverage exception. We do not silently backfill it with a less liquid stock.

### Dashboard and exports

Version 2 shows liquidity rank and average daily dollar volume next to each detected pattern, the ranking dates, selection cutoff, candidate coverage and exclusions. Download all 500 members from `public/liquidity-universe.csv`, or the full methodology metadata and exclusion list from `public/liquidity-universe.json`. Pattern results and individual annotated charts remain in `public/pattern-results.json` and `public/pattern-charts`.

Reloading the dashboard reads saved results; it does not fetch prices or call AI. Hosted refreshes require publishing the new build. Raw bars and membership caches stay under ignored `work/liquidity` and `work/pattern-cache`. No OpenAI calls are needed or made by the default commands.

### Latest run

September 4, 2026 close. Ranked 1,387 of 1,389 supported equities above $5B from 7,133 source listings. ENJ and GJS had incomplete liquidity history. Selected 500, with a $233.3M/day cutoff; 151 are outside the prior 500-ticker S&P selection. Pattern coverage: 497/500; SPCX, SKHY and HONA have insufficient pattern history. Eleven qualifying pattern labels across nine stocks. Multiple labels can describe the same move.

### Optional AI / legacy modes

AI review remains optional and not run. The JSON plus its chart and local OHLCV data is the intended input for a later independent AI review. `--ai-discovery` is an older paid comparison mode requiring an OpenAI key; default scans do not use it. Add `--legacy-universe --all --limit 100` or `--legacy-universe --all --limit 500` to reproduce the older S&P selection. `--offline` only generates old preview charts and overwrites the pattern report; rerun the normal command afterward.

## Pattern rules and version 1 preservation



Only pre-signal data builds the pattern. A pivot is a local high/low with two candles on either side, all before the signal candle.

- Channels: search 8–45 pre-signal sessions, longest first; use every established high/low pivot within each window. Require at least two on each boundary and fit straight lines. Flags are limited to 31 candles.
- Flags: roughly parallel, flat or countertrend boundaries; a preceding 1–20 session pole ends at or up to three sessions before the channel. Pole move must exceed 5% and three average candle ranges; retracement is at most 50%.
- Wedges: both boundaries slope in the same direction, with 20–90% convergence and positive width. Rising wedges confirm downward; falling wedges upward.
- Head and shoulders: search consecutive high pivots (low pivots for inverse), choose intervening neckline pivots, require head prominence, similar shoulders, prior trend and a neckline close. The shoulders span at least 12 sessions and the right shoulder is no more than 12 sessions before the pattern end.
- Boundary fit tolerance is the greater of 0.6 mean high-low candle ranges in the pattern context and 0.2% of the last pre-signal close. This is not ATR. These thresholds are explicit heuristics, not optimized trading parameters.
- Require a first completed close beyond the boundary, volume strictly above the prior 20 completed sessions' average, and market cap strictly above $5B. The signal day is excluded from average volume. No 20-day price-high requirement.

Keep at most one confirmed candidate per pattern type per stock, deterministically selected by search order; multiple different pattern labels can overlap on the same move. No forming patterns are shown as signals. A detected break can fail afterward.

## Plots and AI handoff

Each confirmed pattern gets its own chart: blue channel boundaries and pivots; yellow confirmation boundary; purple flagpole; labeled head/shoulder points where applicable. SNDK/INTC plain charts remain visible even if no new pattern qualifies. Version 1 charts remain separate.

The JSON result is suitable input for a later optional AI reviewer: pattern type, pivot dates, date range, boundary coordinates, confirmation close, relative volume, cap, reason and chart path. Exact OHLCV bars are in the local cache. AI review is **not run** and cannot silently replace rule results. The older `--ai-discovery` mode is retained for comparison only; it requires `OPENAI_API_KEY` and uses paid GPT-4.1 calls. Default commands do not use it. `pnpm patterns:preview` is an older short-history chart preview that overwrites the pattern report; rerun the price scan afterward to restore results.

## Validation and limitations

Version 1's 12 regression assertions still pass, including its original five symbols. The validator has 20 synthetic checks; discovery is tested on all six positive pattern types and a flat negative control. These tests establish deterministic behavior, not market accuracy. No labeled historical benchmark, precision/recall estimate, profitability claim or automatic trading is included. Conservative rules can miss valid discretionary patterns. Daily automation should follow manual evaluation.


## Build log

- Added deterministic six-pattern discovery and plotted evidence; preserved version 1 detector/data/chart source.
- Added separate version tabs and a 500-S&P-listing scan.
- 2026-09-06: Replaced default version 2 universe with weekly liquidity ranking across US-listed equities and ADRs. Added liquidity exports, result ranks, coverage exceptions and tests. No OpenAI calls made.

Sources: [Nasdaq stock screener](https://www.nasdaq.com/market-activity/stocks/screener), [Alpaca daily bars](https://docs.alpaca.markets/us/reference/stockbars). Dollar volume is calculated by this project from SIP daily bars; it is a liquidity proxy, not a measure of spreads or order-book depth.

## Breakout strength (version 2 only)

The dashboard ranks confirmed signals Strong → Moderate → Weak, then by evidence score, relative volume and symbol. It includes strength counts, a filter, a summary table, and per-signal reasons. Duplicate pattern labels on one stock are not independent opportunities. Version 1 is unchanged.

The `break-strength-v1` rubric measures the completed break, not pattern-recognition confidence, future profitability or recommended position size. It uses:

| Evidence | Points |
| --- | --- |
| Volume / previous 20-session mean | <1.1×: 5; 1.1–<1.5×: 15; 1.5–<2×: 30; ≥2×: 40 |
| Directional close distance beyond boundary / previous 14-session mean true range | <0.1×: 5; 0.1–<0.3×: 15; 0.3–<0.75×: 30; ≥0.75×: 40 |
| Directional close position in signal candle | <50%: 0; 50–<65%: 10; 65–<80%: 15; ≥80%: 20 |

True range is max(high−low, abs(high−previous close), abs(low−previous close)); use the arithmetic mean of the prior 14 sessions, not Wilder smoothing. For breakouts, directional close position is (close−low)/(high−low); breakdowns mirror it. All baseline averages exclude the signal candle.

**Strong** requires score ≥70 AND volume ≥1.5× AND distance ≥0.3× average true range AND close position ≥65%. **Weak** means any of volume <1.1×, distance <0.1×, or close position <50%. Remaining qualifying signals are **Moderate**. Thus a 75-point signal may remain Moderate when its volume is below 1.5×; score alone is not sufficient. Invalid data and non-confirmed signals remain ungraded.

The default scan attaches scores automatically. `pnpm patterns:grade` regrades an existing saved report using its matching local cached bars without calling Alpaca or OpenAI. It fails without overwriting the report if confirmed signals cannot be scored. The JSON export includes metrics, score, label, reasons and rubric version. These starting thresholds need evaluation on a labeled historical sample; they were not tuned to force any current signal into Strong.

2026-09-06: Added strength scoring and regression tests. Current snapshot: 0 Strong, 9 Moderate and 2 Weak pattern labels. EME and GM are Weak under the new rubric. No original confirmation rules were relaxed.

## Shared stock list for both versions

2026-09-06: Version 1 now uses exactly the same 500 symbols and market caps as Version 2. Only its universe/data and dependent counts, provenance and CSV were updated. `app/scanner.ts` and `app/pattern-chart.tsx` are unchanged. Version 1 retains the original 47-session chart window (or available history for newer listings), 8–15-session consolidation detection, strict volume rule and relative-volume ordering. No version 2 patterns or strength scoring were added to version 1.

Run `pnpm version1:sync` after preparing the liquidity universe to refresh version 1's snapshot and `public/version1-signals.csv`. Original 100-stock data is preserved in `tests/v1-baseline.json` so the original regression tests continue to run on the original inputs. Legacy version 2 universe commands also read this frozen baseline, not version 1's expanded live dataset.

September 4 snapshot: version 1 has 500/500 stocks with sufficient history and 14 consolidation signals. Version 2 remains unchanged at 497/500 because its minimum history is longer. The versions share membership, not signal eligibility rules.

2026-09-06: Removed generated PNGs, reports, membership exports and embedded Version 1 market data from source control. Version 1 now loads generated JSON at runtime; confirmation rules remain unchanged. Kept the fixed baseline fixture and legacy universe as test/reproducibility inputs.
