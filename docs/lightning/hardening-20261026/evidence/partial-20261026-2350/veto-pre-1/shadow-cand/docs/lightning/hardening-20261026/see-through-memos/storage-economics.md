# Lens: storage economics of a multi-year lightning archive

Paths: DP = scratchpad/lightning/evidence/lightning-data-plane-builder/wt (f7db76c); AA, MB = lightning/reports/lightning-archive-auditor.md, mobile-performance-budget.md; EV = scratchpad/hardening/evidence/opus-memos-3 (LABELS.txt).

## Bytes per flash (408 genuine flashes, lightning 21c3e56; my rerun, EV/enc-genuine.txt)
| encoding | raw | gzip-9 |
|---|---:|---:|
| today's GeoJSON (DP/collect.py:87-96) | 525 | 27.8 |
| lean GeoJSON | 139 | 18.0 |
| rows JSON (ms, lattice lon/lat, row) | 28.4 | 12.1 |
| binary column deltas | 8.0 | 7.5 |

Lattice positions match the stored values to 4 dp (worst 3×10⁻⁶°), negligible against the 4.5–7 km footprint (AA F10). Rows need a per-day product table to keep today's receipt: ≤20 kB raw, ~2.5 kB gzipped per full day.

Volume is unknown; I use 0.3M, 1M and 3M detected flashes a year (AA F3's bracket).

## Tiers for one central year (1M flashes)
| tier | size | home | retention |
|---|---|---|---|
| head: unsealed 48 h (DP/collect.py:42) | 0.2 MB rows; 1.7 MB on a 60k day | Pages artifact only | 48 h |
| sealed days: rows + products | 36 MB raw, 13 MB gz (today's shape: 525, 28) | committed once; Pages | served 13 months; kept forever |
| year bundle | 13–28 MB gz | release asset | forever |
| rollups (gz): slots ~35 kB (estimate), hourly 5.7 kB, index v2 3.1 kB at 1 % coverage, headline 0.8 kB, monthly | <50 kB | Pages, pinned by sha256 | forever |

Ten central years of sealed days: 0.36 GB as rows, 5.25 GB in today's shape.

## What git really costs
Data sealed once costs about its gzip size in packs; rewrites cost the rest. MB F8 simulated 283 MB a year for PR #1's layout at 3,000 flashes/day, 148 MB for a lean layout, and 1.2–1.9 GB with the 7-day feed at its 40k cap. The data plane still rewrites index.json every run (`generated_utc`, DP/history.py:497) and each day until sealed (:208-214). It then deletes shards older than a year (:315-317, 443-445), so earlier years survive only inside git packs, beyond a browser's reach.

## Limits (GitHub docs, read 26 Oct 2026)
- **Git:** 50 MiB warning, 100 MiB block; repositories ideally under 1 GB, strongly under 5 GB.
- **Pages:** site ≤1 GB; 100 GB/month soft limit; 10-minute deploys; 429 when rate-limited. CORS unobserved (github.io blocked here).
- **Releases:** assets under 2 GiB, at most 1,000 per release, no size or bandwidth cap. Neither redirect hop sends Access-Control-Allow-Origin (EV/net/release-asset-cors.txt), so assets serve bulk downloads, not browsers.
- **raw.githubusercontent.com:** CORS `*`, max-age 300, undisclosed rate limits (AA F5); not a CDN.

## When it must leave GitHub
Storage forces the move once the served 13 months pass ~800 MB: ~1.4M flashes a year in today's shape, one stormy year. As rows sealed once, with the head out of git, storage never forces it within a decade, even at 3M a year. Then traffic decides: a storm-day session costs 0.1–1 MB, so leave when reads stay above ~50 GB/month, or at the first Pages 429.

## Cheapest honest hosting
Honest means immutable, sha256-listed, cross-origin readable, with a public bulk copy, no tracking and a named provider.
- **GitHub (Pages for 13 months and rollups, releases for sealed years): £0.**
- **Cloudflare R2**, behind a domain on a Cloudflare zone (r2.dev is development-only): free to 10 GB and 10M reads/month with no egress fees, then $0.015/GB-month (2024 figures, secondary source). £0 until then, ~£12/yr at 100 GB (assumed $1.30/£). A domain fee applies only if globalgrid2050.com cannot move.
- **Backblaze B2:** $6.95/TB-month, 10 GB free, egress free up to 3× stored, then $0.01/GB. 1 GB read at 100 GB/month costs about £9/yr.

Release assets remain the second copy.

## Recommendations
1. Seal days as rows JSON plus a product table, and commit each day once.
2. Deploy the head, feed and hourly index as a Pages artifact, not as commits.
3. Bundle sealed years as release assets; plan R2 only after a 429 or 50 GB/month.

**Would change my mind:** Pages returning 429 below ~50 GB/month. R2 would then become the read path at once, with GitHub keeping the archive copy.
