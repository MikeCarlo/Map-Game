// combat.js — soldier attack, enemy AI, hut spawning
function findStandNearHut(hut, fromX, fromY, unitId) {
  let best = null, bestD = Infinity;
  for (let r = 1; r <= 4; r++) {
    for (let dy = -r; dy <= HUT_SIZE - 1 + r; dy++) {
      for (let dx = -r; dx <= HUT_SIZE - 1 + r; dx++) {
        const nx = hut.x + dx, ny = hut.y + dy;
        if (!isWalkableTile(nx, ny)) continue;
        if (unitId != null && isTileBlockedForStand(nx, ny, unitId)) continue;
        const d = Math.hypot(nx - fromX, ny - fromY);
        if (d < bestD) { bestD = d; best = { x: nx, y: ny }; }
      }
    }
  }
  return best;
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
  clearUnitOrders(u);
  u.attacking = true;
  u.attackHutId = hut.id;
  u.attackTargetId = null;
  u.attackTimer = 0;
  const hx = hut.x + HUT_SIZE / 2, hy = hut.y + HUT_SIZE / 2;
  const dist = Math.hypot(u.x - hx, u.y - hy);
  if (dist <= SOLDIER_ATTACK_RANGE + 1.2) return true;
  const stand = findStandNearHut(hut, Math.floor(u.x), Math.floor(u.y), u.id);
  if (!stand) return false;
  const sx = Math.floor(u.x), sy = Math.floor(u.y);
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

function removeUnit(u) {
  if (!u) return;
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
    if (u.unitType !== 'soldier' || !u.attacking) continue;
    if (u.attackHutId != null) {
      const hut = huts.find(h => h.id === u.attackHutId);
      if (!hut) { u.attacking = false; u.attackHutId = null; continue; }
      const hx = hut.x + HUT_SIZE / 2, hy = hut.y + HUT_SIZE / 2;
      const dist = Math.hypot(u.x - hx, u.y - hy);
      if (dist > SOLDIER_ATTACK_RANGE + 1.4) {
        if (!u.path.length) setAttackHut(u, hut);
        continue;
      }
      u.path = []; u.pathIndex = 0; u.goalX = u.goalY = null;
      u.attackTimer -= dt;
      if (u.attackTimer <= 0) {
        u.attackTimer = SOLDIER_ATTACK_INTERVAL;
        hut.hp -= SOLDIER_ATTACK_DAMAGE;
        changed = true;
        if (hut.hp <= 0) destroyHut(hut);
      }
      continue;
    }
    if (u.attackTargetId != null) {
      const target = units.find(e => e.id === u.attackTargetId);
      if (!target) { u.attacking = false; u.attackTargetId = null; continue; }
      const dist = Math.hypot(u.x - target.x, u.y - target.y);
      if (dist > SOLDIER_ATTACK_RANGE) {
        if (!u.path.length || Math.hypot((u.goalX || 0) - target.x, (u.goalY || 0) - target.y) > 1.5) {
          setAttackEnemy(u, target);
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
