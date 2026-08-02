function findNearestBaseDeposit(fromX, fromY, maxRange = 80) {
  const key = (x, y) => y * MAP_W + x;
  const queue = [{ x: fromX, y: fromY, d: 0 }], visited = new Set([key(fromX, fromY)]);
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  while (queue.length) {
    const cur = queue.shift();
    if (cur.d > maxRange) break;
    if (isWalkableTile(cur.x, cur.y)) {
      for (const [dx, dy] of dirs) {
        const bx = cur.x + dx, by = cur.y + dy;
        if (inBounds(bx, by) && map[by][bx] === TILE_BASE) return { x: cur.x, y: cur.y };
      }
    }
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx, ny = cur.y + dy, nk = key(nx, ny);
      if (!isWalkableTile(nx, ny) || visited.has(nk)) continue;
      visited.add(nk); queue.push({ x: nx, y: ny, d: cur.d + 1 });
    }
  }
  return null;
}

function isBesideBase(x, y) {
  const cx = Math.floor(x), cy = Math.floor(y);
  for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
    const nx = cx + dx, ny = cy + dy;
    if (inBounds(nx, ny) && map[ny][nx] === TILE_BASE) return true;
  }
  return false;
}

function nudgeToWalkable(u) {
  const cx = Math.floor(u.x), cy = Math.floor(u.y);
  if (isWalkableTile(cx, cy) && !isTileBlockedForStand(cx, cy, u.id)) return;
  const free = findFreeStandTile(u.x, u.y, u.id, 6);
  if (free) { u.x = free.x + 0.5; u.y = free.y + 0.5; }
}

