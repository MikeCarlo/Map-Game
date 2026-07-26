# Map Game

Pixel strategy prototype — collect wood & Virelium, build bases, train workers, tunnel mountains.

## Run locally

Open `index.html` in a browser, or:

```bash
npx serve .
```

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

## Controls

- Tap worker (red) → Move, Cut, Mine, Tunnel, Build, Cancel
- Tap base (purple) → Train
- Tunnel: pick start, then end; worker digs through rock slowly
