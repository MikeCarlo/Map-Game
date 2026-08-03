// map.js — map helpers + procedural generation
function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function inBounds(x, y) { return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H; }
function isWalkableTile(x, y) {
  if (!inBounds(x, y)) return false;
  const t = map[y][x];
  return t === TILE_DIRT || t === TILE_STUMP || t === TILE_TUNNEL;
}

function recomputeRockElevation() {
  rockElev = new Array(MAP_H);
  for (let y = 0; y < MAP_H; y++) rockElev[y] = new Array(MAP_W).fill(0);
  const key = (x, y) => y * MAP_W + x;
  const queue = [];
  const dist = new Map();
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (map[y][x] !== TILE_ROCK) {
        queue.push({ x, y });
        dist.set(key(x, y), 0);
      }
    }
  }
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  let qi = 0;
  while (qi < queue.length) {
    const cur = queue[qi++];
    const d = dist.get(key(cur.x, cur.y));
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (!inBounds(nx, ny) || map[ny][nx] !== TILE_ROCK) continue;
      const nk = key(nx, ny);
      if (dist.has(nk)) continue;
      const nd = d + 1;
      dist.set(nk, nd);
      rockElev[ny][nx] = Math.min(ROCK_SHADES.length - 1, nd);
      queue.push({ x: nx, y: ny });
    }
  }
}
function hasMineral(x, y) {
  return inBounds(x, y) && mineralMap && mineralMap[y][x] > 0;
}
function isWalkable(tx, ty) { return isWalkableTile(Math.floor(tx), Math.floor(ty)); }

