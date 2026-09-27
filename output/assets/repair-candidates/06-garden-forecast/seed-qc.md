# Seed QC

- Reviewed the original reference and the edited result. The capsule's restored top completes the existing silhouette; the background is transparent, and the glass, metal, and foliage remain visually coherent.
- `seed-source.png` is the exact built-in result copy (SHA-256 `4054db69b9b3307bfe31de60b1e0979aaeca447636153de5feeb2f0887aa1167`), at 1329×1183 px, RGBA with alpha range 0–255.
- `seed.webp` is pixel-exact lossless WebP at 379×384 px (maximum edge 384), RGBA with alpha range 0–255. Full canvas retained without cropping. Bounds use alpha ≥8: `86, 30, 293, 354` (right/bottom exclusive), giving transparent margins L/T/R/B 22.69% / 7.81% / 22.69% / 7.81%.
- The reported lower-right strip was traced to hidden RGB in fully transparent pixels: re-creating the initial WebP export shows 72 such pixels in ROI `x=292..331, y=264..349` (right/bottom exclusive), with alpha 0 throughout. The final lossless WebP canonicalizes RGB to 0 under alpha=0. Alpha is unchanged, and composites are pixel-identical on both `#102a2e` and `#eee8d8` (`True` / `True`); final count of nonblack RGB pixels under alpha=0 is 0.
- At both 48 px and 64 px, the icon remains identifiable on `#102a2e` and `#eee8d8`; all four size/background combinations were inspected.
