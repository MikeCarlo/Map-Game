// actions.js — unit actions: move, cut, mine, build, tunnel, train
function setMoveTarget(u, worldX, worldY) {
  let gx = Math.floor(worldX), gy = Math.floor(worldY);
  if (!isWalkableTile(gx, gy)) {
    let found = false;
    for (let r = 1; r <= 8 && !found; r++)
      for (let dy = -r; dy <= r && !found; dy++)
        for (let dx = -r; dx <= r && !found; dx++)
          if (isWalkableTile(gx + dx, gy + dy)) { gx += dx; gy += dy; found = true; }
    if (!found) return false;
  }
  const sx = Math.floor(u.x), sy = Math.floor(u.y);
  let tiles = aStar(sx, sy, gx, gy, false) || pathToClosest(sx, sy, gx, gy);
  return applyPath(u, tiles);
}

function findNearestTree(fromX, fromY, unitId, maxRange = 40) {
  const key = (x, y) => y * MAP_W + x;
  const queue = [{ x: fromX, y: fromY, d: 0 }], visited = new Set([key(fromX, fromY)]);
  const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  while (queue.length) {
    const cur = queue.shift();
    if (cur.d > maxRange) break;
    if (inBounds(cur.x, cur.y) && map[cur.y][cur.x] === TILE_TREE &&
        !isTreeClaimedByOther(cur.x, cur.y, unitId)) {
      return { x: cur.x, y: cur.y };
    }
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

/** Walkable tile next to a tree the worker can stand on while cutting. */
function findStandTileNearTree(tx, ty, fromX, fromY) {
  const dirs = [[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  let best = null, bestD = Infinity;
  for (const [dx, dy] of dirs) {
    const nx = tx + dx, ny = ty + dy;
    if (!isWalkableTile(nx, ny)) continue;
    // Prefer tiles adjacent to the tree (or the tree's own tile if somehow walkable)
    if (dx !== 0 || dy !== 0) {
      // must be adjacent to tree
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) continue;
    }
    const d = Math.hypot(nx - fromX, ny - fromY);
    if (d < bestD) { bestD = d; best = { x: nx, y: ny }; }
  }
  // If nothing adjacent is walkable, search a bit farther for a walkable approach
  if (!best) {
    for (let r = 1; r <= 3 && !best; r++)
      for (let dy = -r; dy <= r && !best; dy++)
        for (let dx = -r; dx <= r && !best; dx++) {
          const nx = tx + dx, ny = ty + dy;
          if (isWalkableTile(nx, ny)) best = { x: nx, y: ny };
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

function nudgeToWalkable(u) {
  const cx = Math.floor(u.x), cy = Math.floor(u.y);
  if (isWalkableTile(cx, cy)) return;
  for (let r = 1; r <= 4; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (isWalkableTile(nx, ny)) {
          u.x = nx + 0.5; u.y = ny + 0.5;
          return;
        }
      }
}

// ── Cut (wood) — same loop as mine: go → harvest → carry to base → repeat ──
function setCutTarget(u, worldX, worldY) {
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

  const stand = findStandTileNearTree(gx, gy, Math.floor(u.x), Math.floor(u.y));
  if (!stand) return false;

  releaseAllClaimsForUnit(u.id);
  const sx = Math.floor(u.x), sy = Math.floor(u.y);
  // Path to a walkable tile next to the tree (not onto the tree)
  let tiles = aStar(sx, sy, stand.x, stand.y, false) || pathToClosest(sx, sy, stand.x, stand.y);
  if (!tiles || !tiles.length) return false;

  claimTree(gx, gy, u.id);
  u.harvesting = true; u.returningToBase = false;
  u.mining = false; u.carryingVirelium = false;
  u.harvestTX = gx; u.harvestTY = gy; u.harvestTimer = 0;
  return applyPath(u, tiles);
}

function returnToBaseWithWood(u) {
  nudgeToWalkable(u);
  const deposit = findNearestBaseDeposit(Math.floor(u.x), Math.floor(u.y));
  if (!deposit) {
    // No base yet — keep the wood, stop the loop
    u.returningToBase = false;
    u.harvestTX = u.harvestTY = null;
    u.path = []; u.pathIndex = 0;
    updateUI(); return;
  }
  u.returningToBase = true; u.harvestTX = u.harvestTY = null;
  const sx = Math.floor(u.x), sy = Math.floor(u.y);
  let tiles = aStar(sx, sy, deposit.x, deposit.y, false) || pathToClosest(sx, sy, deposit.x, deposit.y);
  applyPath(u, tiles); updateUI();
}

function depositWoodAndContinue(u) {
  if (u.carryingWood) { u.carryingWood = false; woodInBase++; }
  u.returningToBase = false;
  if (u.harvesting) {
    const next = findNearestTree(Math.floor(u.x), Math.floor(u.y), u.id);
    if (next) setCutTarget(u, next.x + 0.5, next.y + 0.5);
    else clearUnitOrders(u);
  }
  updateUI();
}

function startHarvestOnArrival(u) {
  if (!u.harvesting) return;
  if (u.returningToBase && u.carryingWood) { depositWoodAndContinue(u); return; }
  if (u.harvestTX === null) return;
  const cx = Math.floor(u.x), cy = Math.floor(u.y);
  const treeStillThere = inBounds(u.harvestTX, u.harvestTY) && map[u.harvestTY][u.harvestTX] === TILE_TREE;
  if (Math.abs(cx - u.harvestTX) <= 1 && Math.abs(cy - u.harvestTY) <= 1 && treeStillThere) {
    if (u.carryingWood) { returnToBaseWithWood(u); return; }
    u.harvestTimer = HARVEST_TIME;
  } else {
    releaseTree(u.harvestTX, u.harvestTY, u.id);
    u.harvestTX = u.harvestTY = null;
    if (u.carryingWood) { returnToBaseWithWood(u); return; }
    const next = findNearestTree(cx, cy, u.id);
    if (next) setCutTarget(u, next.x + 0.5, next.y + 0.5);
    else { clearUnitOrders(u); updateUI(); }
  }
}

function finishCurrentTree(u) {
  if (u.harvestTX !== null && u.harvestTY !== null &&
      inBounds(u.harvestTX, u.harvestTY) && map[u.harvestTY][u.harvestTX] === TILE_TREE) {
    if (!treeDensity) {
      treeDensity = new Array(MAP_H);
      for (let y = 0; y < MAP_H; y++) treeDensity[y] = new Array(MAP_W).fill(0);
    }
    if (treeDensity[u.harvestTY][u.harvestTX] <= 0) treeDensity[u.harvestTY][u.harvestTX] = 1;
    treeDensity[u.harvestTY][u.harvestTX] -= 1;
    u.carryingWood = true;
    if (treeDensity[u.harvestTY][u.harvestTX] <= 0) {
      treeDensity[u.harvestTY][u.harvestTX] = 0;
      map[u.harvestTY][u.harvestTX] = TILE_STUMP;
      releaseTree(u.harvestTX, u.harvestTY, u.id);
    }
  } else if (u.harvestTX !== null) {
    releaseTree(u.harvestTX, u.harvestTY, u.id);
  }
  u.harvestTimer = 0; u.harvestTX = u.harvestTY = null;
  nudgeToWalkable(u);
  if (u.carryingWood && u.harvesting) returnToBaseWithWood(u);
  else clearUnitOrders(u);
  updateUI();
  draw();
}

// ── Mine (Virelium) ──
function findNearestMineral(fromX, fromY, unitId, maxRange = 50) {
  const key = (x, y) => y * MAP_W + x;
  const queue = [{ x: fromX, y: fromY, d: 0 }], visited = new Set([key(fromX, fromY)]);
  const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  while (queue.length) {
    const cur = queue.shift();
    if (cur.d > maxRange) break;
    if (hasMineral(cur.x, cur.y) && !isMineralClaimedByOther(cur.x, cur.y, unitId) && isWalkableTile(cur.x, cur.y)) {
      return { x: cur.x, y: cur.y };
    }
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
  releaseAllClaimsForUnit(u.id);
  const sx = Math.floor(u.x), sy = Math.floor(u.y);
  let tiles = aStar(sx, sy, gx, gy, false) || pathToClosest(sx, sy, gx, gy);
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
    u.returningMineral = false;
    u.mineTX = u.mineTY = null; u.path = []; u.pathIndex = 0;
    updateUI(); return;
  }
  u.returningMineral = true; u.mineTX = u.mineTY = null;
  const sx = Math.floor(u.x), sy = Math.floor(u.y);
  let tiles = aStar(sx, sy, deposit.x, deposit.y, false) || pathToClosest(sx, sy, deposit.x, deposit.y);
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
  if (u.returningMineral && u.carryingVirelium) { depositMineralAndContinue(u); return; }
  if (u.mineTX === null) return;
  const cx = Math.floor(u.x), cy = Math.floor(u.y);
  const stillThere = hasMineral(u.mineTX, u.mineTY);
  if (Math.abs(cx - u.mineTX) <= 1 && Math.abs(cy - u.mineTY) <= 1 && stillThere) {
    if (u.carryingVirelium) { returnToBaseWithMineral(u); return; }
    u.mineTimer = HARVEST_TIME;
  } else {
    releaseMineral(u.mineTX, u.mineTY, u.id);
    u.mineTX = u.mineTY = null;
    if (u.carryingVirelium) { returnToBaseWithMineral(u); return; }
    const next = findNearestMineral(cx, cy, u.id);
    if (next) setMineTarget(u, next.x + 0.5, next.y + 0.5);
    else { clearUnitOrders(u); updateUI(); }
  }
}
function finishMine(u) {
  if (u.mineTX !== null && u.mineTY !== null && hasMineral(u.mineTX, u.mineTY)) {
    mineralMap[u.mineTY][u.mineTX]--;
    u.carryingVirelium = true;
    if (mineralMap[u.mineTY][u.mineTX] <= 0) {
      releaseMineral(u.mineTX, u.mineTY, u.id);
    }
  } else if (u.mineTX !== null) {
    releaseMineral(u.mineTX, u.mineTY, u.id);
  }
  u.mineTimer = 0; u.mineTX = u.mineTY = null;
  if (u.carryingVirelium && u.mining) returnToBaseWithMineral(u);
  else clearUnitOrders(u);
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
function placeBase(ax, ay) {
  for (const { dx, dy } of BASE_FOOTPRINT) {
    const x = ax + dx, y = ay + dy;
    if (inBounds(x, y)) map[y][x] = TILE_BASE;
  }
}
function setBuildTarget(u, worldX, worldY) {
  const ax = Math.floor(worldX), ay = Math.floor(worldY);
  if (!canPlaceBase(ax, ay)) return false;
  const sx = Math.floor(u.x), sy = Math.floor(u.y);
  let tiles = aStar(sx, sy, ax, ay, false) || pathToClosest(sx, sy, ax, ay);
  if (!tiles || !tiles.length) return false;
  u.building = true; u.buildTX = ax; u.buildTY = ay;
  u.harvesting = false; u.carryingWood = false; u.returningToBase = false;
  return applyPath(u, tiles);
}
function finishBuild(u) {
  if (u.buildTX !== null && u.buildTY !== null && canPlaceBase(u.buildTX, u.buildTY)) {
    placeBase(u.buildTX, u.buildTY);
    if (!isWalkable(u.x, u.y)) {
      const cx = Math.floor(u.x), cy = Math.floor(u.y);
      outer: for (let r = 1; r <= 4; r++)
        for (let dy = -r; dy <= r; dy++)
          for (let dx = -r; dx <= r; dx++)
            if (isWalkableTile(cx + dx, cy + dy)) {
              u.x = cx + dx + 0.5; u.y = cy + dy + 0.5; break outer;
            }
    }
  }
  u.building = false; u.buildTX = u.buildTY = null;
  u.path = []; u.pathIndex = 0; u.goalX = u.goalY = null;
  updateUI();
}

function isRockOrWalkable(x, y) {
  if (!inBounds(x, y)) return false;
  const t = map[y][x];
  return t === TILE_ROCK || t === TILE_DIRT || t === TILE_STUMP || t === TILE_TUNNEL;
}

function setTunnelStart(u, worldX, worldY) {
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
  u.carveTileX = x;
  u.carveTileY = y;
  u.carveTimer = TUNNEL_CARVE_TIME;
  return true;
}

function startTunnelCarve(u) {
  if (!u.tunnelCarvePath || !u.tunnelCarvePath.length) {
    u.tunneling = false;
    u.tunnelStart = u.tunnelEnd = null;
    u.tunnelCarvePath = null;
    updateUI();
    return;
  }
  u.path = u.tunnelCarvePath;
  u.pathIndex = 0;
  if (u.path.length > 1 && Math.hypot(u.path[0].x - u.x, u.path[0].y - u.y) < 0.4) u.pathIndex = 1;
  u.goalX = u.path[u.path.length - 1].x;
  u.goalY = u.path[u.path.length - 1].y;
  u.tunnelCarvePath = null;
  const cx = Math.floor(u.x), cy = Math.floor(u.y);
  if (inBounds(cx, cy) && map[cy][cx] === TILE_ROCK) {
    beginCarveTile(u, cx, cy);
  }
  updateUI();
}

function finishTunnel(u) {
  u.tunneling = false;
  u.tunnelStart = null;
  u.tunnelEnd = null;
  u.tunnelCarvePath = null;
  u.path = []; u.pathIndex = 0; u.goalX = u.goalY = null;
  recomputeRockElevation();
  updateUI();
}

function trainUnitAtBase(bx, by) {
  const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1],[2,0],[-2,0],[0,2],[0,-2]];
  for (const [dx, dy] of dirs) {
    const nx = bx + dx, ny = by + dy;
    if (isWalkableTile(nx, ny)) {
      const u = makeUnit(nx + 0.5, ny + 0.5);
      units.push(u);
      selectedBase = null;
      selectedUnitId = u.id;
      actionMode = null;
      updateUI(); draw();
      return true;
    }
  }
  for (let r = 1; r <= 6; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const nx = bx + dx, ny = by + dy;
        if (isWalkableTile(nx, ny)) {
          const u = makeUnit(nx + 0.5, ny + 0.5);
          units.push(u);
          selectedBase = null;
          selectedUnitId = u.id;
          actionMode = null;
          updateUI(); draw();
          return true;
        }
      }
  return false;
}
