# V9.194 GridAtlas vicinity preview (202611222000)

**Candidate, not live.** V9.191 remains on `atlas/current.json`. This composes its six existing cartridges, succeeding only the existing 30/30/30 offtakers module and appending one REPD-specific VICINITY control. It does not install any Journey feature.

From a PipelineNews MAP URL with a valid REPD reference and UK coordinates, VICINITY opens the same native Grid Engine 30-nearest-substation / 30-nearest-REPD / 30-nearest-conventional screening, with 5/10/20 km area rings and straight-line caveats. Swipe left/right or use Previous/Next to browse up to 90 physical mapped places. Every resulting selected point is visibly identified on the native map.

The original MAP result and Hide Layers remain untouched. A single owned highlight marker is removed on close. Missing data is not silently treated as zero. Preserve the previous immutable V9.191 composition for rollback.

**Acceptance required before promotion:** source SHA-256 and syntax proof; hosted Chromium and WebKit genuine touch/click; source inventory availability; screenshot of the MAP arrival, Hide Layers collapse/reopen and three vicinity tabs; swipe across 30/30/30 boundaries; iPhone Safari portrait and landscape; exact public-preview served-byte validation. Create a separate pointer-only promotion PR only after those gates.
