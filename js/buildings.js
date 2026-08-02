// buildings.js — per-tile building health
// Worker Repair action restores tile HP on friendly base/armory tiles

let buildingHpMap = null; // [y][x] = number | null

function createBuildingHpMap() {
  const m = new Array(MAP_H);
  for (let y = 0; y < MAP_H; y++) m[y] = new Array(MAP_W).fill(null);
  return m;
}

function ensureBuildingHpMap() {
  if (!buildingHpMap) buildingHpMap = createBuildingHpMap();
}

function setBuildingTileHp(x, y, hp = BUILDING_TILE_MAX_HP) {
  ensureBuildingHpMap();
  if (!inBounds(x, y)) return;
  buildingHpMap[y][x] = hp;
}

function clearBuildingTileHp(x, y) {
  if (!buildingHpMap || !inBounds(x, y)) return;
  buildingHpMap[y][x] = null;
}

function getBuildingTileHp(x, y) {
  if (!buildingHpMap || !inBounds(x, y)) return null;
  return buildingHpMap[y][x];
}

function isLiveBuildingTile(x, y) {
  const hp = getBuildingTileHp(x, y);
  return hp != null && hp > 0;
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3
    ? h.split('').map(c => c + c).join('')
    : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}

function lerpColor(hexA, hexB, t) {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  const u = Math.max(0, Math.min(1, t));
  return rgbToHex(
    a.r + (b.r - a.r) * u,
    a.g + (b.g - a.g) * u,
    a.b + (b.b - a.b) * u
  );
}

/** Full color at 100% HP → grey at 0% HP */
function buildingTileColor(fullHex, x, y) {
  const hp = getBuildingTileHp(x, y);
  if (hp == null) return fullHex;
  const pct = Math.max(0, Math.min(1, hp / BUILDING_TILE_MAX_HP));
  // darker when healthy, lighter toward grey when damaged
  return lerpColor(fullHex, BUILDING_DESTROYED_COLOR, 1 - pct);
}

function initTilesHpForFootprint(ox, oy, footprint) {
  for (const { dx, dy } of footprint) {
    setBuildingTileHp(ox + dx, oy + dy, BUILDING_TILE_MAX_HP);
  }
}

function footprintTiles(ox, oy, footprint) {
  const list = [];
  for (const { dx, dy } of footprint) {
    const x = ox + dx, y = oy + dy;
    if (inBounds(x, y)) list.push({ x, y });
  }
  return list;
}

function sumHpForTiles(tiles) {
  let cur = 0, max = 0, live = 0;
  for (const { x, y } of tiles) {
    const hp = getBuildingTileHp(x, y);
    if (hp == null) continue;
    live++;
    cur += Math.max(0, hp);
    max += BUILDING_TILE_MAX_HP;
  }
  return { cur, max, live, pct: max > 0 ? Math.round((cur / max) * 100) : 0 };
}

function baseHealthStats() {
  if (!playerBase || !playerBase.segments.length) return { cur: 0, max: 0, live: 0, pct: 0 };
  const tiles = [];
  for (const seg of playerBase.segments) {
    for (const t of footprintTiles(seg.x, seg.y, BASE_FOOTPRINT)) tiles.push(t);
  }
  return sumHpForTiles(tiles);
}

function armoryHealthStats(a) {
  if (!a) return { cur: 0, max: 0, live: 0, pct: 0 };
  return sumHpForTiles(footprintTiles(a.x, a.y, ARMORY_FOOTPRINT));
}

function hutHealthStats(h) {
  if (!h) return { cur: 0, max: 0, live: 0, pct: 0 };
  return sumHpForTiles(footprintTiles(h.x, h.y, HUT_FOOTPRINT));
}

function liveTilesInFootprint(ox, oy, footprint) {
  return footprintTiles(ox, oy, footprint).filter(t => isLiveBuildingTile(t.x, t.y));
}

function nearestLiveBuildingTile(fromX, fromY, tiles) {
  let best = null, bestD = Infinity;
  for (const t of tiles) {
    if (!isLiveBuildingTile(t.x, t.y)) continue;
    const d = Math.hypot(t.x + 0.5 - fromX, t.y + 0.5 - fromY);
    if (d < bestD) { bestD = d; best = t; }
  }
  return best;
}

