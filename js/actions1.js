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
          if (!isTileExplored(nx, ny)) continue;
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
          if (!isTileExplored(nx, ny)) continue;
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
        isTileExplored(cur.x, cur.y) &&
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
