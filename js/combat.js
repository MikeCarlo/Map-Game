// combat.js — soldier attack, enemy AI, hut spawning

/** Live (undestroyed) hut tile closest to a point, or null when the hut is rubble. */
function nearestHutTile(hut, fromX, fromY) {
  if (!hut) return null;
  return nearestLiveBuildingTile(fromX, fromY, footprintTiles(hut.x, hut.y, HUT_FOOTPRINT));
}

/** Distance from a point to the closest live hut tile centre, or null if none left. */
function distToHut(hut, fromX, fromY) {
  const t = nearestHutTile(hut, fromX, fromY);
  if (!t) return null;
  return Math.hypot(t.x + 0.5 - fromX, t.y + 0.5 - fromY);
}

function canHitHutFrom(hut, fromX, fromY) {
  const d = distToHut(hut, fromX, fromY);
  return d != null && d <= SOLDIER_BUILDING_REACH;
}

/**
 * Stand tile for attacking a hut: a free tile that is actually in weapon reach
 * of a live hut tile, nearest to the soldier. Falls back to a free tile near
 * the hut (nearest to the hut, not to the soldier) when the ring is crowded.
 */
function findStandNearHut(hut, fromX, fromY, unitId) {
  let best = null, bestD = Infinity;
  let fallback = null, fallbackD = Infinity;
  for (let r = 1; r <= 4; r++) {
    for (let dy = -r; dy <= HUT_SIZE - 1 + r; dy++) {
      for (let dx = -r; dx <= HUT_SIZE - 1 + r; dx++) {
        const nx = hut.x + dx, ny = hut.y + dy;
        if (!isWalkableTile(nx, ny)) continue;
        if (unitId != null && isTileBlockedForStand(nx, ny, unitId)) continue;
        const toUnit = Math.hypot(nx + 0.5 - fromX, ny + 0.5 - fromY);
        const toHut = distToHut(hut, nx + 0.5, ny + 0.5);
        if (toHut == null) return null;
        if (toHut <= SOLDIER_BUILDING_REACH) {
          if (toUnit < bestD) { bestD = toUnit; best = { x: nx, y: ny }; }
        } else if (toHut < fallbackD) {
          fallbackD = toHut; fallback = { x: nx, y: ny };
        }
      }
    }
  }
  return best || fallback;
}

function setAttackEnemy(u, target) {
  if (!u || u.unitType !== 'soldier' || !target || target.unitType !== 'enemy') return false;
  clearUnitOrders(u);
  u.attacking = true;
  u.attackTargetId = target.id;
  u.attackHutId = null;
  u.attackTimer = 0;
  const dist = Math.hypot(u.x - target.x, u.y - target.y);
  if (dist <= SOLDIER_ATTACK_RANGE) return true;
  let stand = findFreeStandTile(target.x, target.y, u.id, 4);
  if (!stand) stand = { x: Math.floor(target.x), y: Math.floor(target.y) };
  const sx = Math.floor(u.x), sy = Math.floor(u.y);
  const tiles = aStar(sx, sy, stand.x, stand.y, false) || pathToClosest(sx, sy, stand.x, stand.y);
  return applyPath(u, tiles);
}

function setAttackHut(u, hut) {
  if (!u || u.unitType !== 'soldier' || !hut) return false;
  if (!nearestHutTile(hut, u.x, u.y)) return false; // already flattened
  clearUnitOrders(u);
  u.attacking = true;
  u.attackHutId = hut.id;
  u.attackTargetId = null;
  u.attackTimer = 0;
  if (canHitHutFrom(hut, u.x, u.y)) return true;
  const stand = findStandNearHut(hut, u.x, u.y, u.id);
  if (!stand) return false;
  const sx = Math.floor(u.x), sy = Math.floor(u.y);
  if (stand.x === sx && stand.y === sy) return true;
  const tiles = aStar(sx, sy, stand.x, stand.y, false) || pathToClosest(sx, sy, stand.x, stand.y);
  return applyPath(u, tiles);
}

