function findNearestMineral(fromX, fromY, unitId, maxRange = 50) {
  const key = (x, y) => y * MAP_W + x;
  const queue = [{ x: fromX, y: fromY, d: 0 }], visited = new Set([key(fromX, fromY)]);
  const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  while (queue.length) {
    const cur = queue.shift();
    if (cur.d > maxRange) break;
    if (hasMineral(cur.x, cur.y) && !isMineralClaimedByOther(cur.x, cur.y, unitId) && isWalkableTile(cur.x, cur.y))
      return { x: cur.x, y: cur.y };
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx, ny = cur.y + dy, nk = key(nx, ny);
      if (!inBounds(nx, ny) || visited.has(nk)) continue;
      const t = map[ny][nx];
      if (t === TILE_ROCK || t === TILE_WATER || t === TILE_JET) continue;
      visited.add(nk); queue.push({ x: nx, y: ny, d: cur.d + 1 });
    }
  }
  return null;
}
function setMineTarget(u, worldX, worldY) {
  if (u.unitType !== 'worker') return false;
  if (u.carryingWood || u.carryingVirelium) return false;
  let gx = Math.floor(worldX), gy = Math.floor(worldY);
  if (!(hasMineral(gx, gy) && isWalkableTile(gx, gy) && !isMineralClaimedByOther(gx, gy, u.id))) {
    let found = false;
    for (let r = 0; r <= 8 && !found; r++)
      for (let dy = -r; dy <= r && !found; dy++)
        for (let dx = -r; dx <= r && !found; dx++) {
          const nx = gx + dx, ny = gy + dy;
          if (hasMineral(nx, ny) && isWalkableTile(nx, ny) && !isMineralClaimedByOther(nx, ny, u.id)) {
            gx = nx; gy = ny; found = true;
          }
        }
    if (!found) {
      const nearest = findNearestMineral(Math.floor(u.x), Math.floor(u.y), u.id);
      if (!nearest) return false;
      gx = nearest.x; gy = nearest.y;
    }
  }
  let standX = gx, standY = gy;
  if (isTileBlockedForStand(gx, gy, u.id)) {
    const free = findFreeStandTile(gx + 0.5, gy + 0.5, u.id, 4);
    if (free) { standX = free.x; standY = free.y; }
  }
  releaseAllClaimsForUnit(u.id);
  const sx = Math.floor(u.x), sy = Math.floor(u.y);
  let tiles = aStar(sx, sy, standX, standY, false) || pathToClosest(sx, sy, standX, standY);
  if (!tiles || !tiles.length) return false;
  claimMineral(gx, gy, u.id);
  u.mining = true; u.returningMineral = false;
  u.harvesting = false; u.carryingWood = false;
  u.mineTX = gx; u.mineTY = gy; u.mineTimer = 0;
  return applyPath(u, tiles);
}
function returnToBaseWithMineral(u) {
  const deposit = findNearestBaseDeposit(Math.floor(u.x), Math.floor(u.y));
  if (!deposit) {
    u.returningMineral = false; u.mineTX = u.mineTY = null; u.path = []; u.pathIndex = 0; updateUI(); return;
  }
  u.returningMineral = true; u.mineTX = u.mineTY = null;
  let gx = deposit.x, gy = deposit.y;
  if (isTileBlockedForStand(gx, gy, u.id)) {
    const free = findFreeStandTile(gx + 0.5, gy + 0.5, u.id, 6);
    if (free) { gx = free.x; gy = free.y; }
  }
  const sx = Math.floor(u.x), sy = Math.floor(u.y);
  let tiles = aStar(sx, sy, gx, gy, false) || pathToClosest(sx, sy, gx, gy);
  applyPath(u, tiles); updateUI();
}
function depositMineralAndContinue(u) {
  if (u.carryingVirelium) { u.carryingVirelium = false; vireliumInBase++; }
  u.returningMineral = false;
  if (u.mining) {
    const next = findNearestMineral(Math.floor(u.x), Math.floor(u.y), u.id);
    if (next) setMineTarget(u, next.x + 0.5, next.y + 0.5);
    else clearUnitOrders(u);
  }
  updateUI();
}
function startMineOnArrival(u) {
  if (!u.mining) return;
  if (u.returningMineral && u.carryingVirelium) {
    if (isBesideBase(u.x, u.y)) depositMineralAndContinue(u); else returnToBaseWithMineral(u); return;
  }
  if (u.carryingVirelium) { returnToBaseWithMineral(u); return; }
  if (u.mineTX === null) return;
  const cx = Math.floor(u.x), cy = Math.floor(u.y);
  const stillThere = hasMineral(u.mineTX, u.mineTY);
  if (Math.abs(cx - u.mineTX) <= 1 && Math.abs(cy - u.mineTY) <= 1 && stillThere) {
    if (u.mineTimer <= 0) u.mineTimer = HARVEST_TIME;
  } else {
    releaseMineral(u.mineTX, u.mineTY, u.id);
    u.mineTX = u.mineTY = null;
    const next = findNearestMineral(cx, cy, u.id);
    if (next) setMineTarget(u, next.x + 0.5, next.y + 0.5);
    else { clearUnitOrders(u); updateUI(); }
  }
}
function finishMine(u) {
  if (u.carryingVirelium) { u.mineTimer = 0; returnToBaseWithMineral(u); return; }
  if (u.mineTX !== null && u.mineTY !== null && hasMineral(u.mineTX, u.mineTY)) {
    mineralMap[u.mineTY][u.mineTX]--;
    u.carryingVirelium = true;
    if (mineralMap[u.mineTY][u.mineTX] <= 0) releaseMineral(u.mineTX, u.mineTY, u.id);
  } else if (u.mineTX !== null) releaseMineral(u.mineTX, u.mineTY, u.id);
  u.mineTimer = 0; u.mineTX = u.mineTY = null;
  if (u.carryingVirelium && u.mining) returnToBaseWithMineral(u); else clearUnitOrders(u);
  updateUI();
}

