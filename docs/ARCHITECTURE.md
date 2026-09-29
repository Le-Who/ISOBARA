# Architecture

The existing runtime is TypeScript with locally vendored Three.js. Keep the 3D scene, camera, authored model kit, local UI images and offline builds when implementing roadmap packages. A general roadmap request does not authorize an engine migration, a 2D rewrite, asset removal or replacement of existing visuals with placeholders. Those changes require a separate explicit owner request. See [AGENTS.md](../AGENTS.md).

`src/core` contains deterministic game rules, combat, progression, validation, persistence, input and Web Audio synthesis. `Simulation` accepts input frames; visual rendering never awards loot or applies damage independently. `GameState` is the serializable source of truth. Short-lived projectiles, visual events and spatial lookup arrays live outside the save.

Version 2 extends that state with deterministic overworld encounter records, NPC conversation memory, weapon blueprints, the selected skill and postfinal forecast rank. `src/core/migrate.ts` maps version 1 saves to the current data, generator and rules versions before validation; it keeps the source object intact and translates XP to retain the old level. `src/core/dialogue.ts`, `weapons.ts` and `ranks.ts` own dialogue outcomes, attack families and rank rules. Saved encounter IDs and rosters are checked against the seed's generated world, including elite health bounds.

Release 2.1 uses data version 3 while retaining generator/rules version 2. Supported v1/v2 saves migrate without clearing partial world encounters or replacing the active roster. Optional `Item.refit` is bounded to 0–3. Experimental revision saves with rules version 3 are not equivalent to this schema. On reconstruction, enemy windup/charge is cancelled and a fresh cooldown is applied because transient warning geometry is not serialized; positions and health are preserved.

`src/world/world.ts` generates finite overworld chunks from the world seed and coordinates. A bounded cache retains descriptors, while the renderer owns streamed GPU resources. Main signals guarantee access to each campaign tier. Random portals use distance-dependent weighted distributions rather than uniform concentric tier bands.

`src/world/encounters.ts` supplies fixed and seeded patrols, devices and NPC positions. The home station is a safe zone. `Simulation` gives world enemies their own lifecycle and persists living health and completed encounters. World death returns the player to the station without creating an expedition run; active threat gates travel, equipment changes and salvage.

`src/world/dungeon.ts` constructs a finite graph of authored modules. Module geometry and obstacle descriptors also feed clearance-aware navigation. The generator uses limited retries and a validated fallback. The player and enemies use the same walkability rules. Combat objectives are a finite roster rather than unbounded spawning waves.

`src/world/navigation.ts` provides movement constraints, line checks, navigation-grid validation, path search and flow fields. These are kinematic planar movement rules over a fully rendered 3D environment, not a general-purpose rigid-body simulation. Overworld elevation is sampled independently.

`src/render/models.ts` is the authored 3D kit: playable characters, enemies, bosses, portal frames, station equipment and decorative components. The three alternate weapon families have different equipped tool geometry; the three station NPCs have distinct silhouettes, while encounter beacons and named elites have separate cues. Shared geometries and materials have explicit ownership. `GameView` streams terrain, instances recurring props, keeps bounded particle pools, animates models and disposes transient scene resources. Skill events carry a visual identifier for authored lance, anchor, gust and finisher effects. Returning discs use a separate instanced 3D projectile mesh.

`src/ui` contains DOM interfaces and canvas maps. Text from imported saves is escaped before inclusion in HTML. Image references are a fixed local atlas manifest. There is no executable user script field.

Transient notices use a compact stack below the health panel at the left edge of the HUD. Its pointer events are disabled so it cannot intercept combat input; modal decisions and persistent storage errors retain their separate UI paths.

The inventory derives before/after totals from `stats()` rather than estimating only an item's own numbers. Favorite flags survive save validation and block salvage. The title, HUD and dialogue remain local DOM over the Three.js canvas. The 12 existing WebP images and nine additional PNGs are embedded in both builds. Instrument art is resolved from the validated family at display time, so imported v2 items with an older icon remain visually correct without a save rewrite.

The workshop supports directed slot crafting, bounded refits and selecting an existing rare-item effect. Inventory actions are gated by the existing combat rules. Bulk salvage compares the current exact preview with a detached confirmation snapshot before mutation; equipped, favorite, refitted and explicit-family items are excluded. Single and bulk salvage share one valuation. Item delivery reports bag/mail/shards; a full bag and 2000-item mailbox convert new rewards to salvage value, while paid crafting rejects the operation before charging.

Renderer quality changes invalidate shared, active and retained grass materials when shadow enablement changes. Without this, cached lit shaders can retain incompatible shadow samplers. Motion smoothing and restored-world lighting stay presentation-only; neither changes simulation timing or collision geometry.

`SaveStore` serializes writes, rotates the previous valid snapshot and stores one complete envelope per transaction. Web Locks supplies a single-writer lock where available; a transaction-checked lease is the fallback. A critical reward action rolls back its in-memory change when its storage write fails. Import performs schema, bounds, identity, roster and checksum checks before replacement.

`tools/build.mjs` transpiles and bundles only local modules. It produces a static multi-file build and a self-contained HTML build. Dependencies used to build are not needed to play. The runtime makes no model requests, payments, telemetry requests or account calls.

`src/core/cloud.ts` is an optional, explicitly invoked snapshot transport. It has no startup network action. A random recovery secret derives a domain-separated AES-GCM key and opaque locator; only encrypted snapshot bytes and the locator reach the service. Downloaded plaintext uses the ordinary validation and confirmed import path. Requests are bounded and time out. `tools/cloud-server.mjs` is a separate dependency-free Node companion with immutable files, explicit origins and storage/concurrency quotas, loopback by default. It is not started by the offline launcher and is not an authenticated public hosting product. See [cloud backups](CLOUD_BACKUPS.md) for deployment boundaries.

`tools/package_release.py` packages the current version after checks into `output/releases/` without modifying historical asset reports. The reference `revisions/` directories and private companion snapshot storage are deliberately excluded. See [the 2.1 revision review](REVISION_2.1_REVIEW.md) for the accepted features and deferred proposals; [the earlier review](REVISION_INTEGRATION.md) records 2.0.

`dist/`, `public/assets/` and `output/assets/` are retained as project deliverables. `evidence/` retains compact Markdown/JSON reports, Python audit scripts and the complete asset-audit provenance archive; routine screenshots, raw logs and exported test saves stay local. See [evidence policy](../evidence/README.md). The release packager applies the same selection. Reproducible ZIPs in `output/releases/`, temporary test builds and local reference copies are ignored by Git. Normal `npm run build` does not make a ZIP.

## Expected manual review

Automated navigation and simulation checks do not establish artistic quality, all-player balance, complete accessibility or driver compatibility. Browser-integration fixtures are explicitly separate from campaign playthroughs. See the generated TEST_REPORT.md for actual recorded outcomes.