function setAttackAtPoint(u, worldX, worldY) {
  if (!u || u.unitType !== 'soldier') return false;
  let bestEnemy = null, bestD = Infinity;
  for (const e of units) {
    if (e.unitType !== 'enemy') continue;
    const d = Math.hypot(e.x - worldX, e.y - worldY);
    if (d < 1.6 && d < bestD) { bestD = d; bestEnemy = e; }
  }
  if (bestEnemy) return setAttackEnemy(u, bestEnemy);
  const tx = Math.floor(worldX), ty = Math.floor(worldY);
  const hut = findHutAt(tx, ty);
  if (hut) return setAttackHut(u, hut);
  for (const e of units) {
    if (e.unitType !== 'enemy') continue;
    const d = Math.hypot(e.x - worldX, e.y - worldY);
    if (d < 8 && d < bestD) { bestD = d; bestEnemy = e; }
  }
  if (bestEnemy) return setAttackEnemy(u, bestEnemy);
  let bestHut = null;
  bestD = Infinity;
  for (const h of huts) {
    const d = Math.hypot(h.x + HUT_SIZE / 2 - worldX, h.y + HUT_SIZE / 2 - worldY);
    if (d < 10 && d < bestD) { bestD = d; bestHut = h; }
  }
  if (bestHut) return setAttackHut(u, bestHut);
  return false;
}

/**
 * Defend: the soldier holds a post, engages enemies that come within
 * DEFEND_RADIUS of it, and walks back once the fight is over.
 */
function setDefendPost(u, worldX, worldY) {
  if (!u || u.unitType !== 'soldier') return false;
  let gx = Math.floor(worldX), gy = Math.floor(worldY);
  if (!isWalkableTile(gx, gy)) {
    const free = findFreeStandTile(gx + 0.5, gy + 0.5, u.id, 10);
    if (!free) return false;
    gx = free.x; gy = free.y;
  }
  clearUnitOrders(u);
  u.defending = true;
  u.defendX = gx + 0.5;
  u.defendY = gy + 0.5;
  u.defendRepathTimer = 0;
  const sx = Math.floor(u.x), sy = Math.floor(u.y);
  if (sx === gx && sy === gy) return true;
  const tiles = aStar(sx, sy, gx, gy, false) || pathToClosest(sx, sy, gx, gy);
  applyPath(u, tiles);
  return true; // the post stands even if the walk there fails; the soldier retries
}

/** Spread the group over free tiles around the tapped spot, one post each. */
function setGroupDefendPost(soldiers, worldX, worldY) {
  if (!soldiers || !soldiers.length) return false;
  const cx = Math.floor(worldX), cy = Math.floor(worldY);
  const taken = new Set();
  function takePostNear() {
    for (let r = 0; r <= 10; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (r > 0 && Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const nx = cx + dx, ny = cy + dy, k = nx + ',' + ny;
          if (!isWalkableTile(nx, ny) || taken.has(k)) continue;
          taken.add(k);
          return { x: nx, y: ny };
        }
      }
    }
    return null;
  }
  const order = soldiers.slice().sort((a, b) =>
    Math.hypot(a.x - worldX, a.y - worldY) - Math.hypot(b.x - worldX, b.y - worldY));
  let any = false;
  for (const u of order) {
    if (u.unitType !== 'soldier') continue;
    const post = takePostNear();
    if (!post) continue;
    if (setDefendPost(u, post.x + 0.5, post.y + 0.5)) any = true;
  }
  return any;
}

/** Nearest enemy threatening the post (or already on top of the defender). */
function findIntruder(u) {
  let best = null, bestD = Infinity;
  for (const e of units) {
    if (e.unitType !== 'enemy') continue;
    const dPost = Math.hypot(e.x - u.defendX, e.y - u.defendY);
    const dSelf = Math.hypot(e.x - u.x, e.y - u.y);
    if (dPost > DEFEND_RADIUS && dSelf > SOLDIER_ATTACK_RANGE + 1) continue;
    if (dPost < bestD) { bestD = dPost; best = e; }
  }
  return best;
}

/** Attack an intruder without losing the post. */
function engageFromPost(u, target) {
  const px = u.defendX, py = u.defendY;
  const ok = setAttackEnemy(u, target); // clears orders, including the post
  u.defending = true;
  u.defendX = px; u.defendY = py;
  return ok;
}

