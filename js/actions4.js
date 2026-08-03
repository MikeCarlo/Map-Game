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

// Training is queued and timed (training.js). The building stays selected so
// you can order several in a row — the trainee is never auto-selected.
function trainUnitAtBase(bx, by) {
  if (!playerBase) return false;
  const seg = findBaseSegmentAt(bx, by) || playerBase.segments[0];
  if (!seg) return false;
  if (!enqueueTraining(trainingKeyForBase(), 'worker', bx, by, seg.x, seg.y, BASE_SEGMENT_SIZE)) return false;
  updateUI(); draw();
  return true;
}

function trainSoldierAtArmory(ax, ay) {
  const a = findArmoryAt(ax, ay);
  if (!a) return false;
  if (!enqueueTraining(trainingKeyForArmory(a), 'soldier', ax, ay, a.x, a.y, ARMORY_SIZE)) return false;
  updateUI(); draw();
  return true;
}
