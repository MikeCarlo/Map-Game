// actions.js — unit actions: move, cut, mine, build, tunnel, train, upgrade, armory
function setMoveTarget(u, worldX, worldY) {
  let gx = Math.floor(worldX), gy = Math.floor(worldY);
  if (!isWalkableTile(gx, gy) || isTileBlockedForStand(gx, gy, u.id)) {
    const free = findFreeStandTile(worldX, worldY, u.id, 8);
    if (!free) return false;
    gx = free.x; gy = free.y;
  }
  const sx = Math.floor(u.x), sy = Math.floor(u.y);
  let tiles = aStar(sx, sy, gx, gy, false) || pathToClosest(sx, sy, gx, gy);
  if (!tiles || !tiles.length) return false;
  clearUnitOrders(u);
  return applyPath(u, tiles);
}
