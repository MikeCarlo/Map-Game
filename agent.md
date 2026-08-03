# Agent guide — Map-Game

Instructions for AI agents working on this repository.

## Project at a glance

- **What:** Mobile-first pixel strategy prototype (Canvas 2D). Harvest wood & Virelium, expand a 3×3 base, build armories, train workers/soldiers, tunnel through rock, fight enemies from huts.
- **Stack:** Vanilla HTML / CSS / JS. No build step, no bundler, no framework.
- **Play:** https://mikecarlo.github.io/Map-Game/ (GitHub Pages from `main`)
- **Owner / repo:** `MikeCarlo/Map-Game`

## Critical constraint: file size when pushing

GitHub connected-tool / MCP pushes work reliably for **~10KB or less per file**. Larger single files (especially the old monolithic `actions.js` ~30KB) get truncated or fail.

**Do not recombine `actions1.js`–`actions5.js` into one file** unless you have a reliable way to push >25KB in one shot (e.g. local `git push` with auth).

When editing actions logic:

1. Edit the correct split file (see map below).
2. Keep each `actionsN.js` under ~7–8KB if possible.
3. Push that file (or a small batch) via the GitHub tool / CLI.
4. Never leave `js/actions.js` as the only source of truth — it is a stub.

## Script load order (`index.html`)

Order matters (globals, no modules):

```
config.js → state.js → map.js → fog.js → pathfinding.js
→ actions1.js → actions2.js → actions3.js → actions4.js → actions5.js
→ buildings.js → drops.js → training.js → construction.js → combat.js → ui.js → render.js → minimap.js
→ tutorial.js → landing.js → input.js → main.js
```

`js/actions.js` is a **stub only** (comment pointing at the split files). Do not put logic there.

## File map

| File | Responsibility |
|------|----------------|
| `js/config.js` | Map size, tile IDs, colors, HP/combat/repair constants |
| `js/state.js` | Global state, unit factory, selection, `clearUnitOrders` |
| `js/map.js` | Procedural generation, walkability, resources, jets |
| `js/fog.js` | Fog of war: `visibleMap` / `exploredMap`, sight radii, `updateVisibility` |
| `js/pathfinding.js` | A*, `applyPath`, stand-tile occupancy helpers |
| `js/actions1.js` | Move, group move/cut/mine, tree helpers |
| `js/actions2.js` | Cut / harvest wood (one density → return to base) |
| `js/actions3.js` | Mine Virelium, base placement / upgrade spot |
| `js/actions4.js` | Armory, build, tunnel, train worker/soldier |
| `js/actions5.js` | Repair (damaged friendly base/armory tiles) |
| `js/buildings.js` | Per-tile building HP, color fade, damage/repair helpers |
| `js/drops.js` | Cargo dropped on the ground when a laden worker is attacked, and pickup |
| `js/training.js` | Training queue: timed worker/soldier jobs per building |
| `js/construction.js` | Build timers: worker build sites + timed base upgrade |
| `js/combat.js` | Soldiers, enemies, hut spawn, attack targeting |
| `js/ui.js` | Bottom bar visibility, info text, selection chrome |
| `js/render.js` | Canvas draw, pie-arc unit HP, death stains |
| `js/minimap.js` | Minimap overview canvas, tap-to-jump camera |
| `js/tutorial.js` | Guided levels: step definitions, predicates, panel |
| `js/landing.js` | Start screen, map-size selection, `startGame` |
| `js/input.js` | Touch/mouse, pan vs SELECT mode, action targeting |
| `js/main.js` | Game loop, timers, button listeners, init |
| `css/style.css` | UI layout |
| `index.html` | Shell + script tags |
| `README.md` | Player-facing how-to-play |

## Architecture notes