function createEmptyMap() {
  const m = new Array(MAP_H);
  for (let y = 0; y < MAP_H; y++) m[y] = new Array(MAP_W).fill(TILE_DIRT);
  return m;
}
function setRock(m, x, y, thickness) {
  for (let dy = -thickness; dy <= thickness; dy++)
    for (let dx = -thickness; dx <= thickness; dx++)
      if (Math.abs(dx) + Math.abs(dy) <= thickness + 1) {
        const nx = x + dx, ny = y + dy;
        if (inBounds(nx, ny)) m[ny][nx] = TILE_ROCK;
      }
}
function generateRockVeins(m) {
  const ranges = rand(3, 6);
  for (let r = 0; r < ranges; r++) {
    let x, y, dx, dy;
    const edge = rand(0, 3);
    if (edge === 0) { x = rand(5, MAP_W - 6); y = rand(2, 12); dx = rand(-1, 1); dy = 1; }
    else if (edge === 1) { x = rand(MAP_W - 13, MAP_W - 3); y = rand(5, MAP_H - 6); dx = -1; dy = rand(-1, 1); }
    else if (edge === 2) { x = rand(5, MAP_W - 6); y = rand(MAP_H - 13, MAP_H - 3); dx = rand(-1, 1); dy = -1; }
    else { x = rand(2, 12); y = rand(5, MAP_H - 6); dx = 1; dy = rand(-1, 1); }
    if (!dx && !dy) dy = 1;
    const length = rand(55, 110);
    let thickness = rand(2, 4);
    for (let i = 0; i < length; i++) {
      setRock(m, x, y, thickness);
      if (Math.random() < 0.08) thickness = Math.max(1, Math.min(5, thickness + rand(-1, 1)));
      if (Math.random() < 0.18) {
        if (Math.abs(dx) >= Math.abs(dy)) dy = rand(-1, 1); else dx = rand(-1, 1);
      }
      x += dx; y += dy;
      if (x < 2 || x >= MAP_W - 2) { dx = -dx; x = Math.max(2, Math.min(MAP_W - 3, x)); }
      if (y < 2 || y >= MAP_H - 2) { dy = -dy; y = Math.max(2, Math.min(MAP_H - 3, y)); }
    }
  }
}
function generateWater(m) {
  const edge = rand(0, 3), baseDepth = rand(10, 20);
  const coast = new Array(edge === 0 || edge === 2 ? MAP_W : MAP_H);
  let offset = 0;
  for (let i = 0; i < coast.length; i++) {
    offset += rand(-1, 1); offset = Math.max(-6, Math.min(8, offset));
    coast[i] = baseDepth + offset;
  }
  for (let p = 0; p < 2; p++) {
    const next = coast.slice();
    for (let i = 1; i < coast.length - 1; i++) next[i] = Math.round((coast[i-1] + coast[i] + coast[i+1]) / 3);
    for (let i = 0; i < coast.length; i++) coast[i] = next[i];
  }
  if (edge === 0) for (let x = 0; x < MAP_W; x++) for (let y = 0; y < Math.max(3, coast[x]); y++) m[y][x] = TILE_WATER;
  else if (edge === 1) for (let y = 0; y < MAP_H; y++) for (let x = MAP_W - Math.max(3, coast[y]); x < MAP_W; x++) m[y][x] = TILE_WATER;
  else if (edge === 2) for (let x = 0; x < MAP_W; x++) for (let y = MAP_H - Math.max(3, coast[x]); y < MAP_H; y++) m[y][x] = TILE_WATER;
  else for (let y = 0; y < MAP_H; y++) for (let x = 0; x < Math.max(3, coast[y]); x++) m[y][x] = TILE_WATER;

  const numRivers = rand(1, 3);
  for (let r = 0; r < numRivers; r++) {
    let x, y, dx, dy;
    if (edge === 0) { x = rand(8, MAP_W - 9); y = coast[x] || baseDepth; dx = rand(-1, 1); dy = 1; }
    else if (edge === 1) { x = MAP_W - (coast[rand(0, MAP_H-1)] || baseDepth); y = rand(8, MAP_H - 9); dx = -1; dy = rand(-1, 1); }
    else if (edge === 2) { x = rand(8, MAP_W - 9); y = MAP_H - (coast[x] || baseDepth); dx = rand(-1, 1); dy = -1; }
    else { x = coast[rand(0, MAP_H-1)] || baseDepth; y = rand(8, MAP_H - 9); dx = 1; dy = rand(-1, 1); }
    if (!dx && !dy) dy = edge === 0 ? 1 : -1;
    const length = rand(40, 90); let width = rand(1, 2);
    for (let i = 0; i < length; i++) {
      for (let w = -width; w <= width; w++) {
        const nx = x + (Math.abs(dx) > Math.abs(dy) ? 0 : w);
        const ny = y + (Math.abs(dx) > Math.abs(dy) ? w : 0);
        if (inBounds(nx, ny)) m[ny][nx] = TILE_WATER;
      }
      if (inBounds(x, y)) m[y][x] = TILE_WATER;
      if (Math.random() < 0.12) width = Math.max(1, Math.min(3, width + rand(-1, 1)));
      if (Math.random() < 0.25) {
        if (Math.abs(dx) >= Math.abs(dy)) dy = rand(-1, 1); else dx = rand(-1, 1);
      }
      x += dx; y += dy;
      if (!inBounds(x, y)) break;
    }
  }
  const lakes = rand(1, 4);
  for (let l = 0; l < lakes; l++) {
    let cx = rand(20, MAP_W - 21), cy = rand(20, MAP_H - 21), size = rand(15, 45);
    const queue = [[cx, cy]], visited = new Set([cx + ',' + cy]); let count = 0;
    while (queue.length && count < size) {
      const [x, y] = queue.shift();
      if (m[y][x] === TILE_DIRT || m[y][x] === TILE_ROCK) { m[y][x] = TILE_WATER; count++; }
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
        if (inBounds(nx, ny) && !visited.has(k) && Math.random() < 0.62) {
          visited.add(k); queue.push([nx, ny]);
        }
      }
    }
  }
}
function placeTree(m, dens, x, y) {
  if (Math.random() < 0.10) {
    m[y][x] = TILE_STUMP;
    dens[y][x] = 0;
  } else {
    m[y][x] = TILE_TREE;
    dens[y][x] = rand(1, 5);
  }
}
function generateTrees(m, dens) {
  const numForests = rand(7, 13);
  for (let f = 0; f < numForests; f++) {
    let cx = rand(8, MAP_W - 9), cy = rand(8, MAP_H - 9);
    if (m[cy][cx] !== TILE_DIRT) continue;
    const targetSize = rand(50, 220);
    const queue = [[cx, cy]], visited = new Set([cx + ',' + cy]); let count = 0;
    while (queue.length && count < targetSize) {
      const [x, y] = queue.shift();
      if (m[y][x] === TILE_DIRT) {
        if (Math.random() < 0.88) placeTree(m, dens, x, y);
        count++;
      }
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
        const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
        if (inBounds(nx, ny) && !visited.has(k) && Math.random() < 0.58) {
          visited.add(k); queue.push([nx, ny]);
        }
      }
    }
  }
  const clumps = rand(5, 10);
  for (let c = 0; c < clumps; c++) {
    let cx = rand(4, MAP_W - 5), cy = rand(4, MAP_H - 5);
    if (m[cy][cx] !== TILE_DIRT) continue;
    const size = rand(12, 40);
    const queue = [[cx, cy]], visited = new Set([cx + ',' + cy]); let count = 0;
    while (queue.length && count < size) {
      const [x, y] = queue.shift();
      if (m[y][x] === TILE_DIRT) {
        if (Math.random() < 0.92) placeTree(m, dens, x, y);
        count++;
      }
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
        if (inBounds(nx, ny) && !visited.has(k) && Math.random() < 0.7) {
          visited.add(k); queue.push([nx, ny]);
        }
      }
    }
  }
}