/** Apply damage to one building tile. Returns true if tile destroyed. */
function damageBuildingTile(tx, ty, amount) {
  if (!isLiveBuildingTile(tx, ty)) return false;
  buildingHpMap[ty][tx] -= amount;
  if (buildingHpMap[ty][tx] > 0) return false;

  // Tile destroyed → grey rubble then walkable dirt
  buildingHpMap[ty][tx] = null;
  if (inBounds(tx, ty)) {
    map[ty][tx] = TILE_DIRT;
  }
  onBuildingTileDestroyed(tx, ty);
  return true;
}

function onBuildingTileDestroyed(tx, ty) {
  // Hut fully gone?
  for (const hut of huts.slice()) {
    const live = liveTilesInFootprint(hut.x, hut.y, HUT_FOOTPRINT);
    if (live.length === 0) {
      // ensure all footprint cleared
      for (const { dx, dy } of HUT_FOOTPRINT) {
        const x = hut.x + dx, y = hut.y + dy;
        if (inBounds(x, y) && map[y][x] === TILE_HUT) map[y][x] = TILE_DIRT;
        clearBuildingTileHp(x, y);
      }
      for (const u of units) {
        if (u.attackHutId === hut.id) {
          u.attacking = false; u.attackHutId = null; u.attackTileX = null; u.attackTileY = null;
        }
      }
      huts = huts.filter(h => h.id !== hut.id);
      if (selectedHut && selectedHut.x === hut.x && selectedHut.y === hut.y) selectedHut = null;
    }
  }

  // Armory fully gone?
  for (const a of armories.slice()) {
    const live = liveTilesInFootprint(a.x, a.y, ARMORY_FOOTPRINT);
    if (live.length === 0) {
      for (const { dx, dy } of ARMORY_FOOTPRINT) {
        const x = a.x + dx, y = a.y + dy;
        if (inBounds(x, y) && map[y][x] === TILE_ARMORY) map[y][x] = TILE_DIRT;
        clearBuildingTileHp(x, y);
      }
      armories = armories.filter(ar => !(ar.x === a.x && ar.y === a.y));
      if (selectedArmory && selectedArmory.x === a.x && selectedArmory.y === a.y) selectedArmory = null;
    }
  }

  // Base segment tiles: if a segment has zero live tiles, drop the segment
  if (playerBase && playerBase.segments) {
    const kept = [];
    for (const seg of playerBase.segments) {
      const live = liveTilesInFootprint(seg.x, seg.y, BASE_FOOTPRINT);
      if (live.length === 0) {
        for (const { dx, dy } of BASE_FOOTPRINT) {
          const x = seg.x + dx, y = seg.y + dy;
          if (inBounds(x, y) && map[y][x] === TILE_BASE) map[y][x] = TILE_DIRT;
          clearBuildingTileHp(x, y);
        }
      } else {
        kept.push(seg);
      }
    }
    if (kept.length !== playerBase.segments.length) {
      playerBase.segments = kept;
      playerBase.level = Math.max(1, kept.length);
      playerBase.maxWorkers = playerBase.level * WORKERS_PER_BASE_LEVEL;
      if (kept.length === 0) {
        playerBase = null;
        selectedBase = null;
      }
    }
  }
  updateUI();
}

function isDamagedFriendlyTile(x, y) {
  if (!inBounds(x, y)) return false;
  const t = map[y][x];
  if (t !== TILE_BASE && t !== TILE_ARMORY) return false;
  const hp = getBuildingTileHp(x, y);
  return hp != null && hp > 0 && hp < BUILDING_TILE_MAX_HP;
}

function repairBuildingTile(x, y, amount = REPAIR_AMOUNT) {
  if (!isDamagedFriendlyTile(x, y)) return false;
  const cur = buildingHpMap[y][x];
  buildingHpMap[y][x] = Math.min(BUILDING_TILE_MAX_HP, cur + amount);
  return true;
}

function findNearestDamagedFriendlyTile(fromX, fromY, maxRange = 40) {
  let best = null, bestD = Infinity;
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (!isDamagedFriendlyTile(x, y)) continue;
      const d = Math.hypot(x + 0.5 - fromX, y + 0.5 - fromY);
      if (d < bestD && d <= maxRange) {
        bestD = d;
        best = { x, y };
      }
    }
  }
  return best;
}
