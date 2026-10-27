# Lens: the Kuiper law applied to flashes

KL = kuiper-law.js and ST = descent.js (see-through/202610050609); K = kuiper-belt/index.html. Evidence: hardening/evidence/opus-memos-1/kuiper-lightning-keys.* (self-fixture: Node 22, law unmodified, the 408 genuine flashes).

**Verdict.** The law fits lightning only as a time index: one star per flash, area ∝ time. It never locates, computes or samples.

## The key
k = slot × 65,536 + j.
- **slot** is the product's 10-minute sensing slot, counted from 2026-10-20T00:00:09Z. It comes from the product name (data-plane collect.py:51,280), never from flash_time: one flash precedes its product by 361 ms, which history.py:191-199 would misfile.
- **j** is the record-index rank among the slot's UK flashes. Record order is time order (292/292 pairs) and ignores latitude (155/292).
- **No bit shift.** `(slot << 16) | rank` (product-vision.md:12) goes negative from slot 32,768 (4 Jun 2027); keyPlace returns NaN.

```js
key  = slot * 65536 + j;          // safe integer, j < 65536
star = KuiperLaw.keyPlace(key);   // KL:39 verbatim; no lon/lat
dot  = mercator(lon, lat);        // the observation
draw = lerp(star, dot, ease(u));  // display only; never a track
```

- **Bijective:** key → slot, j → id round-trips 408/408.
- **Geo-blind:** shuffling lon/lat changes no key; a Morton key fails.
- **Late slot:** an earlier slot arriving late moves 0 keys (time-rank: 402/407).
- **Partial slots:** completing them (collect.py:94) moves 72/310, all unsealed.
- **Float32 shader (KL:64-79):** error ≤0.0027, against 1.77 spacing.

Keys are permanent once a slot seals (history.py:208-214). **Unknown:** whether reissued products keep record order (archive audit F7).

## What the spiral says
**True.** r² ≈ key ≈ time: equal areas are equal durations, and storms are bands of lit rings.

**False.**
- **Neighbours.** With one key per slot (honesty-and-labelling.md:7), nearest neighbours are 89, 144, 377 or 610 slots apart by radius. They are a day apart near r 72 only because 144 is a Fibonacci number. The arms will read as storm tracks.
- **Brightness.** K:122 shades by issued share, which suits the wafer (72.9 % issued). A slot fills at most 27 of 65,536 keys, so the busiest seed slot shades black (v ≤ 0.012). Shade by log flashes per slot, grey where unsearched, from a slot texture replacing K:109-113.
- **Angle, centre, rim.** The angle means nothing; the centre is the epoch; the rim is the last sealed slot, not now. The pulse (K:131-133) is no storm front.

## The gather
ST:587-595 blends stars to targets; later keys leave later (ST:964). This is an honest coordinate change only if:
- each flash has one star, without ST:965's p mod 5,800 or ST:966's offsets;
- endpoints are exact and reversible, with no trails, captioned "time order → observed position, not tracks";
- stacks are marked: 408 flashes occupy 406 positions (one pair, 25 min apart, shares a pixel centre).

## The vaccine
"The dots display and index, the engine computes" (cvaa 202609192215:62). The satellite detects, history.py counts, and the GPU places and shades. Its detector (inoculate.mjs:182) misses "computed" and reads only static HTML, so K:71's "pixels are computed" passes and runtime captions go unread. Add participles and count/measure/predict, tested on caption receipts.

## Stride sampling
The Kuiper refuses to sample (K:89-91). See Through strides over addresses (ST:963), which is fair to time, not lines. 5,401 of 20,000 stars (4,410 of 12,900 on phones) sit on silence under "A STAR FOR EVERY LINE OF CODE" (ST:801). Sampling the 408 flashes at 1 in 4:
- **Every 4th by key:** each day within ±0.8, but only 65/116 slots kept, and 200/407 picks change when an earlier slot lands.
- **j mod 4:** keeps all 116 slots but draws 159, not 102.
- **hash(id) mod 4:** stable, but ±4.5 per day and 60 slots kept.

No rule is fair to counts, presence and stability together. Draw every flash when resolved; shade unresolved pixels from slot prefix sums (K:113,120).

## Recommendations
1. The lightning repo owns `slot·65,536 + rank-in-sealed-slot` and its five tests; unsealed keys are provisional.
2. Never sample flashes. Unresolved views show per-pixel counts, grey where unsearched.
3. Gather one star per flash to its exact position, without offsets or trails. Issue §10 holds as tests: no geography in key space, and no key positions exported.

**Would change my mind:** proof that reprocessing reorders a product's records. Keys would then need LFL `flash_id`, which collect.py drops, or slot-level stars only.