function generateJets(m, minerals) {
  jets = [];
  jetPulses = [];
  const jetCount = rand(2, 4);
  for (let j = 0; j < jetCount; j++) {
    let cx, cy, ok = false;
    for (let attempt = 0; attempt < 80 && !ok; attempt++) {
      cx = rand(20, MAP_W - 21);
      cy = rand(20, MAP_H - 21);
      if (m[cy][cx] === TILE_DIRT || m[cy][cx] === TILE_STUMP) ok = true;
    }
    if (!ok) continue;
    m[cy][cx] = TILE_JET;
    minerals[cy][cx] = 0;

    const radius = rand(5, 9);
    const interval = rand(JET_SPEW_INTERVAL_MIN, JET_SPEW_INTERVAL_MAX);
    const amount = rand(JET_SPEW_AMOUNT_MIN, JET_SPEW_AMOUNT_MAX);

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx === 0 && dy === 0) continue;
        const dist = Math.hypot(dx, dy);
        if (dist > radius) continue;
        const nx = cx + dx, ny = cy + dy;
        if (!inBounds(nx, ny)) continue;
        if (m[ny][nx] !== TILE_DIRT && m[ny][nx] !== TILE_STUMP) continue;
        const chance = 0.75 * (1 - dist / (radius + 1));
        if (Math.random() < chance) {
          const maxD = Math.max(1, Math.round(10 * (1 - dist / (radius + 0.5))));
          minerals[ny][nx] = rand(1, maxD);
        }
      }
    }

    jets.push({
      x: cx, y: cy, radius, interval, amount,
      timer: interval * (0.3 + Math.random() * 0.7)
    });
  }
}

function spawnJetPulse(jet) {
  jetPulses.push({
    x: jet.x + 0.5, y: jet.y + 0.5,
    radius: jet.radius, amount: jet.amount,
    age: 0, maxAge: JET_PULSE_DURATION
  });
}

function spewJet(jet) {
  if (!mineralMap || !map) return false;
  const candidates = [];
  for (let dy = -jet.radius; dy <= jet.radius; dy++) {
    for (let dx = -jet.radius; dx <= jet.radius; dx++) {
      if (dx === 0 && dy === 0) continue;
      const dist = Math.hypot(dx, dy);
      if (dist > jet.radius) continue;
      const nx = jet.x + dx, ny = jet.y + dy;
      if (!inBounds(nx, ny)) continue;
      const t = map[ny][nx];
      if (t !== TILE_DIRT && t !== TILE_STUMP) continue;
      const cur = mineralMap[ny][nx] || 0;
      if (cur >= JET_MINERAL_CAP) continue;
      const weight = (1 - dist / (jet.radius + 1)) * (1 - cur / JET_MINERAL_CAP);
      candidates.push({ x: nx, y: ny, weight, cur });
    }
  }
  if (!candidates.length) {
    spawnJetPulse(jet);
    return true;
  }

  let remaining = jet.amount;
  let changed = false;
  while (remaining > 0 && candidates.length) {
    let total = 0;
    for (const c of candidates) total += Math.max(0.05, c.weight);
    let r = Math.random() * total;
    let pick = 0;
    for (let i = 0; i < candidates.length; i++) {
      r -= Math.max(0.05, candidates[i].weight);
      if (r <= 0) { pick = i; break; }
    }
    const c = candidates[pick];
    mineralMap[c.y][c.x] = Math.min(JET_MINERAL_CAP, c.cur + 1);
    c.cur = mineralMap[c.y][c.x];
    c.weight = (1 - Math.hypot(c.x - jet.x, c.y - jet.y) / (jet.radius + 1)) * (1 - c.cur / JET_MINERAL_CAP);
    if (c.cur >= JET_MINERAL_CAP) candidates.splice(pick, 1);
    remaining -= 1;
    changed = true;
  }
  if (changed) spawnJetPulse(jet);
  return changed;
}

