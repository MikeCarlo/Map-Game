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
