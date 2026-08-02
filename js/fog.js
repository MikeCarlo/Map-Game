// fog.js — fog of war: what the player has seen, and what they can see right now
//
// Two layers over the tile grid:
//   exploredMap — seen at least once. Terrain stays drawn, dimmed, from memory.
//   visibleMap  — inside the sight radius of a unit or building this frame.
//                 Only visible tiles show live activity (enemies, jets, deaths).
// Enemies and their huts grant no vision; this is the player's view only.

let visibleMap = null;   // Uint8Array(MAP_W * MAP_H)
let exploredMap = null;  // Uint8Array(MAP_W * MAP_H)

function createFogArrays() {
  visibleMap = new Uint8Array(MAP_W * MAP_H);
  exploredMap = new Uint8Array(MAP_W * MAP_H);
}

function ensureFogArrays() {
  if (!visibleMap || visibleMap.length !== MAP_W * MAP_H) createFogArrays();
}

function isTileVisible(x, y) {
  if (!FOG_ENABLED) return true;
  if (!visibleMap || !inBounds(x, y)) return false;
  return visibleMap[y * MAP_W + x] === 1;
}

function isTileExplored(x, y) {
  if (!FOG_ENABLED) return true;
  if (!exploredMap || !inBounds(x, y)) return false;
  return exploredMap[y * MAP_W + x] === 1;
}

/** Same checks for world coordinates (unit positions, tap points). */
function isPointVisible(wx, wy) { return isTileVisible(Math.floor(wx), Math.floor(wy)); }
function isPointExplored(wx, wy) { return isTileExplored(Math.floor(wx), Math.floor(wy)); }

/** Sight radius a unit contributes to the player's view. Enemies contribute none. */
function sightRadiusFor(u) {
  if (u.unitType === 'soldier') return SIGHT_SOLDIER;
  if (u.unitType === 'worker') return SIGHT_WORKER;
  return 0;
}

function revealDisc(cx, cy, radius) {
  if (radius <= 0) return;
  const r2 = radius * radius;
  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(MAP_W - 1, Math.ceil(cx + radius));
  const minY = Math.max(0, Math.floor(cy - radius));
  const maxY = Math.min(MAP_H - 1, Math.ceil(cy + radius));
  for (let y = minY; y <= maxY; y++) {
    const dy = y + 0.5 - cy;
    const row = y * MAP_W;
    for (let x = minX; x <= maxX; x++) {
      const dx = x + 0.5 - cx;
      if (dx * dx + dy * dy > r2) continue;
      visibleMap[row + x] = 1;
      exploredMap[row + x] = 1;
    }
  }
}

/** Recompute the visible layer from scratch; explored only ever grows. */
function updateVisibility() {
  if (!map || !FOG_ENABLED) return;
  ensureFogArrays();
  visibleMap.fill(0);
  for (const u of units) revealDisc(u.x, u.y, sightRadiusFor(u));
  if (playerBase) {
    for (const seg of playerBase.segments) {
      revealDisc(seg.x + BASE_SEGMENT_SIZE / 2, seg.y + BASE_SEGMENT_SIZE / 2, SIGHT_BASE);
    }
  }
  for (const a of armories) {
    revealDisc(a.x + ARMORY_SIZE / 2, a.y + ARMORY_SIZE / 2, SIGHT_ARMORY);
  }
}

/** New map — forget everything. */
function resetFog() {
  createFogArrays();
  updateVisibility();
}

/** Enemies the player can actually see right now. */
function countVisibleEnemies() {
  return units.filter(u => u.unitType === 'enemy' && isPointVisible(u.x, u.y)).length;
}

function isUnitRevealed(u) {
  if (!u) return false;
  if (u.unitType !== 'enemy') return true; // your own units are never hidden
  return isPointVisible(u.x, u.y);
}
