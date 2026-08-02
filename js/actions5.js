function findStandNearBuildingTile(tx, ty, fromX, fromY, unitId) {
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

function setRepairTarget(u, worldX, worldY) {
  if (u.unitType !== 'worker') return false;
  if (u.carryingWood || u.carryingVirelium) return false;
  let gx = Math.floor(worldX), gy = Math.floor(worldY);
  if (!isDamagedFriendlyTile(gx, gy)) {
    let found = false;
    for (let r = 0; r <= 10 && !found; r++)
      for (let dy = -r; dy <= r && !found; dy++)
        for (let dx = -r; dx <= r && !found; dx++) {
          const nx = gx + dx, ny = gy + dy;
          if (isDamagedFriendlyTile(nx, ny)) {
            gx = nx; gy = ny; found = true;
          }
        }
    if (!found) {
      const nearest = findNearestDamagedFriendlyTile(u.x, u.y);
      if (!nearest) return false;
      gx = nearest.x; gy = nearest.y;
    }
  }
  const stand = findStandNearBuildingTile(gx, gy, Math.floor(u.x), Math.floor(u.y), u.id);
  if (!stand) return false;
  releaseAllClaimsForUnit(u.id);
  const sx = Math.floor(u.x), sy = Math.floor(u.y);
  let tiles = aStar(sx, sy, stand.x, stand.y, false) || pathToClosest(sx, sy, stand.x, stand.y);
  if (!tiles || !tiles.length) return false;
  clearUnitOrders(u);
  u.repairing = true;
  u.repairTX = gx; u.repairTY = gy;
  u.repairTimer = 0;
  return applyPath(u, tiles);
}

function setGroupRepairTarget(workerList, worldX, worldY) {
  if (!workerList || !workerList.length) return false;
  let any = false;
  const gx = Math.floor(worldX), gy = Math.floor(worldY);
  const candidates = [];
  for (let r = 0; r <= 12; r++) {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const nx = gx + dx, ny = gy + dy;
        if (isDamagedFriendlyTile(nx, ny)) candidates.push({ x: nx, y: ny });
      }
    if (candidates.length >= workerList.length) break;
  }
  if (!candidates.length) {
    const nearest = findNearestDamagedFriendlyTile(worldX, worldY, 60);
    if (nearest) candidates.push(nearest);
  }
  if (!candidates.length) return false;

  let ci = 0;
  for (const u of workerList) {
    if (u.unitType !== 'worker') continue;
    if (u.carryingWood || u.carryingVirelium) continue;
    const target = candidates[ci % candidates.length];
    ci++;
    if (setRepairTarget(u, target.x + 0.5, target.y + 0.5)) any = true;
  }
  return any;
}

function startRepairOnArrival(u) {
  if (!u.repairing) return;
  if (u.repairTX == null || u.repairTY == null) {
    clearUnitOrders(u);
    return;
  }
  if (!isDamagedFriendlyTile(u.repairTX, u.repairTY)) {
    const next = findNearestDamagedFriendlyTile(u.x, u.y, 20);
    if (next) {
      u.repairTX = next.x; u.repairTY = next.y;
    } else {
      clearUnitOrders(u);
      updateUI();
      return;
    }
  }
  u.repairTimer = REPAIR_TIME;
  updateUI();
}

function finishRepair(u) {
  if (!u.repairing) return;
  if (u.repairTX != null && u.repairTY != null) {
    repairBuildingTile(u.repairTX, u.repairTY, REPAIR_AMOUNT);
  }
  u.repairTimer = 0;
  if (isDamagedFriendlyTile(u.repairTX, u.repairTY)) {
    u.repairTimer = REPAIR_TIME;
  } else {
    const next = findNearestDamagedFriendlyTile(u.x, u.y, 16);
    if (next) {
      setRepairTarget(u, next.x + 0.5, next.y + 0.5);
    } else {
      clearUnitOrders(u);
    }
  }
  updateUI();
}
