# Map Game

Pixel-based strategy map prototype (mobile-friendly HTML5 canvas).

## How to play

Open `index.html` in a browser (or enable GitHub Pages on this repo).

- Tap the red dot to select a worker
- **Move** / **Cut** / **Mine** / **Tunnel** / **Build**
- Tap purple base → **Train** new workers
- Trees have density 1–5; Virelium deposits 1–10
- Tunnel through mountains by picking start + end points

## Features

- Procedural map: dirt, mountain ranges, ocean/rivers, forests, Virelium jets
- Pathfinding (A*) with obstacle avoidance
- Resource collection with carry limits and base deposit
- Tunnel carving through rock
