# Architecture

`src/core` contains deterministic game rules, combat, progression, validation, persistence, input and Web Audio synthesis. `Simulation` accepts input frames; visual rendering never awards loot or applies damage independently. `GameState` is the serializable source of truth. Short-lived projectiles, visual events and spatial lookup arrays live outside the save.

`src/world/world.ts` generates finite overworld chunks from the world seed and coordinates. A bounded cache retains descriptors, while the renderer owns streamed GPU resources. Main signals guarantee access to each campaign tier. Random portals use distance-dependent weighted distributions rather than uniform concentric tier bands.

`src/world/dungeon.ts` constructs a finite graph of authored modules. Module geometry and obstacle descriptors also feed clearance-aware navigation. The generator uses limited retries and a validated fallback. The player and enemies use the same walkability rules. Combat objectives are a finite roster rather than unbounded spawning waves.

`src/world/navigation.ts` provides movement constraints, line checks, navigation-grid validation, path search and flow fields. These are kinematic planar movement rules over a fully rendered 3D environment, not a general-purpose rigid-body simulation. Overworld elevation is sampled independently.

`src/render/models.ts` is the authored 3D kit: playable characters, enemies, bosses, portal frames, station equipment and decorative components. Shared geometries and materials have explicit ownership. `GameView` streams terrain, instances recurring props, keeps bounded particle pools, animates models and disposes transient scene resources.

`src/ui` contains DOM interfaces and canvas maps. Text from imported saves is escaped before inclusion in HTML. Image references are a fixed local atlas manifest. There is no executable user script field.

`SaveStore` serializes writes, rotates the previous valid snapshot and stores one complete envelope per transaction. Web Locks supplies a single-writer lock where available; a transaction-checked lease is the fallback. A critical reward action rolls back its in-memory change when its storage write fails. Import performs schema, bounds, identity, roster and checksum checks before replacement.

`tools/build.mjs` transpiles and bundles only local modules. It produces a static multi-file build and a self-contained HTML build. Dependencies used to build are not needed to play. The runtime makes no model requests, payments, telemetry requests or account calls.

## Expected manual review

Automated navigation and simulation checks do not establish artistic quality, all-player balance, complete accessibility or driver compatibility. Browser-integration fixtures are explicitly separate from campaign playthroughs. See the generated TEST_REPORT.md for actual recorded outcomes.
