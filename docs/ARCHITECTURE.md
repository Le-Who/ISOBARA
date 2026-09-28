# Architecture

The existing runtime is TypeScript with locally vendored Three.js. Keep the 3D scene, camera, authored model kit, local UI images and offline builds when implementing roadmap packages. A general roadmap request does not authorize an engine migration, a 2D rewrite, asset removal or replacement of existing visuals with placeholders. Those changes require a separate explicit owner request. See [AGENTS.md](../AGENTS.md).

`src/core` contains deterministic game rules, combat, progression, validation, persistence, input and Web Audio synthesis. `Simulation` accepts input frames; visual rendering never awards loot or applies damage independently. `GameState` is the serializable source of truth. Short-lived projectiles, visual events and spatial lookup arrays live outside the save.

Version 2 extends that state with deterministic overworld encounter records, NPC conversation memory, weapon blueprints, the selected skill and postfinal forecast rank. `src/core/migrate.ts` maps version 1 saves to the current data, generator and rules versions before validation; it keeps the source object intact and translates XP to retain the old level. `src/core/dialogue.ts`, `weapons.ts` and `ranks.ts` own dialogue outcomes, attack families and rank rules. Saved encounter IDs and rosters are checked against the seed's generated world, including elite health bounds.

`src/world/world.ts` generates finite overworld chunks from the world seed and coordinates. A bounded cache retains descriptors, while the renderer owns streamed GPU resources. Main signals guarantee access to each campaign tier. Random portals use distance-dependent weighted distributions rather than uniform concentric tier bands.

`src/world/encounters.ts` supplies fixed and seeded patrols, devices and NPC positions. The home station is a safe zone. `Simulation` gives world enemies their own lifecycle and persists living health and completed encounters. World death returns the player to the station without creating an expedition run; active threat gates travel, equipment changes and salvage.

`src/world/dungeon.ts` constructs a finite graph of authored modules. Module geometry and obstacle descriptors also feed clearance-aware navigation. The generator uses limited retries and a validated fallback. The player and enemies use the same walkability rules. Combat objectives are a finite roster rather than unbounded spawning waves.

`src/world/navigation.ts` provides movement constraints, line checks, navigation-grid validation, path search and flow fields. These are kinematic planar movement rules over a fully rendered 3D environment, not a general-purpose rigid-body simulation. Overworld elevation is sampled independently.

`src/render/models.ts` is the authored 3D kit: playable characters, enemies, bosses, portal frames, station equipment and decorative components. The three alternate weapon families have different equipped tool geometry; the three station NPCs have distinct silhouettes, while encounter beacons and named elites have separate cues. Shared geometries and materials have explicit ownership. `GameView` streams terrain, instances recurring props, keeps bounded particle pools, animates models and disposes transient scene resources. Skill events carry a visual identifier for authored lance, anchor, gust and finisher effects. Returning discs use a separate instanced 3D projectile mesh.

`src/ui` contains DOM interfaces and canvas maps. Text from imported saves is escaped before inclusion in HTML. Image references are a fixed local atlas manifest. There is no executable user script field.

Transient notices use a compact stack below the health panel at the left edge of the HUD. Its pointer events are disabled so it cannot intercept combat input; modal decisions and persistent storage errors retain their separate UI paths.

The inventory derives before/after totals from `stats()` rather than estimating only an item's own numbers. Favorite flags survive save validation and block salvage. The title, HUD and dialogue remain local DOM over the Three.js canvas. The 12 existing WebP images and nine additional PNGs are embedded in both builds. Instrument art is resolved from the validated family at display time, so imported v2 items with an older icon remain visually correct without a save rewrite.

`SaveStore` serializes writes, rotates the previous valid snapshot and stores one complete envelope per transaction. Web Locks supplies a single-writer lock where available; a transaction-checked lease is the fallback. A critical reward action rolls back its in-memory change when its storage write fails. Import performs schema, bounds, identity, roster and checksum checks before replacement.

`tools/build.mjs` transpiles and bundles only local modules. It produces a static multi-file build and a self-contained HTML build. Dependencies used to build are not needed to play. The runtime makes no model requests, payments, telemetry requests or account calls.

`tools/package_release.py` packages the current version after checks into `output/releases/` without modifying historical asset reports. The reference `revisions/` directories are deliberately excluded. See [the revision review](REVISION_INTEGRATION.md) for the accepted features and deferred proposals.

`dist/`, `public/assets/`, `output/assets/` and `evidence/` are retained as project deliverables. The reproducible ZIPs in `output/releases/`, temporary test builds and local reference copies are ignored by Git. Normal `npm run build` does not make a ZIP.

## Expected manual review

Automated navigation and simulation checks do not establish artistic quality, all-player balance, complete accessibility or driver compatibility. Browser-integration fixtures are explicitly separate from campaign playthroughs. See the generated TEST_REPORT.md for actual recorded outcomes.