- **No modules / imports.** Everything is global functions and shared state.
- **Unit AI:** path array + flags (`harvesting`, `mining`, `building`, `repairing`, `tunneling`, `attacking`, `defending`). On path complete, `main.js` calls `start*OnArrival` / `finish*`.
- **Unit HP:** workers (`WORKER_MAX_HP`), soldiers and enemies all carry `hp`/`maxHp`; `drawUnitBody` renders it as a pie-arc. `damageUnit(u, amount, attacker)` takes the attacker so a struck worker can set `retaliateTargetId`. `updateWorkerRetaliation` makes workers swing back weakly (`WORKER_ATTACK_DAMAGE`) at an adjacent attacker only — no chasing, expires after `WORKER_RETALIATE_TIME`.
- **Dropped cargo:** `drops.js`. A laden worker struck by an enemy runs `dropCargoUnderAttack` from inside `damageUnit`, which puts the load on its tile and stops the haul (`harvesting`/`mining` stay set so the job resumes later); `removeUnit` drops cargo too, so a death never destroys it. `updateDropPickups()` (from `main.js`) lets any empty-handed worker collect a pile it is standing on and `haulPickedUpDrop` routes it to a base — it skips workers where `isWorkerFightingBack`, otherwise a worker would snatch the load straight back mid-fight. Piles are drawn **after** units so a worker cannot hide its own load, and are gated on `isTileExplored` (a pile never moves, so remembering it leaks nothing).
- **Combat:** buildings (base / armory / hut) take damage per tile via `damageBuildingTile`; `onBuildingTileDestroyed` retires the structure when its last tile falls. Soldiers never have a whole-building `hp` field — use `hutHealthStats` / `sumHpForTiles` to report health.
- **Defend:** `defending` + `defendX/defendY` post held in `combat.js`; `updateDefender` engages enemies inside `DEFEND_RADIUS` of the post, drops them past `DEFEND_LEASH`, and walks back. Anything that calls `clearUnitOrders` (Move / Attack / Cancel) releases the post, so re-engaging from a post goes through `engageFromPost`, which restores the post afterwards.
- **Training:** `trainingJobs` in `state.js`, logic in `training.js`. `trainUnitAtBase` / `trainSoldierAtArmory` only *enqueue* — `updateTraining(dt)` (called from `main.js`) ticks the head job per building key (`'base'` for the whole base, `armory:x,y` per armory) and calls `spawnUnitNear` when it completes. The trainee is **not** selected: the building stays selected so you can queue several. Caps count queued units (`trainingCapReached`) and are re-checked at pop time (`trainingCapFull`). `pruneTrainingJobs()` runs from `onBuildingTileDestroyed`; `resetTraining()` from `newMap` / init.
- **Construction:** buildings take time. A worker build arrives → `startBuildOnArrival` sets `u.buildTimer` (`BUILD_ARMORY_TIME` / `BUILD_BASE_TIME`), `main.js` ticks it, `finishBuild` places the tiles. The base **Upgrade** button has no worker: `startBaseUpgrade` puts a self-raising site in `baseUpgrade` (`state.js`) that `updateBaseUpgrade(dt)` finishes after `BASE_UPGRADE_TIME`; the button doubles as cancel. `footprintIsFree` / `isReservedByConstruction` stop two builds claiming the same ground. `constructionSites()` feeds the renderer.
- **Harvest pattern:** one resource unit per trip; worker must return beside base to deposit, then continue.
- **Buildings:** multi-tile footprints; **per-tile HP** in `buildingHpMap`. Color lerps toward grey as HP drops. Aggregate % shown when selecting base/armory.
- **Fog of war:** two `Uint8Array(MAP_W * MAP_H)` layers in `fog.js`. `updateVisibility()` runs once per frame from `main.js` (~0.1 ms) — it clears `visibleMap` and re-stamps a disc per player unit / base segment / armory; `exploredMap` only ever grows. Anything that reveals live state (enemy units, jet pulses, death stains, hut damage, enemy counts in the info bar) must check `isTileVisible` / `isPointVisible`; anything the player could plausibly remember (terrain, resource auto-search targets, hut selection) checks `isTileExplored`. `FOG_ENABLED = false` in `config.js` turns the whole thing off. **Known gap:** A* still paths on the true map, so units route around unseen obstacles.
- **Minimap:** own canvas overlay (`#minimap`), redrawn from the tail of `draw()`. Terrain is a 1 px-per-tile `ImageData` written through a `Uint32Array` view using flat per-tile-type palettes (lit + dimmed), then upscaled with smoothing off — ~0.1 ms/frame. It reads the same fog helpers as the main view, so it can never show more than the player knows. Its pointer handlers `stopPropagation` so taps never reach the game canvas.
- **Startup:** there is **no world on page load**. `initGame` only builds the landing screen; `startGame(sizeKey, level)` in `landing.js` is the single entry point that generates a map and resets state. `draw()` / `updateVisibility()` no-op while `map` is null, so the loop spins harmlessly behind the overlay.
- **Starting position:** `findStarterBaseSpot` requires the spot to touch a connected walkable region of at least `max(120, 6% of the map)` (`connectedLandSize`), falling back to any valid footprint. Without it the base can land on a small island with the rest of the world across water — unplayable, and it made tutorial levels unfinishable.
- **Map size:** `MAP_W` / `MAP_H` are `let`, not `const` — `setMapSize()` is the only writer, and it must call `invalidateMinimapBuffer()` because the minimap's `ImageData` is sized to the old map. Everything else reads the dimensions at call time. Generation counts are tuned for 128×128 and scaled by `scaledCount()` / `mapAreaScale()`, so a small map is not over-dense.
- **Tutorial:** `TUTORIAL_LEVELS` in `tutorial.js`. Steps are checked **sequentially** — only the current step's `done()` runs, so a later objective being true early cannot skip the teaching before it. A step with no `done()` is informational and waits for the *Got it* button. A level's `map` object is passed to `generateMap(opts)` to shape the world (`hut: false` on every level except the last, plus `trees` / `jets` / `water` / `rock` toggles), and `setup()` seeds the rest (`tutorialGrantArmory`, `tutorialPlantGrove`, `tutorialSeedVirelium`, `tutorialClearArea`, `tutorialSpawn`) — map generation is random, so a level that says "cut a tree" must plant one rather than hope. The tutorial panel is positioned above `uiPanelTop()` and re-positioned by a `ResizeObserver` on `#ui`, because the action bar's height changes with the selection and a stale position leaves the panel covering the buttons. Progress lives in `localStorage` under `mapgame.tutorial.completed`.
- **Sticky Move:** every `actionMode` is one-shot (cleared in `input.js` once the order lands) **except** `moveTarget`, which stays armed so the player can keep re-routing. It is cleared by the Move button toggling itself off, by `clearSelection` / `setMultiSelection`, or by tapping a unit outside the current selection (which selects that unit instead of moving onto it). Tapping a unit *inside* the selection is still a move target.
- **Occupancy:** idle units cannot share a stand tile (`isTileBlockedForStand` / goal reservation).
- **Mobile SELECT mode:** double-tap empty ground toggles pan vs locked; long-press drag box-select only when locked. Grey dashed viewport border in SELECT mode.

