// pathfinding.js — A* and path helpers + unit tile exclusivity
const PATH_DIRS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
function heuristic(ax, ay, bx, by) {
  const dx = Math.abs(ax - bx), dy = Math.abs(ay - by);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}
function canTraverse(x, y, gx, gy, opts) {
  if (!inBounds(x, y)) return false;
  const t = map[y][x];
  if (opts.allowRock && t === TILE_ROCK) return true;
  if (opts.allowTreeGoal && x === gx && y === gy && t === TILE_TREE) return true;
  return isWalkableTile(x, y);
}
function aStar(sx, sy, gx, gy, allowTreeGoal = false, allowRock = false) {
  const opts = { allowTreeGoal, allowRock };
  const startOk = isWalkableTile(sx, sy) ||
    (allowTreeGoal && sx === gx && sy === gy) ||
    (allowRock && inBounds(sx, sy) && map[sy][sx] === TILE_ROCK);
  if (!startOk) return null;
  const key = (x, y) => y * MAP_W + x;
  const open = [], cameFrom = new Map(), gScore = new Map(), closed = new Set();
  gScore.set(key(sx, sy), 0);
  open.push({ x: sx, y: sy, f: heuristic(sx, sy, gx, gy), g: 0 });
  let iterations = 0, maxIter = MAP_W * MAP_H;
  while (open.length && iterations++ < maxIter) {
    let best = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[best].f) best = i;
    const cur = open[best];
    open[best] = open[open.length - 1]; open.pop();
    const ck = key(cur.x, cur.y);
    if (closed.has(ck)) continue;
    closed.add(ck);
    if (cur.x === gx && cur.y === gy) {
      const path = []; let cx = gx, cy = gy;
      while (true) {
        path.push({ x: cx, y: cy });
        const pk = cameFrom.get(key(cx, cy));
        if (pk === undefined) break;
        cx = pk.x; cy = pk.y;
      }
      path.reverse();
      return path;
    }
    for (const [dx, dy] of PATH_DIRS) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (!canTraverse(nx, ny, gx, gy, opts)) continue;
      if (dx && dy) {
        if (!canTraverse(cur.x + dx, cur.y, gx, gy, opts) ||
            !canTraverse(cur.x, cur.y + dy, gx, gy, opts)) continue;
      }
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      let step = (dx && dy) ? Math.SQRT2 : 1;
      if (allowRock && inBounds(nx, ny) && map[ny][nx] === TILE_ROCK) step += 0.15;
      const tg = cur.g + step;
      if (tg < (gScore.get(nk) ?? Infinity)) {
        cameFrom.set(nk, { x: cur.x, y: cur.y });
        gScore.set(nk, tg);
        open.push({ x: nx, y: ny, f: tg + heuristic(nx, ny, gx, gy), g: tg });
      }
    }
  }
  return null;
}
function pathToClosest(sx, sy, gx, gy) {
  if (!isWalkableTile(sx, sy)) return [{ x: sx, y: sy }];
  const key = (x, y) => y * MAP_W + x;
  const queue = [{ x: sx, y: sy }], cameFrom = new Map(), visited = new Set([key(sx, sy)]);
  let best = { x: sx, y: sy }, bestDist = heuristic(sx, sy, gx, gy);
  const dirs4 = [[1,0],[-1,0],[0,1],[0,-1]];
  while (queue.length) {
    const cur = queue.shift();
    const d = heuristic(cur.x, cur.y, gx, gy);
    if (d < bestDist) { bestDist = d; best = cur; }
    for (const [dx, dy] of dirs4) {
      const nx = cur.x + dx, ny = cur.y + dy, nk = key(nx, ny);
      if (!isWalkableTile(nx, ny) || visited.has(nk)) continue;
      visited.add(nk); cameFrom.set(nk, { x: cur.x, y: cur.y });
      queue.push({ x: nx, y: ny });
    }
  }
  const path = []; let cx = best.x, cy = best.y;
  while (true) {
    path.push({ x: cx, y: cy });
    const pk = cameFrom.get(key(cx, cy));
    if (pk === undefined) break;
    cx = pk.x; cy = pk.y;
  }
  path.reverse();
  return path;
}
function applyPath(u, tiles) {
  if (!tiles || !tiles.length) return false;
  u.path = tiles.map(t => ({ x: t.x + 0.5, y: t.y + 0.5 }));
  u.pathIndex = 0;
  if (u.path.length > 1 && Math.hypot(u.path[0].x - u.x, u.path[0].y - u.y) < 0.4) u.pathIndex = 1;
  u.goalX = u.path[u.path.length - 1].x;
  u.goalY = u.path[u.path.length - 1].y;
  return true;
}

/** Unit is standing still (not currently walking a path). */
function isUnitIdle(u) {
  return !u.path || u.path.length === 0 || u.pathIndex >= u.path.length;
}

/**
 * Tile cannot be used as a final stand position if another unit is on it
 * or already has that tile as its path goal.
 */
function isTileBlockedForStand(tx, ty, excludeId) {
  for (const u of units) {
    if (excludeId != null && u.id === excludeId) continue;
    if (Math.floor(u.x) === tx && Math.floor(u.y) === ty) return true;
    if (u.goalX != null && u.goalY != null &&
        Math.floor(u.goalX) === tx && Math.floor(u.goalY) === ty) return true;
  }
  return false;
}

/** @deprecated alias — use isTileBlockedForStand */
function isTileOccupiedByIdleUnit(tx, ty, excludeId) {
  return isTileBlockedForStand(tx, ty, excludeId);
}

/** Nearest walkable tile free for this unit to stand on. */
function findFreeStandTile(nearX, nearY, excludeId, maxR = 8) {
  const cx = Math.floor(nearX), cy = Math.floor(nearY);
  if (isWalkableTile(cx, cy) && !isTileBlockedForStand(cx, cy, excludeId)) {
    return { x: cx, y: cy };
  }
  for (let r = 1; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const nx = cx + dx, ny = cy + dy;
        if (!isWalkableTile(nx, ny)) continue;
        if (isTileBlockedForStand(nx, ny, excludeId)) continue;
        return { x: nx, y: ny };
      }
    }
  }
  return null;
}

/**
 * If idle units share a tile, move the later ones (higher id) to free tiles.
 */
function separateIdleUnits() {
  let moved = false;
  const claim = new Map();
  const idle = units.filter(isUnitIdle).slice().sort((a, b) => a.id - b.id);

  for (const u of idle) {
    const tx = Math.floor(u.x), ty = Math.floor(u.y);
    const k = tx + ',' + ty;
    if (!claim.has(k)) {
      claim.set(k, u.id);
      continue;
    }
    const free = findFreeStandTile(u.x, u.y, u.id);
    if (free) {
      u.x = free.x + 0.5;
      u.y = free.y + 0.5;
      claim.set(free.x + ',' + free.y, u.id);
      moved = true;
    }
  }
  return moved;
}

/** After a path ends, ensure the unit is not on another unit's tile. */
function resolveIdleStand(u) {
  if (!u || !isUnitIdle(u)) return false;
  const tx = Math.floor(u.x), ty = Math.floor(u.y);
  if (!isTileBlockedForStand(tx, ty, u.id)) return false;
  const free = findFreeStandTile(u.x, u.y, u.id);
  if (!free) return false;
  u.x = free.x + 0.5;
  u.y = free.y + 0.5;
  return true;
}
