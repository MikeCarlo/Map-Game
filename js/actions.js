// actions.js — unit actions: move, cut, mine, build, tunnel, train, upgrade, armory
function setMoveTarget(u, worldX, worldY) {
  let gx = Math.floor(worldX), gy = Math.floor(worldY);
  if (!isWalkableTile(gx, gy) || isTileBlockedForStand(gx, gy, u.id)) {
    const free = findFreeStandTile(gx + 0.5, gy + 0.5, u.id, 10);
    if (!free) return false;
    gx = free.x; gy = free.y;
  }
  const sx = Math.floor(u.x), sy = Math.floor(u.y);
  if (sx === gx && sy === gy) {
    u.path = []; u.pathIndex = 0; u.goalX = u.goalY = null;
    return true;
  }
  let tiles = aStar(sx, sy, gx, gy, false) || pathToClosest(sx, sy, gx, gy);
  return applyPath(u, tiles);
}

function setGroupMoveTarget(unitList, worldX, worldY) {
  if (!unitList || !unitList.length) return false;
  const cx = Math.floor(worldX), cy = Math.floor(worldY);
  const reserved = new Set();
  for (const other of units) {
    if (unitList.some(u => u.id === other.id)) continue;
    reserved.add(Math.floor(other.x) + ',' + Math.floor(other.y));
    if (other.goalX != null)
      reserved.add(Math.floor(other.goalX) + ',' + Math.floor(other.goalY));
  }
  function takeFreeNear(ox, oy) {
    for (let r = 0; r <= 10; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (r > 0 && Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const nx = ox + dx, ny = oy + dy;
          const k = nx + ',' + ny;
          if (!isWalkableTile(nx, ny) || reserved.has(k)) continue;
          reserved.add(k);
          return { x: nx, y: ny };
        }
      }
    }
    return null;
  }
  let any = false;
  for (const u of unitList) {
    clearUnitOrders(u);
    const spot = takeFreeNear(cx, cy);
    if (!spot) continue;
    const sx = Math.floor(u.x), sy = Math.floor(u.y);
    if (sx === spot.x && sy === spot.y) continue;
    const tiles = aStar(sx, sy, spot.x, spot.y, false) || pathToClosest(sx, sy, spot.x, spot.y);
    if (applyPath(u, tiles)) any = true;
  }
  return any;
}

function setGroupCutTarget(workerList, worldX, worldY) {
  if (!workerList || !workerList.length) return false;
  const usedTrees = new Set();
  let any = false;
  const order = workerList.slice().sort((a, b) =>
    Math.hypot(a.x - worldX, a.y - worldY) - Math.hypot(b.x - worldX, b.y - worldY));
  for (const u of order) {
    if (u.unitType !== 'worker' || u.carryingWood || u.carryingVirelium) continue;
    let tree = null;
    const cx = Math.floor(worldX), cy = Math.floor(worldY);
    outer:
    for (let r = 0; r <= 14; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = cx + dx, ny = cy + dy;
          if (!inBounds(nx, ny) || map[ny][nx] !== TILE_TREE) continue;
          const k = nx + ',' + ny;
          if (usedTrees.has(k) || isTreeClaimedByOther(nx, ny, u.id)) continue;
          tree = { x: nx, y: ny };
          break outer;
        }
      }
    }
    if (!tree) {
      tree = findNearestTree(Math.floor(u.x), Math.floor(u.y), u.id);
      if (tree && usedTrees.has(tree.x + ',' + tree.y)) tree = null;
    }
    if (!tree) continue;
    usedTrees.add(tree.x + ',' + tree.y);
    if (setCutTarget(u, tree.x + 0.5, tree.y + 0.5)) any = true;
  }
  return any;
}

function setGroupMineTarget(workerList, worldX, worldY) {
  if (!workerList || !workerList.length) return false;
  const used = new Set();
  let any = false;
  const order = workerList.slice().sort((a, b) =>
    Math.hypot(a.x - worldX, a.y - worldY) - Math.hypot(b.x - worldX, b.y - worldY));
  for (const u of order) {
    if (u.unitType !== 'worker' || u.carryingWood || u.carryingVirelium) continue;
    let spot = null;
    const cx = Math.floor(worldX), cy = Math.floor(worldY);
    outer:
    for (let r = 0; r <= 16; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = cx + dx, ny = cy + dy;
          if (!hasMineral(nx, ny) || !isWalkableTile(nx, ny)) continue;
          const k = nx + ',' + ny;
          if (used.has(k) || isMineralClaimedByOther(nx, ny, u.id)) continue;
          spot = { x: nx, y: ny };
          break outer;
        }
      }
    }
    if (!spot) {
      spot = findNearestMineral(Math.floor(u.x), Math.floor(u.y), u.id);
      if (spot && used.has(spot.x + ',' + spot.y)) spot = null;
    }
    if (!spot) continue;
    used.add(spot.x + ',' + spot.y);
    if (setMineTarget(u, spot.x + 0.5, spot.y + 0.5)) any = true;
  }
  return any;
}

