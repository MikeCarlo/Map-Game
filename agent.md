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
→ buildings.js → combat.js → ui.js → render.js → input.js → main.js
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
| `js/combat.js` | Soldiers, enemies, hut spawn, attack targeting |
| `js/ui.js` | Bottom bar visibility, info text, selection chrome |
| `js/render.js` | Canvas draw, pie-arc unit HP, death stains |
| `js/input.js` | Touch/mouse, pan vs SELECT mode, action targeting |
| `js/main.js` | Game loop, timers, button listeners, init |
| `css/style.css` | UI layout |
| `index.html` | Shell + script tags |
| `README.md` | Player-facing how-to-play |

## Architecture notes

- **No modules / imports.** Everything is global functions and shared state.
- **Unit AI:** path array + flags (`harvesting`, `mining`, `building`, `repairing`, `tunneling`, `attacking`, `defending`). On path complete, `main.js` calls `start*OnArrival` / `finish*`.
- **Combat:** buildings (base / armory / hut) take damage per tile via `damageBuildingTile`; `onBuildingTileDestroyed` retires the structure when its last tile falls. Soldiers never have a whole-building `hp` field — use `hutHealthStats` / `sumHpForTiles` to report health.
- **Defend:** `defending` + `defendX/defendY` post held in `combat.js`; `updateDefender` engages enemies inside `DEFEND_RADIUS` of the post, drops them past `DEFEND_LEASH`, and walks back. Anything that calls `clearUnitOrders` (Move / Attack / Cancel) releases the post, so re-engaging from a post goes through `engageFromPost`, which restores the post afterwards.
- **Harvest pattern:** one resource unit per trip; worker must return beside base to deposit, then continue.
- **Buildings:** multi-tile footprints; **per-tile HP** in `buildingHpMap`. Color lerps toward grey as HP drops. Aggregate % shown when selecting base/armory.
- **Fog of war:** two `Uint8Array(MAP_W * MAP_H)` layers in `fog.js`. `updateVisibility()` runs once per frame from `main.js` (~0.1 ms) — it clears `visibleMap` and re-stamps a disc per player unit / base segment / armory; `exploredMap` only ever grows. Anything that reveals live state (enemy units, jet pulses, death stains, hut damage, enemy counts in the info bar) must check `isTileVisible` / `isPointVisible`; anything the player could plausibly remember (terrain, resource auto-search targets, hut selection) checks `isTileExplored`. `FOG_ENABLED = false` in `config.js` turns the whole thing off. **Known gap:** A* still paths on the true map, so units route around unseen obstacles.
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