function setCutTarget(u, worldX, worldY) {
  if (u.unitType !== 'worker') return false;
  if (u.carryingWood || u.carryingVirelium) return false;
  let gx = Math.floor(worldX), gy = Math.floor(worldY);
  if (!(inBounds(gx, gy) && map[gy][gx] === TILE_TREE && !isTreeClaimedByOther(gx, gy, u.id))) {
    let found = false;
    for (let r = 0; r <= 8 && !found; r++)
      for (let dy = -r; dy <= r && !found; dy++)
        for (let dx = -r; dx <= r && !found; dx++) {
          const nx = gx + dx, ny = gy + dy;
          if (inBounds(nx, ny) && map[ny][nx] === TILE_TREE && !isTreeClaimedByOther(nx, ny, u.id)) {
            gx = nx; gy = ny; found = true;
          }
        }
    if (!found) {
      const nearest = findNearestTree(Math.floor(u.x), Math.floor(u.y), u.id);
      if (!nearest) return false;
      gx = nearest.x; gy = nearest.y;
    }
  }
  const stand = findStandTileNearTree(gx, gy, Math.floor(u.x), Math.floor(u.y), u.id);
  if (!stand) return false;
  releaseAllClaimsForUnit(u.id);
  const sx = Math.floor(u.x), sy = Math.floor(u.y);
  let tiles = aStar(sx, sy, stand.x, stand.y, false) || pathToClosest(sx, sy, stand.x, stand.y);
  if (!tiles || !tiles.length) return false;
  claimTree(gx, gy, u.id);
  u.harvesting = true; u.returningToBase = false;
  u.mining = false; u.carryingVirelium = false; u.carryingWood = false;
  u.harvestTX = gx; u.harvestTY = gy; u.harvestTimer = 0;
  return applyPath(u, tiles);
}
function returnToBaseWithWood(u) {
  nudgeToWalkable(u);
  u.harvestTimer = 0; u.harvestTX = u.harvestTY = null; u.returningToBase = true;
  const deposit = findNearestBaseDeposit(Math.floor(u.x), Math.floor(u.y));
  if (!deposit) { u.path = []; u.pathIndex = 0; u.goalX = u.goalY = null; updateUI(); return; }
  let gx = deposit.x, gy = deposit.y;
  if (isTileBlockedForStand(gx, gy, u.id)) {
    const free = findFreeStandTile(gx + 0.5, gy + 0.5, u.id, 6);
    if (free) { gx = free.x; gy = free.y; }
  }
  const sx = Math.floor(u.x), sy = Math.floor(u.y);
  let tiles = aStar(sx, sy, gx, gy, false) || pathToClosest(sx, sy, gx, gy);
  if (!tiles || !tiles.length) tiles = [{ x: sx, y: sy }];
  applyPath(u, tiles); updateUI();
}
function depositWoodAndContinue(u) {
  if (!isBesideBase(u.x, u.y)) { returnToBaseWithWood(u); return; }
  if (u.carryingWood) { u.carryingWood = false; woodInBase++; }
  u.returningToBase = false; u.harvestTimer = 0; u.harvestTX = u.harvestTY = null;
  if (!u.harvesting) { updateUI(); return; }
  let next = null;
  if (u.preferTreeX !== null && u.preferTreeY !== null &&
      inBounds(u.preferTreeX, u.preferTreeY) && map[u.preferTreeY][u.preferTreeX] === TILE_TREE &&
      treeDensity && treeDensity[u.preferTreeY][u.preferTreeX] > 0 &&
      !isTreeClaimedByOther(u.preferTreeX, u.preferTreeY, u.id)) {
    next = { x: u.preferTreeX, y: u.preferTreeY };
  } else {
    u.preferTreeX = u.preferTreeY = null;
    next = findNearestTree(Math.floor(u.x), Math.floor(u.y), u.id);
  }
  if (next) setCutTarget(u, next.x + 0.5, next.y + 0.5);
  else clearUnitOrders(u);
  updateUI();
}
function startHarvestOnArrival(u) {
  if (!u.harvesting) return;
  if (u.carryingWood) {
    if (isBesideBase(u.x, u.y)) depositWoodAndContinue(u);
    else returnToBaseWithWood(u);
    return;
  }
  if (u.returningToBase) u.returningToBase = false;
  if (u.harvestTX === null) return;
  const cx = Math.floor(u.x), cy = Math.floor(u.y);
  const treeStillThere = inBounds(u.harvestTX, u.harvestTY) && map[u.harvestTY][u.harvestTX] === TILE_TREE;
  const adjacent = Math.abs(cx - u.harvestTX) <= 1 && Math.abs(cy - u.harvestTY) <= 1;
  if (adjacent && treeStillThere) {
    if (u.harvestTimer <= 0) u.harvestTimer = HARVEST_TIME;
  } else {
    releaseTree(u.harvestTX, u.harvestTY, u.id);
    u.harvestTX = u.harvestTY = null; u.harvestTimer = 0;
    const next = findNearestTree(cx, cy, u.id);
    if (next) setCutTarget(u, next.x + 0.5, next.y + 0.5);
    else { clearUnitOrders(u); updateUI(); }
  }
}
function finishCurrentTree(u) {
  if (u.carryingWood) {
    u.harvestTimer = 0; u.harvestTX = u.harvestTY = null; returnToBaseWithWood(u); return;
  }
  const hx = u.harvestTX, hy = u.harvestTY;
  u.harvestTimer = 0; u.harvestTX = u.harvestTY = null;
  let tookWood = false;
  if (hx !== null && hy !== null && inBounds(hx, hy) && map[hy][hx] === TILE_TREE) {
    if (!treeDensity) {
      treeDensity = new Array(MAP_H);
      for (let y = 0; y < MAP_H; y++) treeDensity[y] = new Array(MAP_W).fill(0);
    }
    let d = treeDensity[hy][hx]; if (d <= 0) d = 1;
    d -= 1; treeDensity[hy][hx] = Math.max(0, d);
    u.carryingWood = true; tookWood = true;
    if (d <= 0) {
      treeDensity[hy][hx] = 0; map[hy][hx] = TILE_STUMP;
      releaseTree(hx, hy, u.id); u.preferTreeX = u.preferTreeY = null;
    } else {
      u.preferTreeX = hx; u.preferTreeY = hy; claimTree(hx, hy, u.id);
    }
  } else if (hx !== null && hy !== null) releaseTree(hx, hy, u.id);
  nudgeToWalkable(u);
  if (tookWood && u.harvesting) returnToBaseWithWood(u); else clearUnitOrders(u);
  updateUI(); draw();
}