function returnToPost(u, dt) {
  if (Math.hypot(u.x - u.defendX, u.y - u.defendY) <= DEFEND_POST_SLACK) return false;
  u.defendRepathTimer = (u.defendRepathTimer || 0) - dt;
  if (u.path.length || u.defendRepathTimer > 0) return false;
  u.defendRepathTimer = DEFEND_REPATH_INTERVAL;
  let gx = Math.floor(u.defendX), gy = Math.floor(u.defendY);
  if (isTileBlockedForStand(gx, gy, u.id)) {
    const free = findFreeStandTile(u.defendX, u.defendY, u.id, 4);
    if (!free) return false;
    gx = free.x; gy = free.y;
  }
  const sx = Math.floor(u.x), sy = Math.floor(u.y);
  if (sx === gx && sy === gy) return false;
  const tiles = aStar(sx, sy, gx, gy, false) || pathToClosest(sx, sy, gx, gy);
  return applyPath(u, tiles);
}

/** One tick of defend duty. Returns true if anything visible changed. */
function updateDefender(u, dt) {
  if (!u.defending || u.defendX == null) return false;
  if (u.attackHutId != null) return false; // player ordered a hut attack instead
  if (u.attacking && u.attackTargetId != null) {
    const target = units.find(e => e.id === u.attackTargetId);
    const strayed = target &&
      Math.hypot(target.x - u.defendX, target.y - u.defendY) > DEFEND_LEASH;
    if (target && !strayed) return false; // keep fighting
    u.attacking = false; u.attackTargetId = null; u.attackTimer = 0;
    u.path = []; u.pathIndex = 0; u.goalX = u.goalY = null;
  }
  const intruder = findIntruder(u);
  if (intruder) return engageFromPost(u, intruder);
  return returnToPost(u, dt);
}

function setGroupAttackAtPoint(soldiers, worldX, worldY) {
  if (!soldiers || !soldiers.length) return false;
  let any = false;
  for (const u of soldiers) {
    if (setAttackAtPoint(u, worldX, worldY)) any = true;
  }
  return any;
}

function destroyHut(hut) {
  if (!hut) return;
  for (const { dx, dy } of HUT_FOOTPRINT) {
    const x = hut.x + dx, y = hut.y + dy;
    if (inBounds(x, y) && map[y][x] === TILE_HUT) map[y][x] = TILE_DIRT;
    clearBuildingTileHp(x, y);
  }
  for (const u of units) {
    if (u.attackHutId === hut.id) {
      u.attacking = false; u.attackHutId = null; u.attackTimer = 0;
    }
  }
  huts = huts.filter(h => h.id !== hut.id);
  if (selectedHut && selectedHut.x === hut.x && selectedHut.y === hut.y) selectedHut = null;
  updateUI();
}

function spawnDeathMark(u) {
  if (!u) return;
  deathMarks.push({
    x: u.x,
    y: u.y,
    age: 0,
    maxAge: DEATH_MARK_DURATION,
    unitType: u.unitType
  });
}

function updateDeathMarks(dt) {
  if (!deathMarks.length) return false;
  for (const m of deathMarks) m.age += dt;
  const before = deathMarks.length;
  deathMarks = deathMarks.filter(m => m.age < m.maxAge);
  return true; // always redraw while any exist or just faded
}

function removeUnit(u) {
  if (!u) return;
  spawnDeathMark(u);
  releaseAllClaimsForUnit(u.id);
  for (const other of units) {
    if (other.attackTargetId === u.id) {
      other.attacking = false; other.attackTargetId = null; other.attackTimer = 0;
      other.path = []; other.pathIndex = 0; other.goalX = other.goalY = null;
    }
  }
  units = units.filter(x => x.id !== u.id);
  if (selectedUnitIds.includes(u.id)) {
    selectedUnitIds = selectedUnitIds.filter(id => id !== u.id);
    fullSelectionIds = fullSelectionIds.filter(id => id !== u.id);
    selectedUnitId = selectedUnitIds[0] ?? null;
  }
  if (selectedUnitId === u.id) selectedUnitId = null;
}

function spawnEnemyFromHut(hut) {
  if (!hut) return null;
  if (countEnemies() >= HUT_MAX_ALIVE_ENEMIES) return null;
  return spawnUnitNear(hut.x, hut.y, 'enemy');
}

function updateHuts(dt) {
  let changed = false;
  for (const hut of huts.slice()) {
    hut.spawnTimer -= dt;
    if (hut.spawnTimer <= 0) {
      hut.spawnTimer = HUT_SPAWN_INTERVAL_MIN +
        Math.random() * (HUT_SPAWN_INTERVAL_MAX - HUT_SPAWN_INTERVAL_MIN);
      if (spawnEnemyFromHut(hut)) changed = true;
    }
  }
  return changed;
}