function findNearestTree(fromX, fromY, unitId, maxRange = 40) {
  const key = (x, y) => y * MAP_W + x;
  const queue = [{ x: fromX, y: fromY, d: 0 }], visited = new Set([key(fromX, fromY)]);
  const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  while (queue.length) {
    const cur = queue.shift();
    if (cur.d > maxRange) break;
    if (inBounds(cur.x, cur.y) && map[cur.y][cur.x] === TILE_TREE &&
        !isTreeClaimedByOther(cur.x, cur.y, unitId))
      return { x: cur.x, y: cur.y };
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx, ny = cur.y + dy, nk = key(nx, ny);
      if (!inBounds(nx, ny) || visited.has(nk)) continue;
      const t = map[ny][nx];
      if (t === TILE_ROCK || t === TILE_WATER) continue;
      visited.add(nk); queue.push({ x: nx, y: ny, d: cur.d + 1 });
    }
  }
  return null;
}

function findStandTileNearTree(tx, ty, fromX, fromY, unitId) {
  const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  let best = null, bestD = Infinity;
  for (const [dx, dy] of dirs) {
    const nx = tx + dx, ny = ty + dy;
    if (!isWalkableTile(nx, ny)) continue;
    if (unitId != null && isTileBlockedForStand(nx, ny, unitId)) continue;
    const d = Math.hypot(nx - fromX, ny - fromY);
    if (d < bestD) { bestD = d; best = { x: nx, y: ny }; }
  }
  if (!best) {
    for (let r = 2; r <= 5 && !best; r++)
      for (let dy = -r; dy <= r && !best; dy++)
        for (let dx = -r; dx <= r && !best; dx++) {
          const nx = tx + dx, ny = ty + dy;
          if (!isWalkableTile(nx, ny)) continue;
          if (unitId != null && isTileBlockedForStand(nx, ny, unitId)) continue;
          best = { x: nx, y: ny };
        }
  }
  return best;
}

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
function upgradeBase() {
  if (!playerBase) return false;
  const spot = findUpgradeSpot();
  if (!spot) return false;
  registerBaseSegment(spot.x, spot.y);
  updateUI(); draw();
  return true;
}

function canPlaceArmory(ax, ay) {
  for (const { dx, dy } of ARMORY_FOOTPRINT) {
    const x = ax + dx, y = ay + dy;
    if (!inBounds(x, y)) return false;
    const t = map[y][x];
    if (t !== TILE_DIRT && t !== TILE_STUMP) return false;
  }
  return true;
}
function placeArmoryTiles(ax, ay) {
  for (const { dx, dy } of ARMORY_FOOTPRINT) {
    const x = ax + dx, y = ay + dy;
    if (inBounds(x, y)) map[y][x] = TILE_ARMORY;
  }
}
function registerArmory(ax, ay) {
  placeArmoryTiles(ax, ay);
  armories.push({ x: ax, y: ay });
}

function setBuildTarget(u, worldX, worldY, kind) {
  if (u.unitType !== 'worker') return false;
  const ax = Math.floor(worldX), ay = Math.floor(worldY);
  const ok = kind === 'armory' ? canPlaceArmory(ax, ay) : canPlaceBase(ax, ay);
  if (!ok) return false;
  const sx = Math.floor(u.x), sy = Math.floor(u.y);
  let tiles = aStar(sx, sy, ax, ay, false) || pathToClosest(sx, sy, ax, ay);
  if (!tiles || !tiles.length) return false;
  u.building = true;
  u.buildKind = kind === 'armory' ? 'armory' : 'base';
  u.buildTX = ax; u.buildTY = ay;
  u.harvesting = false; u.carryingWood = false; u.returningToBase = false;
  return applyPath(u, tiles);
}

function finishBuild(u) {
  if (u.buildTX !== null && u.buildTY !== null) {
    if (u.buildKind === 'armory') {
      if (canPlaceArmory(u.buildTX, u.buildTY)) registerArmory(u.buildTX, u.buildTY);
    } else {
      if (canPlaceBase(u.buildTX, u.buildTY)) registerBaseSegment(u.buildTX, u.buildTY);
    }
    const free = findFreeStandTile(u.x, u.y, u.id, 6);
    if (free) { u.x = free.x + 0.5; u.y = free.y + 0.5; }
  }
  u.building = false; u.buildKind = null; u.buildTX = u.buildTY = null;
  u.path = []; u.pathIndex = 0; u.goalX = u.goalY = null;
  updateUI();
}

