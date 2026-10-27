#!/usr/bin/env bash
# Step E reachability receipts (issue #32 §8 Step E, R07, R08). Harness: sandbox shell curl via the
# session agent proxy (HTTPS_PROXY as preconfigured; TLS verification ON; proxy NOT bypassed).
# Candidate: gridatlas fda6b10f7d2672bf1bf74c4fbf6184cd36b1ec1d (generation 202610261949).
# One curl invocation per host. Each URL is one the candidate route really requests (source cited).
set -u
OUT="$1"
run () { # $1=label $2=url $3=source citation
  local f="$OUT/$1.txt"
  {
    echo "label:  $1"
    echo "url:    $2"
    echo "source: $3"
    echo "start_utc: $(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)"
    echo "cmd: curl -sS --max-time 25 --max-filesize 3000000 -H 'Origin: http://localhost:8000' -D <headers> -o <body> -w <metrics> '$2'"
    echo "----- curl stderr / metrics -----"
    curl -sS --max-time 25 --max-filesize 3000000 -H 'Origin: http://localhost:8000' \
      -D "$OUT/$1.headers" -o "$OUT/$1.body" \
      -w 'http_code=%{http_code} http_connect=%{http_connect} remote_ip=%{remote_ip} size_download=%{size_download} time_total=%{time_total}\n' \
      "$2" 2>&1
    echo "curl_exit=$?"
    echo "end_utc:   $(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)"
    echo "----- response headers (as received by curl; proxy CONNECT reply first if any) -----"
    cat "$OUT/$1.headers" 2>/dev/null || echo "(none)"
    echo "----- body bytes: $(wc -c < "$OUT/$1.body" 2>/dev/null || echo 0); first 300 bytes -----"
    head -c 300 "$OUT/$1.body" 2>/dev/null; echo
  } > "$f" 2>&1
  echo "== $1"; sed -n '4p;7,9p' "$f"
}
run raw-githubusercontent-index 'https://raw.githubusercontent.com/Ventusltd/lightning/main/data/history/index.json' 'atlas/modules/202610261949-uk-lightning-overlay.js:9,46 (AR+index.json, fetch cache:no-cache)'
run ventusltd-github-io-data-manifest 'https://ventusltd.github.io/data-gridatlas/202608291237-data-gridatlas/data/manifest.json' 'atlas/cartridges/202609241251-streaming-parquet-bridge-v9-5.js:5-6,105 (Parquet data plane manifest)'
run basemaps-cartocdn-style 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json' 'atlas/releases/202608300453-atlas-v9/ventus-corev8engine.js:613; substation-intelligence-v9-63.js:667'
run tiles-basemaps-cartocdn-glyphs 'https://tiles.basemaps.cartocdn.com/fonts/Montserrat%20Medium/0-255.pbf' 'atlas/cartridges/202609241334-sld-sandbox-v9-8.js:5272 (glyphs template; fontstack chosen for the probe only)'
run extensions-duckdb-org-parquet 'https://extensions.duckdb.org/v1.1.1/wasm_eh/parquet.duckdb_extension.wasm' 'duckdb-wasm 1.29.0 binary strings: v1.1.1, wasm_eh, /${REVISION}/${PLATFORM}/${NAME}.duckdb_extension (path derived, not browser-observed)'
run cdn-jsdelivr-maplibre 'https://cdn.jsdelivr.net/npm/maplibre-gl@3.6.2/dist/maplibre-gl.js' 'atlas/releases/202608300453-atlas-v9/index.html:133 (supplementary host, not in the task list)'
