# Map Game

Pixel strategy prototype — explore a procedural map, harvest resources, build bases, train workers, and tunnel through mountains.

**Play online:** [https://mikecarlo.github.io/Map-Game/](https://mikecarlo.github.io/Map-Game/)

Or open [index.html](index.html) after cloning, or run a local server.

---

## How to run

```bash
# Option A — open the file
open index.html          # macOS
# or double-click index.html

# Option B — local server (recommended)
npx serve .
```

Mobile-friendly: full-screen canvas, bottom action bar, pinch-to-zoom and drag-to-pan.

---

## Goal (prototype)

There is no win condition yet. Experiment with:

1. Cutting forests for **wood**
2. Mining **Virelium** deposits
3. Building **L-shaped purple bases**
4. **Training** more workers at bases
5. **Tunneling** through mountain ranges so workers can cross the map

Resources must be carried back to a base one unit at a time. Workers move slower when carrying cargo (wood weight 1, Virelium weight 3).

---

## Map features

| Terrain              | Color                  | Notes                                                                 |
|----------------------|------------------------|-----------------------------------------------------------------------|
| Dirt                 | Brown                  | Walkable                                                              |
| Forest               | Green (shades)         | Harvestable; lighter = lower density (1–5)                            |
| Stumps               | Dark brown             | Tree fully harvested                                                  |
| Mountains            | Grey (shaded peaks)    | Impassable until tunneled                                             |
| Tunnels              | Dark brown path        | Walkable after digging                                                |
| Ocean / rivers       | Blue                   | Impassable                                                            |
| Virelium jet         | Dark hole + cyan rim   | Spawns mineral deposits nearby                                        |
| Virelium deposit     | Cyan / teal            | Density 1–10; one harvest per density                                 |
| Base                 | Purple L shape         | Deposit point; train workers                                          |

**Map size:** 128 × 128 tiles (each tile is 8 px).

---

## Controls

### Camera

- **Drag** to pan the map
- **Pinch** (touch) or **mouse wheel** to zoom
- **New Map** — generate a fresh procedural world (resets everything)
- **Reset View** — fit the entire map on screen

### Selecting units & bases

- **Tap a red dot** (worker) to select it → yellow selection ring appears
- **Tap any purple base tile** to select the base
- Tap empty space or use **Cancel** to deselect

The bottom action bar changes based on what is selected.

---

## Worker actions (red dots)

Select a worker, then choose an action from the bottom bar. While targeting, the active button shows **✕** and turns red — tap it again to cancel targeting.

### Move
1. Tap **Move**
2. Tap any walkable destination
3. Worker pathfinds around obstacles (A*) and walks there

### Cut (wood)
1. Tap **Cut**
2. Tap a green forest tile (or near one — it will snap to the nearest available tree)
3. Worker walks to the tree, harvests for ~0.7 s, then automatically carries the wood back to the **nearest base**
4. After depositing, it continues cutting the same tree (if density remains) or finds the next nearest tree

- Each tree has density **1–5**
- One cut removes 1 density
- At density 0 the tile becomes a **stump**
- Multiple workers cannot claim the same tree at the same time

### Mine (Virelium)
1. Tap **Mine**
2. Tap a cyan/teal Virelium deposit (or near one)
3. Worker walks to the deposit, mines for ~0.7 s, then carries the Virelium back to the nearest base
4. After depositing, it continues mining the nearest available deposit

- Each deposit has density **1–10**
- One mine removes 1 density
- Deposits cannot be claimed by multiple workers simultaneously
- You cannot start mining while already carrying wood or Virelium

### Tunnel
1. Tap **Tunnel**
2. Tap a **start** point (on or next to a mountain) — orange marker appears
3. Tap an **end** point
4. Worker walks to the start, then digs tile-by-tile through the rock (~1.2 s per rock tile)
5. Finished tunnels stay on the map permanently and are used by pathfinding

Tunnels let workers cross mountain ranges that would otherwise block them.

### Build
1. Tap **Build**
2. Tap a clear dirt (or stump) area
3. Worker walks to the spot and places an **L-shaped purple base**

**Base footprint:** 7×3 horizontal leg + 3×7 vertical leg (3 tiles thick).  
The placement area must be entirely clear dirt/stumps — no trees, rock, water, or existing base tiles.

### Cancel
Clears the worker’s current orders and deselects it.

---

## Base actions (purple)

1. Tap any tile of a base to select it
2. **Train** — spawns a new worker on a walkable tile near the base
3. **Cancel** — deselects the base

New workers appear adjacent to the base if space is available.

---

## Resource rules

- A worker can hold **only one** resource at a time (wood **or** Virelium)
- After cutting or mining, the worker **automatically returns** to the nearest base, deposits, then resumes the same task
- Carrying slows movement:
  - Empty speed ≈ 5.5
  - Carrying wood (weight 1) → roughly half speed
  - Carrying Virelium (weight 3) → roughly quarter speed
- Wood and Virelium totals are shown in the info bar when present
- There is currently **no cost** to train workers or build bases (prototype)

---

## Status messages (info bar)

The top info bar always shows context:

- Nothing selected → “Tap a red dot or purple base to select”
- Worker selected → “Character selected — choose an action”
- Targeting mode → specific instructions (e.g. “Tap a tree to start cutting”)
- Busy states → “Harvesting trees…”, “Carrying wood → returning to base…”, “Tunneling through the mountain…”, etc.
- Resource totals appear when you have wood or Virelium in a base or being carried

---

## Project layout

```
index.html          # shell + UI markup
css/style.css       # full-screen mobile UI
js/config.js        # tiles, colors, speeds, footprint, weights
js/state.js         # units, selection, claims, resources
js/map.js           # generation + walkability + elevation
js/pathfinding.js   # A* pathfinding
js/actions.js       # move / cut / mine / build / tunnel / train
js/ui.js            # bottom bar labels & info text
js/render.js        # canvas draw
js/input.js         # pan, zoom, tap
js/main.js          # game loop, buttons, boot
```

Scripts load in order (no bundler). Edit any module and refresh the browser.

---

## Roadmap ideas

- Tree regrowth over time
- Resource costs to train / build
- Combat / defend bases
- Multiple player bases / factions
- Save / load map state
- Worker idle behavior improvements