function isRockOrWalkable(x, y) {
  if (!inBounds(x, y)) return false;
  const t = map[y][x];
  return t === TILE_ROCK || t === TILE_DIRT || t === TILE_STUMP || t === TILE_TUNNEL;
}
function setTunnelStart(u, worldX, worldY) {
  if (u.unitType !== 'worker') return false;
  const gx = Math.floor(worldX), gy = Math.floor(worldY);
  if (!isRockOrWalkable(gx, gy)) return false;
  u.tunnelStart = { x: gx, y: gy };
  return true;
}
function setTunnelEnd(u, worldX, worldY) {
  if (!u.tunnelStart) return false;
  const gx = Math.floor(worldX), gy = Math.floor(worldY);
  if (!isRockOrWalkable(gx, gy)) return false;
  u.tunnelEnd = { x: gx, y: gy };
  const carve = aStar(u.tunnelStart.x, u.tunnelStart.y, gx, gy, false, true);
  if (!carve || carve.length < 1) return false;
  let approachX = u.tunnelStart.x, approachY = u.tunnelStart.y;
  if (!isWalkableTile(approachX, approachY)) {
    let found = false;
    for (const [dx, dy] of [[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
      const nx = u.tunnelStart.x + dx, ny = u.tunnelStart.y + dy;
      if (isWalkableTile(nx, ny)) { approachX = nx; approachY = ny; found = true; break; }
    }
    if (!found) {
      const near = pathToClosest(Math.floor(u.x), Math.floor(u.y), u.tunnelStart.x, u.tunnelStart.y);
      if (!near || !near.length) return false;
      applyPath(u, near);
      u.tunneling = true;
      u.tunnelCarvePath = carve.map(t => ({ x: t.x + 0.5, y: t.y + 0.5 }));
      return true;
    }
  }
  const sx = Math.floor(u.x), sy = Math.floor(u.y);
  let toStart = aStar(sx, sy, approachX, approachY, false, false);
  if (!toStart || !toStart.length) toStart = pathToClosest(sx, sy, approachX, approachY);
  if (!toStart || !toStart.length) return false;
  u.tunneling = true;
  u.tunnelCarvePath = carve.map(t => ({ x: t.x + 0.5, y: t.y + 0.5 }));
  applyPath(u, toStart);
  return true;
}
function carveRockAt(tx, ty) {
  const x = Math.floor(tx), y = Math.floor(ty);
  if (!inBounds(x, y)) return false;
  if (map[y][x] === TILE_ROCK) {
    map[y][x] = TILE_TUNNEL;
    recomputeRockElevation();
    return true;
  }
  return false;
}
function beginCarveTile(u, x, y) {
  if (!inBounds(x, y) || map[y][x] !== TILE_ROCK) return false;
  u.carveTileX = x; u.carveTileY = y; u.carveTimer = TUNNEL_CARVE_TIME;
  return true;
}
function startTunnelCarve(u) {
  if (!u.tunnelCarvePath || !u.tunnelCarvePath.length) {
    u.tunneling = false; u.tunnelStart = u.tunnelEnd = null; u.tunnelCarvePath = null; updateUI(); return;
  }
  u.path = u.tunnelCarvePath; u.pathIndex = 0;
  if (u.path.length > 1 && Math.hypot(u.path[0].x - u.x, u.path[0].y - u.y) < 0.4) u.pathIndex = 1;
  u.goalX = u.path[u.path.length - 1].x; u.goalY = u.path[u.path.length - 1].y;
  u.tunnelCarvePath = null;
  const cx = Math.floor(u.x), cy = Math.floor(u.y);
  if (inBounds(cx, cy) && map[cy][cx] === TILE_ROCK) beginCarveTile(u, cx, cy);
  updateUI();
}
function finishTunnel(u) {
  u.tunneling = false; u.tunnelStart = null; u.tunnelEnd = null; u.tunnelCarvePath = null;
  u.path = []; u.pathIndex = 0; u.goalX = u.goalY = null;
  recomputeRockElevation(); updateUI();
}

function spawnUnitNear(bx, by, unitType) {
  const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1],[2,0],[-2,0],[0,2],[0,-2]];
  const trySpawn = (nx, ny) => {
    if (!isWalkableTile(nx, ny)) return null;
    if (isTileBlockedForStand(nx, ny, null)) return null;
    const u = makeUnit(nx + 0.5, ny + 0.5, unitType);
    units.push(u);
    return u;
  };
  for (const [dx, dy] of dirs) {
    const u = trySpawn(bx + dx, by + dy);
    if (u) return u;
  }
  for (let r = 1; r <= 8; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r && r > 1) continue;
        const u = trySpawn(bx + dx, by + dy);
        if (u) return u;
      }
  return null;
}

function trainUnitAtBase(bx, by) {
  if (!playerBase) return false;
  if (countWorkers() >= playerBase.maxWorkers) return false;
  const u = spawnUnitNear(bx, by, 'worker');
  if (!u) return false;
  setSingleSelection(u.id);
  actionMode = null;
  updateUI(); draw();
  return true;
}

function trainSoldierAtArmory(ax, ay) {
  if (!armories.length) return false;
  if (countSoldiers() >= maxSoldiers()) return false;
  const u = spawnUnitNear(ax, ay, 'soldier');
  if (!u) return false;
  setSingleSelection(u.id);
  actionMode = null;
  updateUI(); draw();
  return true;
}
