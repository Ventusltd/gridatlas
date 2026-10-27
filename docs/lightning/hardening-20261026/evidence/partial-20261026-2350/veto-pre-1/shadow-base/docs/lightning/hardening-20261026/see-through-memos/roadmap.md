# Lens: roadmap and sign-off

Dates are review points; evidence opens gates, and no workflow encodes a date (cvaa no-time-based-gates).

**Owner direction (26 Oct 22:35):** the work is not confidential; a standalone public page, linked from GridAtlas later, is acceptable. That path is owner-endorsed but not approved for build: no repository or product without separate approval.

## Dependency graph
```
D0 owner merges lightning PR #2 > D1 hourly runs > D2 28 sealed days > R1 rollups > R2 sealed month
G0 Claude hardens PR #30 > G1 ChatGPT V1-V15 + live receipt > G2 owner rulings, devices > G3 release PR
A0 owner approves page > P0 proofs + valid cvaa > S1 page on fixture > S2 page on archive (D2) > S3 Atlas link (R2, G3)
E0 EUMETSAT permission > B1 backfill steps 1-3 > B2 bounded year > Y1 "a year" (else D1 x 365 days)
```
The layer need not wait: without an index it falls back to the 7-day feed, saying so (PLAN §3.4).

## One week (review Mon 2 Nov 2026)
- **Additive layer through the veto.** H01–H05 are reproduced fail-first and fixed narrowly in a new generation (module ≤ 24,781 B). ChatGPT's V1–V15: zero FAIL, every BLOCKED named; a live CORS/cache receipt (R07).
- **Collector fixed.** Owner merges PR #2; the first dispatch writes status.json `health ok` and the 366-row index v2; 24 consecutive hourly runs leave no unexplained slot hole.

## One month (review Thu 26 Nov 2026)
- **Real coverage.** 28 consecutive sealed UTC days, each with ≥ 95 % of 144 slots examined and every other slot named as a source or collector gap. Baseline: a 46 % miss (archive F1).
- **First rollups.** Daily and hourly, from sealed days, run inside the collector job: its default-token pushes trigger no other workflow (cvaa chaining-token). Sums equal index counts and scanned seconds; sha256 manifest; consumer fails closed like gb_decade (current.json:330-341). No month seals before 1–3 Dec 2026 (history.py:208).
- **Standalone See Through page on the fixture.** Once the owner approves the page (A0), it may be public. It needs a written licence choice and green proofs (proofs-and-testing.md), is captioned "1.07 % of a year searched", and has no GridAtlas link yet. Phone figures come from a real device or are marked BLOCKED_HARNESS.

## One quarter (review Tue 26 Jan 2027)
- **Year-of-flashes field only when a year exists.** The archive is prospective (HISTORY_ONE_YEAR.md:13-14), so without backfill there is no year before late October 2027. Until then it is titled "since <coverage_start>", unsearched slots grey.
- **Backfill only if EUMETSAT permits.** Written confirmation that EO:EUM:DAT:0691 history may be bulk-retrieved, redistributed and is still held; then archive-audit steps 1–3 on 21–25 Oct (byte-identical re-download, one product per slot, 144 per day, new flashes only inside known gaps); step 4 one dispatch at a time, stopping at the first discrepancy.
- **Page on the live archive, then the GridAtlas caption link** (lightning-window.v1). The think/atlas-bridge-work proof passes 26/26 and refuses both receivers until they honour it. Gate: a sealed month, the release PR, green proofs and device receipts.

## Who signs
Machines verify; people sign (§1).
- **Builder:** never signs its own gate (§4).
- **ChatGPT reviewer:** signs V1–V15 and archival honesty.
- **Owner:** decides merges, releases, R01/R03/D08, devices, licences, the page (A0), any repository, and backfill.

## The rule: nothing before its data
No surface may name, chart or animate a span its pinned index has not searched. Every number carries its searched fraction, and unsearched time is grey and labelled "not searched". "Year", "month", "season", "record" and "trend" wait until every day in the span is sealed, with ≥ 95 % of slots examined and the rest named. A proof derives the claimable span from the index and fails any caption that exceeds it.

## Recommendations
1. Merge the collector first: coverage is the critical path.
2. Gate every stage on index fields (slots examined, sealed, sha256), never on dates.
3. Publish the page standalone only after owner approval, and link it only after a sealed month.

**Would change my mind:** after 28 days, the collector still misses over 10 % of slots for reasons it cannot name. Then stop at the additive layer.
