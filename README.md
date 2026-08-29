# Grid Atlas V9

Standalone, evidence-gated successor to the immutable GlobalGrid Atlas V8.

V9 compiles the official DESNZ REPD Q2 2026 extract into typed ZSTD Parquet with DuckDB 1.3.2, verifies it against the pinned V8 project/coordinate oracle, and publishes a browser registry with official project addresses and postcodes.

The address/fly-to cartridge searches project name, official REPD address, official postcode, county, planning authority and REPD reference. It never uses proximity to claim project identity or ownership.

Live route: https://ventusltd.github.io/gridatlas/