function updateJetPulses(dt) {
  if (!jetPulses.length) return false;
  for (const p of jetPulses) p.age += dt;
  jetPulses = jetPulses.filter(p => p.age < p.maxAge);
  return true;
}

function updateJets(dt) {
  let changed = false;
  if (jets && jets.length) {
    for (const jet of jets) {
      jet.timer -= dt;
      if (jet.timer <= 0) {
        if (spewJet(jet)) changed = true;
        jet.timer = jet.interval;
      }
    }
  }
  if (updateJetPulses(dt)) changed = true;
  return changed;
}

function clearAreaForBase(m, dens, minerals, ax, ay) {
  for (let dy = -1; dy < BASE_SEGMENT_SIZE + 1; dy++) {
    for (let dx = -1; dx < BASE_SEGMENT_SIZE + 1; dx++) {
      const x = ax + dx, y = ay + dy;
      if (!inBounds(x, y)) continue;
      if (m[y][x] === TILE_TREE || m[y][x] === TILE_STUMP) {
        m[y][x] = TILE_DIRT;
        dens[y][x] = 0;
      }
      if (minerals[y][x] > 0) minerals[y][x] = 0;
    }
  }
}

function findStarterBaseSpot(m) {
  const cx0 = Math.floor(MAP_W / 2) - 1;
  const cy0 = Math.floor(MAP_H / 2) - 1;
  for (let r = 0; r < 40; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const ax = cx0 + dx, ay = cy0 + dy;
        if (ax < 4 || ay < 4 || ax + BASE_SEGMENT_SIZE >= MAP_W - 4 || ay + BASE_SEGMENT_SIZE >= MAP_H - 4) continue;
        let ok = true;
        for (let sy = 0; sy < BASE_SEGMENT_SIZE && ok; sy++)
          for (let sx = 0; sx < BASE_SEGMENT_SIZE && ok; sx++) {
            const t = m[ay + sy][ax + sx];
            if (t === TILE_ROCK || t === TILE_WATER || t === TILE_JET) ok = false;
          }
        if (ok) return { x: ax, y: ay };
      }
    }
  }
  return { x: cx0, y: cy0 };
}

function placeStartingBase(m, dens, minerals) {
  const spot = findStarterBaseSpot(m);
  clearAreaForBase(m, dens, minerals, spot.x, spot.y);
  for (let dy = 0; dy < BASE_SEGMENT_SIZE; dy++)
    for (let dx = 0; dx < BASE_SEGMENT_SIZE; dx++)
      m[spot.y + dy][spot.x + dx] = TILE_BASE;
  playerBase = makePlayerBase(spot.x, spot.y);
  if (typeof initTilesHpForFootprint === 'function') {
    initTilesHpForFootprint(spot.x, spot.y, BASE_FOOTPRINT);
  }
  return spot;
}

function canPlaceHutOn(m, ax, ay) {
  for (const { dx, dy } of HUT_FOOTPRINT) {
    const x = ax + dx, y = ay + dy;
    if (!inBounds(x, y)) return false;
    const t = m[y][x];
    if (t !== TILE_DIRT && t !== TILE_STUMP && t !== TILE_TREE) return false;
  }
  return true;
}

