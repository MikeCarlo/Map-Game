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

## Fog of war

You start seeing only the ground around your base. The rest of the world is
black until someone walks into it.

Every tile is in one of three states:

| State | Looks like | You see |
|-------|------------|---------|
| **Never seen** | Solid black | Nothing at all — terrain, resources and huts are all hidden |
| **Seen before, out of sight** | Terrain, shaded dark | The land as you remember it — but no enemies, no live activity |
| **In sight now** | Full colour | Everything, including enemy units and what they are doing |

Sight radius, in tiles:

| Source | Radius |
|--------|--------|
| Worker | 7 |
| Soldier | 9 |
| Base segment | 11 |
| Armory | 9 |

Enemies and their huts give you no vision — only your own units and buildings
do. Scouting is the way to find the enemy hut.

Consequences worth knowing:

- Enemies standing in the dark are not drawn, cannot be tapped, and are not
  counted in the info bar
- You cannot order an attack on a hut or enemy you have never seen
- Workers only auto-target trees and Virelium on ground you have explored, so a
  brand-new map may need a scouting trip before there is much to harvest
- **New Map** wipes everything you had explored

Pathfinding still routes around terrain you have not discovered yet — units
know the shape of the map even where you don't. Set `FOG_ENABLED = false` in
`js/config.js` to reveal the whole map.

### Minimap

The panel under the PAN badge is a live overview of everything you have
explored — one pixel per tile, in the same three fog states as the main view.

- **Red dots** — workers · **white dots** — soldiers · **green dots** — enemies
  you can currently see
- **Yellow box** — units you have selected
- **White rectangle** — the part of the world on screen right now
- Cyan patches are Virelium you have found

**Tap or drag on the minimap to jump the camera there** — handy once the map is
zoomed in far enough that the whole world no longer fits on screen.

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

## Soldier actions (dark dots with a ring)

Soldiers are trained at an armory. Select one — or several, via double-tap or a
long-press box select — and the bar offers **Move / Attack / Defend / Cancel**.

### Attack
1. Tap **Attack**
2. Tap an enemy (green) or an enemy hut

Soldiers walk into range and hit the target until it dies. Huts are chewed
through one tile at a time and darken as they take damage.

### Defend
1. Tap **Defend**
2. Tap the spot on the map you want held

Each selected soldier takes a post at that spot (a group spreads over the tiles
around it, one post each) and stands guard:

- Any enemy that comes within **7 tiles of the post** is engaged automatically
- A target that runs beyond **9 tiles** is let go rather than chased across the map
- After the fight, the soldier walks back to its post and keeps watching
- The post is marked with a blue diamond; selecting the soldier shows its guard
  radius as a dashed ring, and a dotted tether while it is away from the post

Defend sticks until you give the soldier another order — **Attack**, **Move**
or **Cancel** all release the post.

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
js/fog.js           # fog of war: explored / visible tile layers
js/pathfinding.js   # A* pathfinding
js/actions.js       # move / cut / mine / build / tunnel / train
js/ui.js            # bottom bar labels & info text
js/render.js        # canvas draw
js/minimap.js       # explored-area overview + tap to jump
js/input.js         # pan, zoom, tap
js/main.js          # game loop, buttons, boot
```

Scripts load in order (no bundler). Edit any module and refresh the browser.

---

## Roadmap ideas

- Tree regrowth over time
- Resource costs to train / build
- Patrol routes between two posts
- Multiple player bases / factions
- Save / load map state
- Worker idle behavior improvements
