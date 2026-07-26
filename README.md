# Map Game

Pixel strategy prototype — explore a procedural map, harvest resources, build bases, train workers, and tunnel through mountains.

**Play online:** open [index.html](index.html) after enabling GitHub Pages, or clone and run locally.

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
2. Mining **Virelium** jets
3. Building an **L-shaped purple base**
4. **Training** more workers at the base
5. **Tunneling** through mountain ranges so workers can cross the map

Resources must be carried back to a base one unit at a time. Workers move slower when carrying cargo (wood weight 1, Virelium weight 3).

---

## Map features

| Terrain | Color | Notes |
|--------|--------|--------|
| Dirt | Brown | Walkable |
| Forest | Green (shades) | Harvestable; lighter = lower density (1–5) |
| Stumps | Dark brown | Tree fully harvested |
| Mountains | Grey (shaded peaks) | Impassable until tunneled |
| Tunnels | Dark brown path | Walkable after digging |
| Ocean / rivers | Blue | Impassable |
| Virelium jet | Dark hole + cyan rim | Spawns mineral deposits nearby |
| Virelium deposit | Cyan / teal | Density 1–10; one harvest per density |
| Base | Purple L shape | Deposit point; train workers |

---

## Controls

### Camera

- **Drag** to pan
- **Pinch** or **mouse wheel** to zoom
- **New Map** — generate a fresh world
- **Reset View** — fit the map on screen

### Workers (red dots)

1. **Tap** a worker to select it (yellow ring).
2. Choose an action on the bottom bar:
   - **Move** — tap a destination; pathfinds around obstacles
   - **Cut** — tap a forest; worker harvests, carries wood to base, repeats
   - **Mine** — tap a cyan Virelium tile; same carry/deposit loop
   - **Tunnel** — tap **start**, then **end**; worker digs a path through rock (slow)
   - **Build** — tap clear dirt for an L-shaped base (7×3 + 3×7 legs, 3 thick)
   - **Cancel** — clear orders and deselect

While an action is targeting, the button shows **✕** and turns red — tap it again to cancel targeting.

### Base (purple)

1. **Tap** any base tile.
2. **Train** — spawn another worker nearby.
3. **Cancel** — deselect the base.

---

## Resource rules

- A worker holds **one** resource at a time.
- After cutting or mining, they **return to the nearest base**, deposit, then resume.
- Trees: each green tile has density **1–5**. One cut removes 1 density; at 0 it becomes a stump.
- Virelium: each deposit has density **1–10**. One mine removes 1 density.
- Multiple workers **cannot claim the same tree/deposit** at once.
- Carrying slows movement: wood ÷2-ish, Virelium ÷4-ish vs empty speed.

---

## Tunneling

1. Select a worker → **Tunnel**.
2. Tap a **start** point on or next to the mountain (orange marker).
3. Tap an **end** point.
4. The worker walks to the start, then digs tile-by-tile (~1.2s per rock tile).
5. Finished tunnels stay on the map and are used by pathfinding.

---

## Project layout

```
index.html          # shell + UI markup
css/style.css       # full-screen mobile UI
js/config.js        # tiles, colors, speeds, footprint
js/state.js         # units, selection, claims, resources
js/map.js           # generation + walkability + elevation
js/pathfinding.js   # A* pathfinding
js/actions.js       # move / cut / mine / build / tunnel / train
js/ui.js            # bottom bar labels
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
- Multiple player bases
- Save / load map state