function canPlaceBase(ax, ay) {
  for (const { dx, dy } of BASE_FOOTPRINT) {
    const x = ax + dx, y = ay + dy;
    if (!inBounds(x, y)) return false;
    const t = map[y][x];
    if (t !== TILE_DIRT && t !== TILE_STUMP) return false;
  }
  return true;
}
function placeBaseTiles(ax, ay) {
  for (const { dx, dy } of BASE_FOOTPRINT) {
    const x = ax + dx, y = ay + dy;
    if (inBounds(x, y)) map[y][x] = TILE_BASE;
  }
}
function registerBaseSegment(ax, ay) {
  if (!playerBase) playerBase = makePlayerBase(ax, ay);
  else {
    playerBase.segments.push({ x: ax, y: ay });
    playerBase.level += 1;
    playerBase.maxWorkers += WORKERS_PER_BASE_LEVEL;
  }
  placeBaseTiles(ax, ay);
}
function findUpgradeSpot() {
  if (!playerBase || !playerBase.segments.length) return null;
  const offsets = [
    [BASE_SEGMENT_SIZE, 0], [0, BASE_SEGMENT_SIZE], [-BASE_SEGMENT_SIZE, 0], [0, -BASE_SEGMENT_SIZE],
    [BASE_SEGMENT_SIZE, BASE_SEGMENT_SIZE], [BASE_SEGMENT_SIZE, -BASE_SEGMENT_SIZE],
    [-BASE_SEGMENT_SIZE, BASE_SEGMENT_SIZE], [-BASE_SEGMENT_SIZE, -BASE_SEGMENT_SIZE]
  ];
  for (const seg of playerBase.segments) {
    for (const [ox, oy] of offsets) {
      const ax = seg.x + ox, ay = seg.y + oy;
      if (canPlaceBase(ax, ay)) return { x: ax, y: ay };
    }
  }
  for (const seg of playerBase.segments) {
    for (let r = 1; r <= 6; r++)
      for (let dy = -r * BASE_SEGMENT_SIZE; dy <= r * BASE_SEGMENT_SIZE; dy += BASE_SEGMENT_SIZE)
        for (let dx = -r * BASE_SEGMENT_SIZE; dx <= r * BASE_SEGMENT_SIZE; dx += BASE_SEGMENT_SIZE) {
          if (!dx && !dy) continue;
          const ax = seg.x + dx, ay = seg.y + dy;
          if (canPlaceBase(ax, ay)) return { x: ax, y: ay };
        }
  }
  return null;
}
