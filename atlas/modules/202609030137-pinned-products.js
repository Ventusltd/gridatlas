/* ══════════════════════════════════════════════════════════════════════
   pinned-products - the runtime data this Atlas reads, by commit and by digest
   ══════════════════════════════════════════════════════════════════════

   A published Atlas release is immutable. Three of its runtime fetches were
   not: they named a BRANCH.

     data-grid-gb        main/derived/connection-points.v3.json
     data-grid-gb        main/derived/gb-transmission-network.v1.json
     data-gb-electricity main/derived/price-decade-rollup.json

   The only defence was a schema string, and a schema string defends SHAPE
   and is blind to VALUES. On 2026-09-03 that stopped being theoretical. A
   correction on data-grid-gb - branch codex/20260903-phase0-integrity,
   commit b91e45b - publishes deduplicated transformer counts under the
   IDENTICAL schema `data-grid-gb.connection-points.v3`:

     COWLEY   transformers  10 -> 5
     ABHAM    transformers   4 -> 2
     located                502 -> 489     (886 points either way)

   Every record in the file differs. A factor of two on a number the card
   prints, invisible to every check the consumer had. An immutable release
   would have changed what it said with none of its own bytes changing.

   So the ref is a commit and the bytes are hashed. The NESO inputs upstream
   are pinned by SHA-256 with exactly this rationale - document ids are
   stable and "latest" links are not - and the discipline simply had not
   reached the estate's own last hop.

   MOVING A PIN IS A CUT, AND THAT IS THE POINT. A data correction and a map
   release become one event a reader can see. It is also a real cost: the
   correction above does NOT reach a reader until the pin moves here. That is
   the right trade, because the alternative is not knowing which of the two
   numbers is on the card - and this file is where a human decides.

   This module lives in the substation-intelligence cartridge, which the
   shell evaluates before the sandbox, so both consumers read one table
   rather than each carrying its own copy of the constants and the digest
   arithmetic.
   ══════════════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const SCHEMA = 'gridatlas.module.pinned-products.v1';
  const RAW = 'https://raw.githubusercontent.com/Ventusltd/';

  /* Each entry: the repository, the 40-character commit the Atlas was built
     against, the path, and the SHA-256 of the bytes served at that commit.
     `bytes` is recorded beside the digest because a truncated response is
     the failure mode a digest catches last and a length catches first. */
  const PINS = {
    'connection-points.v3': {
      repository: 'data-grid-gb',
      ref: '1c9909d1138704b29235c27fd769436dda8a0b18',
      path: 'derived/connection-points.v3.json',
      sha256: '11e28859a6d17cc8ee4047c2032d55d043be98f7123743f3b2b03225e07a4c0c',
      bytes: 2896561,
      schema: 'data-grid-gb.connection-points.v3'
    },
    'gb-transmission-network.v1': {
      repository: 'data-grid-gb',
      ref: '1c9909d1138704b29235c27fd769436dda8a0b18',
      path: 'derived/gb-transmission-network.v1.json',
      sha256: 'fc331cc20b061f85adf18d890762a164328a1c5e84acef6a23d35d36f849fc8a',
      bytes: 10069966,
      schema: 'data-grid-gb.transmission-network.v1'
    },
    'price-decade-rollup': {
      repository: 'data-gb-electricity',
      ref: 'd310e3cec8cd14bc7cd3eef1e37037197bcb0798',
      path: 'derived/price-decade-rollup.json',
      sha256: '18da5059c93cf09f6036bfcaabf56afaedf16d5f03e664c3cf0b0cff1dca970d',
      bytes: 6873,
      schema: 'data-gb-electricity.price-decade-rollup.v2'
    }
  };

  function pin(id) {
    return Object.prototype.hasOwnProperty.call(PINS, id) ? PINS[id] : null;
  }

  function url(id) {
    const entry = pin(id);
    return entry ? RAW + entry.repository + '/' + entry.ref + '/' + entry.path : null;
  }

  /* Absent crypto is NOT a mismatch.
     ------------------------------------------------------------------
     `crypto.subtle` exists only in a secure context, so a page served over
     plain http - a local check-out, a preview server - has no digest to
     offer. That is reported as unverified and the product is still read.
     Only a real disagreement between the bytes and the recorded digest
     refuses, because refusing on absence would make the Atlas unusable
     anywhere but production while proving nothing about the bytes. */
  function encode(text) {
    try {
      return typeof TextEncoder === 'function'
        ? new TextEncoder().encode(text) : null;
    } catch (_) { return null; }
  }

  async function digestBytes(bytes) {
    try {
      const subtle = (window.crypto || {}).subtle;
      if (!subtle || !bytes) return null;
      const digest = await subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(digest))
        .map(byte => byte.toString(16).padStart(2, '0')).join('');
    } catch (_) {
      /* A thrown digest is an unavailable digest, not a wrong one. */
      return null;
    }
  }

  async function digestHex(text) {
    return digestBytes(encode(text));
  }

  /**
   * @returns { state, sha256, expected, ref, bytes_seen, bytes_expected }
   *   state is 'verified', 'MISMATCH', or a stated reason it is unverified.
   *   Only 'MISMATCH' means the caller must refuse.
   *
   * `bytes_seen` is BYTES. The first cut of this module reported
   * `text.length`, which is UTF-16 code units: the node/branch product is
   * 10,069,964 characters and 10,069,966 bytes, so the field disagreed with
   * the `bytes` it was being compared against by two, on a file that was
   * entirely correct. A length is checked as well as a digest because
   * truncation is the failure a length names immediately and a digest only
   * says "different" about.
   */
  async function verify(id, text) {
    const entry = pin(id);
    const bytes = encode(text);
    const seen = bytes ? bytes.length : null;
    if (!entry) {
      return { state: 'unverified: no pin for ' + String(id), sha256: null,
        expected: null, ref: null, bytes_seen: seen, bytes_expected: null };
    }
    const digest = await digestBytes(bytes);
    const answer = { sha256: digest, expected: entry.sha256, ref: entry.ref,
      bytes_seen: seen, bytes_expected: entry.bytes };
    if (seen !== null && seen !== entry.bytes) {
      answer.state = 'MISMATCH';
      answer.detail = 'the response at ' + entry.ref + ' is ' + seen
        + ' bytes, not the recorded ' + entry.bytes;
    } else if (digest === null) {
      answer.state = 'unverified: no subtle crypto in this context';
    } else if (digest === entry.sha256) {
      answer.state = 'verified';
    } else {
      answer.state = 'MISMATCH';
      answer.detail = 'bytes at ' + entry.ref + ' hash to ' + digest
        + ', not the recorded ' + entry.sha256;
    }
    return answer;
  }

  const NS = (window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {});
  NS.pinnedProducts = Object.freeze({
    schema: SCHEMA,
    ids: Object.freeze(Object.keys(PINS)),
    pin,
    url,
    digestHex,
    verify,
    why: 'A branch ref lets an immutable release change what it says without '
      + 'any of its own bytes changing. The schema string defends shape and is '
      + 'blind to values: a correction to data-grid-gb halves published '
      + 'transformer counts under the same schema. The ref is a commit and the '
      + 'bytes are hashed, so a data correction and a map release are one event.',
    not_an_assessment: 'A pin says which bytes were read. It says nothing '
      + 'about whether those bytes are right.'
  });
})();