function placeEnemyHut(m, dens, minerals, baseSpot) {
  huts = [];
  const minDist = 28;
  let placed = null;
  for (let attempt = 0; attempt < 120; attempt++) {
    const ax = rand(6, MAP_W - HUT_SIZE - 6);
    const ay = rand(6, MAP_H - HUT_SIZE - 6);
    if (!canPlaceHutOn(m, ax, ay)) continue;
    const hx = ax + HUT_SIZE / 2, hy = ay + HUT_SIZE / 2;
    const bx = baseSpot.x + BASE_SEGMENT_SIZE / 2, by = baseSpot.y + BASE_SEGMENT_SIZE / 2;
    if (Math.hypot(hx - bx, hy - by) < minDist) continue;
    for (const { dx, dy } of HUT_FOOTPRINT) {
      const x = ax + dx, y = ay + dy;
      m[y][x] = TILE_HUT;
      dens[y][x] = 0;
      minerals[y][x] = 0;
    }
    for (let dy = -1; dy < HUT_SIZE + 1; dy++)
      for (let dx = -1; dx < HUT_SIZE + 1; dx++) {
        const x = ax + dx, y = ay + dy;
        if (!inBounds(x, y)) continue;
        if (m[y][x] === TILE_TREE || m[y][x] === TILE_STUMP) {
          m[y][x] = TILE_DIRT;
          dens[y][x] = 0;
        }
      }
    if (typeof initTilesHpForFootprint === 'function') {
      initTilesHpForFootprint(ax, ay, HUT_FOOTPRINT);
    }
    const interval = rand(HUT_SPAWN_INTERVAL_MIN, HUT_SPAWN_INTERVAL_MAX);
    placed = {
      id: nextHutId++,
      x: ax, y: ay,
      spawnTimer: interval * 0.4
    };
    huts.push(placed);
    break;
  }
  return placed;
}

function spawnWorkerBesideBase(spot) {
  const dirs = [[-1,1],[3,1],[1,-1],[1,3],[-1,0],[3,0],[0,-1],[0,3],[1,1]];
  for (const [dx, dy] of dirs) {
    const x = spot.x + dx, y = spot.y + dy;
    if (isWalkableTile(x, y)) return makeUnit(x + 0.5, y + 0.5, 'worker');
  }
  for (let r = 1; r <= 6; r++)
    for (let dy = -r; dy <= r + BASE_SEGMENT_SIZE; dy++)
      for (let dx = -r; dx <= r + BASE_SEGMENT_SIZE; dx++) {
        const x = spot.x + dx, y = spot.y + dy;
        if (isWalkableTile(x, y)) return makeUnit(x + 0.5, y + 0.5, 'worker');
      }
  return makeUnit(spot.x + 1.5, spot.y - 0.5, 'worker');
}

function generateMap() {
  const m = createEmptyMap();
  const minerals = new Array(MAP_H);
  const dens = new Array(MAP_H);
  for (let y = 0; y < MAP_H; y++) {
    minerals[y] = new Array(MAP_W).fill(0);
    dens[y] = new Array(MAP_W).fill(0);
  }
  if (typeof createBuildingHpMap === 'function') buildingHpMap = createBuildingHpMap();
  generateRockVeins(m); generateWater(m); generateTrees(m, dens); generateJets(m, minerals);
  const baseSpot = placeStartingBase(m, dens, minerals);
  placeEnemyHut(m, dens, minerals, baseSpot);
  mineralMap = minerals;
  treeDensity = dens;
  map = m;
  armories = [];
  recomputeRockElevation();
  if (typeof createFogArrays === 'function') createFogArrays(); // new world, nothing seen
  return { map: m, baseSpot };
}

function newMap() {
  const { baseSpot } = generateMap();
  units = [spawnWorkerBesideBase(baseSpot)];
  selectedUnitId = null; selectedBase = null; selectedArmory = null; selectedHut = null; actionMode = null;
  selectedUnitIds = []; fullSelectionIds = [];
  woodInBase = 0; vireliumInBase = 0;
  claimedTrees.clear(); claimedMinerals.clear();
  jetPulses = [];
  armories = [];
  deathMarks = [];
  resetTraining();
  updateVisibility();
  updateUI(); draw();
}