## How to change gameplay

1. **Constants** → `config.js` (e.g. `REPAIR_TIME`, `BUILDING_TILE_MAX_HP`, attack damage).
2. **New worker action** → add state fields in `state.js` / `clearUnitOrders`; implement `set*Target` + finish/start helpers in the right `actionsN.js`; wire timer in `main.js`; mode in `input.js`; button + info in `ui.js` + `index.html`.
3. **Combat / enemies / defend** → `combat.js` + constants in `config.js`.
4. **Building HP / repair** → `buildings.js` + `actions5.js`.
5. **Rendering** → `render.js` only (keep logic out of draw).

## Git / deploy workflow for agents

- Default branch: **`main`** (GitHub Pages serves this).
- Prefer **small commits** with one logical change.
- After push, user hard-refreshes https://mikecarlo.github.io/Map-Game/
- If a push of a large file fails or the live game “selects but does nothing,” check that `actions1.js`–`actions5.js` are non-empty on `main` and that `index.html` still loads all five in order.

### Preferred push approach

- **Local git + auth:** full files are fine.
- **Connected GitHub tool / MCP:** keep payloads small; push one or few files per call; never dump a 30KB string into a single tool argument.

## Conventions

- Match existing style: plain functions, early returns, short names (`u`, `tx`/`ty`, `dt`).
- Do not introduce a bundler, TypeScript, or npm dependencies unless the human asks.
- Keep mobile touch as the primary interaction model.
- When adding UI buttons, update both `index.html` and the corresponding listeners in `main.js` / visibility in `ui.js`.

## Quick smoke test after changes

1. New Map → worker appears by purple base.
2. Select worker → Move → tap ground → unit walks.
3. Cut → tap forest → one density drop → return to base → wood increments.
4. Mine → tap cyan deposit → same return pattern for Virelium.
5. (If repair/combat touched) damage a base tile → Repair → HP/color recovers.

## Related docs

- Player instructions and controls: `README.md`
