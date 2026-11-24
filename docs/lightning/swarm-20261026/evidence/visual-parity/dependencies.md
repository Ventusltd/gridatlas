| host | requests | served by shim | ok (live) | failed | 4xx/5xx | classification | notes |
|---|---|---|---|---|---|---|---|
| 127.0.0.1:8102 | 352 | 0 | 352 | 0 | 0 | LOCAL (repo served on 8102) |  |
| cdn.jsdelivr.net | 66 | 48 | 0 | 18 | 0 | BLOCKED_DEPENDENCY (aborted by shim / refused by allowlist) | net::ERR_ABORTED; shim-404-no-local-copy: https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/+esm; net::ERR_TUNNEL_CONNECTION_FAILED |
| raw.githubusercontent.com | 25 | 0 | 1 | 24 | 0 | MIXED | net::ERR_BLOCKED_BY_CLIENT.Inspector; aborted-by-shim: https://raw.githubusercontent.com/Ventusltd/data-grid-gb/1c9909d1138704b29235c27fd769436dda8a0b18/derived/connection-poi; aborted-by-shim: https://raw.githubusercontent.com/Ventusltd/data-grid-gb/1c9909d1138704b29235c27fd769436dda8a0b18/derived/gb-transmissio |
| basemaps.cartocdn.com | 16 | 16 | 0 | 0 | 0 | SHIM-SERVED (local copy answered inside the test browser) |  |
| ventusltd.github.io | 24 | 8 | 0 | 16 | 0 | BLOCKED_DEPENDENCY (aborted by shim / refused by allowlist) | net::ERR_BLOCKED_BY_CLIENT.Inspector; aborted-by-shim: https://ventusltd.github.io/ventus-grid-engine/genome/engine-graph.json |
