# Furnace candidate QC

- Opened the copied PNG and visually confirmed it is one furnace; the foreign fragment beneath the reference item is absent. The furnace body, fittings, warm central heat and existing colors remain recognizable.
- PNG is RGBA, 1214×1295, with genuine transparency and partial alpha. The alpha≥128 silhouette bounds are `[275, 77, 962, 1159)` (exclusive right/bottom), giving margins of 22.7% left, 5.9% top, 20.8% right and 10.5% bottom. The useful silhouette is centered and clears the canvas edge.
- Two fully black pixels with alpha=1 occur at the far-left canvas edge (`(0,1235)` and `(0,1237)`). They are effectively transparent and not perceptible in the icon-size checks; no solid silhouette touches an edge.
- Visually checked at 48 px and 64 px maximum edge on both `#102a2e` and `#eee8d8`: the furnace silhouette and hot center remain distinguishable; no foreign fragment is visible.
- WebP is a lossless RGBA resize of the whole PNG canvas to 360×384, with no crop. Decoded pixels match the Lanczos-resized PNG exactly. The copied PNG SHA-256 matches the exact source path returned by the generation call.
- Gauge was not re-audited or generated in this task, per coordinator instruction; the central audit remains authoritative.