function damageUnit(u, amount) {
  if (!u || u.hp == null) return false;
  u.hp -= amount;
  if (u.hp <= 0) {
    removeUnit(u);
    return true;
  }
  return false;
}

function updateCombat(dt) {
  let changed = false;
  for (const u of units.slice()) {
    if (u.unitType !== 'soldier') continue;
    if (u.defending && updateDefender(u, dt)) changed = true;
    if (!u.attacking) continue;
    if (u.attackHutId != null) {
      const hut = huts.find(h => h.id === u.attackHutId);
      if (!hut) { u.attacking = false; u.attackHutId = null; continue; }
      const tile = nearestHutTile(hut, u.x, u.y);
      if (!tile) { u.attacking = false; u.attackHutId = null; continue; }
      const dist = Math.hypot(tile.x + 0.5 - u.x, tile.y + 0.5 - u.y);
      if (dist > SOLDIER_BUILDING_REACH) {
        u.attackRepathTimer = (u.attackRepathTimer || 0) - dt;
        if (!u.path.length && u.attackRepathTimer <= 0) {
          setAttackHut(u, hut);
          u.attackRepathTimer = ATTACK_REPATH_INTERVAL;
        }
        continue;
      }
      u.path = []; u.pathIndex = 0; u.goalX = u.goalY = null;
      u.attackTimer -= dt;
      if (u.attackTimer <= 0) {
        u.attackTimer = SOLDIER_ATTACK_INTERVAL;
        damageBuildingTile(tile.x, tile.y, SOLDIER_ATTACK_DAMAGE);
        changed = true;
      }
      continue;
    }
    if (u.attackTargetId != null) {
      const target = units.find(e => e.id === u.attackTargetId);
      if (!target) { u.attacking = false; u.attackTargetId = null; continue; }
      const dist = Math.hypot(u.x - target.x, u.y - target.y);
      if (dist > SOLDIER_ATTACK_RANGE) {
        if (!u.path.length || Math.hypot((u.goalX || 0) - target.x, (u.goalY || 0) - target.y) > 1.5) {
          if (u.defending) engageFromPost(u, target);
          else setAttackEnemy(u, target);
        }
        continue;
      }
      u.path = []; u.pathIndex = 0; u.goalX = u.goalY = null;
      u.attackTimer -= dt;
      if (u.attackTimer <= 0) {
        u.attackTimer = SOLDIER_ATTACK_INTERVAL;
        if (damageUnit(target, SOLDIER_ATTACK_DAMAGE)) {
          u.attacking = false; u.attackTargetId = null;
        }
        changed = true;
      }
    }
  }

  for (const e of units.slice()) {
    if (e.unitType !== 'enemy') continue;
    let target = null, best = Infinity;
    for (const p of units) {
      if (p.unitType !== 'worker' && p.unitType !== 'soldier') continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < best && d <= ENEMY_AGGRO_RANGE) { best = d; target = p; }
    }
    if (!target) {
      if (playerBase && playerBase.segments.length && (!e.path.length || Math.random() < 0.002)) {
        const seg = playerBase.segments[0];
        const free = findFreeStandTile(seg.x + 1.5, seg.y + 1.5, e.id, 6);
        if (free) {
          const sx = Math.floor(e.x), sy = Math.floor(e.y);
          const tiles = aStar(sx, sy, free.x, free.y, false) || pathToClosest(sx, sy, free.x, free.y);
          applyPath(e, tiles);
        }
      }
      continue;
    }
    const dist = Math.hypot(e.x - target.x, e.y - target.y);
    if (dist <= SOLDIER_ATTACK_RANGE) {
      e.path = []; e.pathIndex = 0; e.goalX = e.goalY = null;
      e.attackTimer = (e.attackTimer || 0) - dt;
      if (e.attackTimer <= 0) {
        e.attackTimer = ENEMY_ATTACK_INTERVAL;
        damageUnit(target, ENEMY_ATTACK_DAMAGE);
        changed = true;
      }
    } else if (!e.path.length || Math.hypot((e.goalX || 0) - target.x, (e.goalY || 0) - target.y) > 2) {
      const free = findFreeStandTile(target.x, target.y, e.id, 5);
      if (free) {
        const sx = Math.floor(e.x), sy = Math.floor(e.y);
        const tiles = aStar(sx, sy, free.x, free.y, false) || pathToClosest(sx, sy, free.x, free.y);
        applyPath(e, tiles);
      }
    }
  }
  return changed;
}
