# Coil QC

**Status: candidate ready for coordinator review.** One isolated coil remains; the foreign fragment visible below the original coil is absent. The copper winding, metal terminals and turquoise electrical detail remain recognizable. No text, logo, border, pedestal, extra object or scene is visible.

- Exact image_gen output PNG: `output/assets/repair-candidates/02-electrical-tools/coil-source.png` — 1331×1181 RGBA; alpha bounds `[110, 54, 1295, 1171]`; margins L/T/R/B 8.26/4.57/2.7/0.85%; no alpha touches the source canvas edge.
- WebP candidate: `output/assets/repair-candidates/02-electrical-tools/coil.webp` — 352×312 RGBA WebP (lossless); alpha extrema `[0, 255]`; bounds `[42, 33, 310, 279]`.
- Candidate margins L/T/R/B: 11.93/10.58/11.93/10.58%; edge touches: `{'left': False, 'top': False, 'right': False, 'bottom': False}`. The centered full canvas follows the original icon aspect ratio and has at least 8% transparent margin on every side.
- Readability previews: `previews/coil-48-dark.png`, `previews/coil-48-light.png`, `previews/coil-64-dark.png`, `previews/coil-64-light.png`; backgrounds are `#102a2e` and `#eee8d8`.
- Provenance ties the PNG to the exact `output_hint` path returned by the successful built-in image_gen edit. Its model ID was not exposed. The earlier cross-task rotor collision remains only as `coil-source-rejected-foreign-rotor.png` and is excluded from this QC.
- No game integration/tests were run. Fork was left to the coordinator's retained audit.
