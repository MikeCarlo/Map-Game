// tutorial.js — guided levels that introduce one mechanic at a time
//
// A level is a small map plus an ordered list of steps. Each step has a done()
// predicate checked once a frame against real game state — there is no scripted
// fake path, the player really does the thing. Steps latch: once satisfied they
// stay satisfied, so a step cannot un-complete if the player undoes something.
//
// setup() runs after the world is generated and seeds whatever the level needs
// (resources, an armory, soldiers, attackers), so level 5 does not require
// playing levels 1–4 first.

let tutorialLevel = null;      // the active level definition
let tutorialStep = 0;
let tutorialDone = false;
let tutorialMoveCount = 0;     // distinct move orders seen, for the sticky-move step
let tutorialGoals = new Map(); // unit id -> last goal seen, to spot new orders
let tutorialStepDone = [];

const TUTORIAL_STORAGE_KEY = 'mapgame.tutorial.completed';

function loadTutorialProgress() {
  try {
    const raw = localStorage.getItem(TUTORIAL_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch (e) { return new Set(); }
}
function saveTutorialProgress(set) {
  try { localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify([...set])); } catch (e) { /* private mode */ }
}
let tutorialCompleted = loadTutorialProgress();

// ---- helpers available to level setup() ----

// Ground a unit standing by the base can actually walk to. Seeding an enemy
// across a river leaves the player unable to finish "wipe out both attackers".
let tutorialReach = null;

function tutorialComputeReach() {
  tutorialReach = null;
  if (!playerBase || !playerBase.segments.length) return;
  const key = (x, y) => y * MAP_W + x;
  const seen = new Set();
  const queue = [];
  // Seed from every walkable tile touching the base. A single start tile can
  // land in a one-tile pocket, which made the whole map look unreachable.
  for (const seg of playerBase.segments) {
    for (let y = seg.y - 1; y <= seg.y + BASE_SEGMENT_SIZE; y++) {
      for (let x = seg.x - 1; x <= seg.x + BASE_SEGMENT_SIZE; x++) {
        if (!isWalkableTile(x, y) || seen.has(key(x, y))) continue;
        seen.add(key(x, y));
        queue.push({ x, y });
      }
    }
  }
  for (const u of units) { // and from wherever the starting units stand
    const x = Math.floor(u.x), y = Math.floor(u.y);
    if (!isWalkableTile(x, y) || seen.has(key(x, y))) continue;
    seen.add(key(x, y));
    queue.push({ x, y });
  }
  if (!queue.length) return;
  while (queue.length) {
    const c = queue.shift();
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = c.x + dx, ny = c.y + dy, k = key(nx, ny);
      if (seen.has(k) || !isWalkableTile(nx, ny)) continue;
      seen.add(k);
      queue.push({ x: nx, y: ny });
    }
  }
  tutorialReach = seen;
}

function tutorialIsReachable(x, y) {
  return !tutorialReach || tutorialReach.has(y * MAP_W + x);
}

function tutorialFreeTileNearBase(dx, dy, r = 12) {
  if (!playerBase || !playerBase.segments.length) return null;
  const seg = playerBase.segments[0];
  const cx = seg.x + dx, cy = seg.y + dy;
  for (let rr = 0; rr <= r; rr++) {
    for (let ddy = -rr; ddy <= rr; ddy++) {
      for (let ddx = -rr; ddx <= rr; ddx++) {
        if (rr > 0 && Math.abs(ddx) !== rr && Math.abs(ddy) !== rr) continue;
        const x = cx + ddx, y = cy + ddy;
        if (!isWalkableTile(x, y) || isTileBlockedForStand(x, y, null)) continue;
        if (!tutorialIsReachable(x, y)) continue;
        return { x, y };
      }
    }
  }
  return findFreeStandTile(cx, cy, null, r); // better placed than not placed
}

let tutorialTags = {};

/** `tag` lets a step track the exact units it spawned, not just a global count. */
function tutorialSpawn(kind, dx, dy, tag) {
  const spot = tutorialFreeTileNearBase(dx, dy);
  if (!spot) return null;
  const u = makeUnit(spot.x + 0.5, spot.y + 0.5, kind);
  units.push(u);
  if (tag) (tutorialTags[tag] = tutorialTags[tag] || []).push(u.id);
  return u;
}

function tutorialTaggedAllGone(tag) {
  const ids = tutorialTags[tag] || [];
  return ids.length > 0 && ids.every(id => !units.some(u => u.id === id));
}

/** Drop a finished armory beside the base so soldier levels can start there. */
function tutorialGrantArmory() {
  if (!playerBase || !playerBase.segments.length) return null;
  const seg = playerBase.segments[0];
  for (let r = 2; r <= 8; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const ax = seg.x + dx, ay = seg.y + dy;
        if (canPlaceArmory(ax, ay) && footprintIsFree(ax, ay, ARMORY_FOOTPRINT, null)) {
          placeArmoryTiles(ax, ay);
          registerArmory(ax, ay);
          return { x: ax, y: ay };
        }
      }
    }
  }
  return null;
}

/**
 * Place the hut deliberately rather than letting map generation drop it
 * anywhere: the level asks the player to destroy it, so it has to be walkable
 * to and a sane distance away.
 */
/** How many tiles around a 2×2 footprint a unit could attack it from. */
function tutorialHutApproachCount(ax, ay) {
  let n = 0;
  for (let dy = -1; dy <= HUT_SIZE; dy++) {
    for (let dx = -1; dx <= HUT_SIZE; dx++) {
      if (dx >= 0 && dx < HUT_SIZE && dy >= 0 && dy < HUT_SIZE) continue; // inside
      const x = ax + dx, y = ay + dy;
      if (isWalkableTile(x, y) && tutorialIsReachable(x, y)) n++;
    }
  }
  return n;
}

function tutorialPlaceHut(minDist = 12, maxDist = 26, minApproach = 5) {
  if (!playerBase || !playerBase.segments.length) return null;
  const seg = playerBase.segments[0];
  const want = (minDist + maxDist) / 2;
  let best = null, bestScore = Infinity;
  // Scan the whole map by distance from the base rather than around one guessed
  // point — on a small map that point is often ocean, and the search then
  // dumps the hut next door. Candidates need several reachable approach tiles,
  // or findStandNearHut can pick a side the soldiers cannot walk to.
  for (let y = 0; y < MAP_H - HUT_SIZE; y++) {
    for (let x = 0; x < MAP_W - HUT_SIZE; x++) {
      const d = Math.hypot(x - seg.x, y - seg.y);
      if (d < minDist || d > maxDist) continue;
      if (!canPlaceHutOn(map, x, y)) continue;
      if (tutorialHutApproachCount(x, y) < minApproach) continue;
      const score = Math.abs(d - want);
      if (score < bestScore) { bestScore = score; best = { x, y }; }
    }
  }
  if (!best) {
    // relax, in order of what matters least to the lesson
    if (minApproach > 3) return tutorialPlaceHut(minDist, maxDist, 3);
    if (minDist > 6) return tutorialPlaceHut(6, Math.max(maxDist, 44), 3);
    if (minApproach > 1) return tutorialPlaceHut(6, Math.max(maxDist, 44), 1);
    return null;
  }
  for (const { dx, dy } of HUT_FOOTPRINT) {
    const x = best.x + dx, y = best.y + dy;
    map[y][x] = TILE_HUT;
    if (treeDensity) treeDensity[y][x] = 0;
    if (mineralMap) mineralMap[y][x] = 0;
  }
  initTilesHpForFootprint(best.x, best.y, HUT_FOOTPRINT);
  const hut = { id: nextHutId++, x: best.x, y: best.y, spawnTimer: HUT_SPAWN_INTERVAL_MIN };
  huts.push(hut);
  return hut;
}

/** Reveal the whole map — used by levels about finding something specific. */
function tutorialRevealAll() {
  if (!exploredMap) return;
  exploredMap.fill(1);
}

function tutorialTileHasUnit(x, y) {
  return units.some(u => Math.floor(u.x) === x && Math.floor(u.y) === y);
}

/**
 * Map generation is random, so a level that says "go cut a tree" cannot assume
 * there is one in sight. Plant what the level needs within the base's vision.
 */
function tutorialPlantGrove(dx, dy, count = 16) {
  const spot = tutorialFreeTileNearBase(dx, dy, 12);
  if (!spot || !treeDensity) return null;
  const put = [];
  for (let r = 0; r <= 5 && put.length < count; r++) {
    for (let ddy = -r; ddy <= r && put.length < count; ddy++) {
      for (let ddx = -r; ddx <= r && put.length < count; ddx++) {
        const x = spot.x + ddx, y = spot.y + ddy;
        if (!inBounds(x, y) || map[y][x] !== TILE_DIRT) continue;
        if (tutorialTileHasUnit(x, y)) continue;       // never wall a unit in
        if ((x + y) % 2 !== 0) continue;               // checkerboard: every tree stays reachable
        map[y][x] = TILE_TREE;
        treeDensity[y][x] = 3;
        put.push({ x, y });
      }
    }
  }
  // belt and braces: a tree nobody can stand beside is a tree nobody can cut
  for (const t of put) {
    if (treeHasStandTile(t.x, t.y)) continue;
    map[t.y][t.x] = TILE_DIRT;
    treeDensity[t.y][t.x] = 0;
  }
  return put.length ? spot : null;
}

/** Flatten ground near the base so a build lesson always has somewhere to put it. */
function tutorialClearArea(dx, dy, r = 4) {
  if (!playerBase || !playerBase.segments.length) return null;
  const seg = playerBase.segments[0];
  const cx = seg.x + dx, cy = seg.y + dy;
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (!inBounds(x, y)) continue;
      const t = map[y][x];
      if (t === TILE_BASE || t === TILE_ARMORY || t === TILE_HUT) continue;
      map[y][x] = TILE_DIRT;
      if (treeDensity) treeDensity[y][x] = 0;
      if (mineralMap) mineralMap[y][x] = 0;
    }
  }
  recomputeRockElevation();
  return { x: cx, y: cy };
}

function tutorialSeedVirelium(dx, dy, count = 8) {
  const spot = tutorialFreeTileNearBase(dx, dy, 12);
  if (!spot || !mineralMap) return null;
  let seeded = 0;
  for (let r = 0; r <= 4 && seeded < count; r++) {
    for (let ddy = -r; ddy <= r && seeded < count; ddy++) {
      for (let ddx = -r; ddx <= r && seeded < count; ddx++) {
        const x = spot.x + ddx, y = spot.y + ddy;
        if (!inBounds(x, y)) continue;
        if (map[y][x] !== TILE_DIRT && map[y][x] !== TILE_STUMP) continue;
        mineralMap[y][x] = 5;
        seeded++;
      }
    }
  }
  return seeded ? spot : null;
}

// ---- the levels ----

const TUTORIAL_LEVELS = [
  {
    id: 'move',
    title: 'Getting around',
    goal: 'Select a unit and move it',
    size: 'small',
    // Open country: rock and water give the pathfinder something to walk around,
    // but nothing to harvest or fight yet.
    map: { hut: false, trees: false, jets: false },
    steps: [
      {
        text: 'Tap the red dot near your purple base to select your worker.',
        hint: 'A selected unit gets a pulsing yellow ring.',
        done: () => getSelectedUnits().some(u => u.unitType === 'worker')
      },
      {
        text: 'Tap Move in the bottom bar, then tap open ground to walk there.',
        hint: 'Drag anywhere to pan the camera; pinch or scroll to zoom.',
        done: () => tutorialMoveCount >= 1
      },
      {
        text: 'Move stays on — tap two more places without pressing Move again.',
        hint: 'Every other action turns itself off after one use. Move does not.',
        done: () => tutorialMoveCount >= 3
      },
      {
        text: 'Tap ✕ Move to leave move mode.',
        hint: 'The button reads ✕ Move while the mode is armed.',
        done: () => tutorialMoveCount >= 3 && actionMode !== 'moveTarget'
      }
    ]
  },
  {
    id: 'wood',
    title: 'Cutting wood',
    goal: 'Harvest wood and bank it',
    size: 'small',
    map: { hut: false, jets: false },   // wood only — no Virelium to distract
    setup: () => { tutorialPlantGrove(6, -3); },
    steps: [
      {
        text: 'Select your worker, tap Cut, then tap a green forest tile.',
        hint: 'Tapping near a forest snaps to the closest free tree.',
        done: () => units.some(u => u.harvesting)
      },
      {
        text: 'Watch: the worker chops one wood, then walks it back to the base.',
        hint: 'A worker carries one resource per trip and slows down while loaded.',
        done: () => woodInBase >= 1
      },
      {
        text: 'Leave it running until you have banked 3 wood.',
        hint: 'After depositing, it goes back to the same tree on its own.',
        done: () => woodInBase >= 3
      }
    ]
  },
  {
    id: 'virelium',
    title: 'Mining Virelium',
    goal: 'Bank a Virelium crystal',
    size: 'small',
    map: { hut: false },
    setup: () => { tutorialSeedVirelium(-7, 4); },
    steps: [
      {
        text: 'The cyan tiles near your base are Virelium — the richer the colour, the more it holds.',
        hint: 'The minimap top-right shows deposits you have found; tap it to jump there.'
      },
      {
        text: 'Select a worker, tap Mine, then tap the cyan deposit.',
        hint: 'Virelium is heavier than wood, so the trip home is slower.',
        done: () => units.some(u => u.mining) || vireliumInBase >= 1
      },
      {
        text: 'Bank one Virelium at the base.',
        hint: 'Deposits hold 1–10 units; one trip takes one of them.',
        done: () => vireliumInBase >= 1
      }
    ]
  },
  {
    id: 'grow',
    title: 'Growing your base',
    goal: 'Train a worker and raise an armory',
    size: 'small',
    map: { hut: false, jets: false },
    setup: () => {
      woodInBase = 20; vireliumInBase = 10;
      tutorialClearArea(6, 0, 5); // guaranteed room for the armory
    },
    steps: [
      {
        text: 'Tap any purple base tile, then Train to queue a second worker.',
        hint: 'Training takes a few seconds — a dial shows progress on the building.',
        done: () => countWorkers() >= 2
      },
      {
        text: 'Select a worker, tap Build, then Armory, then tap clear ground.',
        hint: 'The site needs a free 2×2 of dirt. The worker walks there and builds.',
        done: () => armories.length >= 1
      }
    ]
  },
  {
    id: 'soldiers',
    title: 'Soldiers and defence',
    goal: 'Train a soldier and post it on guard',
    size: 'small',
    map: { hut: false, jets: false },   // learn Defend before anything attacks
    setup: () => {
      woodInBase = 30; vireliumInBase = 20;
      tutorialClearArea(5, 0, 4);
      tutorialGrantArmory();
    },
    steps: [
      {
        text: 'Tap the dark red armory, then Train Soldier.',
        hint: 'Each armory supports up to 5 soldiers.',
        done: () => countSoldiers() >= 1
      },
      {
        text: 'Select the soldier, tap Defend, then tap the ground you want held.',
        hint: 'Defend is how you protect harvesters without babysitting them.',
        done: () => units.some(u => u.defending)
      },
      {
        text: 'That soldier now guards a 7-tile radius and walks back to its post after each fight.',
        hint: 'The dashed ring shows the ground it covers. Move or Attack releases the post.'
      }
    ]
  },
  {
    id: 'attack',
    title: 'Enemies and huts',
    goal: 'Clear the attackers and destroy the hut',
    size: 'small',
    // the one level with an enemy hut, and it is placed by hand so the last
    // step is always achievable
    map: { hut: false, jets: false },
    setup: () => {
      woodInBase = 30; vireliumInBase = 20;
      tutorialClearArea(5, 0, 4);
      tutorialGrantArmory();
      tutorialPlaceHut();
      tutorialSpawn('soldier', 3, 2);
      tutorialSpawn('soldier', -3, 2);
      tutorialSpawn('enemy', 9, 6, 'foe');
      tutorialSpawn('enemy', -8, 7, 'foe');
      tutorialRevealAll();
    },
    steps: [
      {
        text: 'Two enemies (green) are closing in. Select both soldiers — drag a box, or double-tap one.',
        hint: 'Double-tap empty ground first to lock the camera for box select.',
        done: () => getSelectedUnits().filter(u => u.unitType === 'soldier').length >= 2
      },
      {
        text: 'Tap Attack, then tap an enemy.',
        hint: 'Workers fight back if cornered, but they lose. Send soldiers.',
        done: () => units.some(u => u.unitType === 'soldier' && u.attacking)
      },
      {
        // the hut keeps spawning, so this tracks the two that started the level
        text: 'Wipe out both attackers.',
        hint: 'The hut keeps sending more, so this is a holding action until it is gone.',
        done: () => tutorialTaggedAllGone('foe')
      },
      {
        text: 'Now find the enemy hut on the minimap and destroy it — Attack, then tap the hut.',
        hint: 'The hut keeps spawning enemies until it is rubble.',
        done: () => huts.length === 0
      }
    ]
  }
];

function tutorialLevelById(id) {
  return TUTORIAL_LEVELS.find(l => l.id === id) || null;
}

// ---- running a level ----

function startTutorialLevel(level) {
  tutorialLevel = level || null;
  tutorialStep = 0;
  tutorialDone = false;
  tutorialMoveCount = 0;
  tutorialGoals = new Map();
  tutorialTags = {};
  tutorialStepDone = level ? level.steps.map(() => false) : [];
  if (level) tutorialComputeReach();
  if (level && typeof level.setup === 'function') level.setup();
  renderTutorialPanel();
}

function stopTutorial() {
  tutorialLevel = null;
  tutorialStepDone = [];
  renderTutorialPanel();
}

function isTutorialActive() { return !!tutorialLevel; }

/** Count new move orders so the sticky-move step can be taught honestly. */
function trackTutorialMoves() {
  for (const u of units) {
    if (u.unitType === 'enemy') continue;
    const key = u.goalX == null ? null : `${Math.floor(u.goalX)},${Math.floor(u.goalY)}`;
    const prev = tutorialGoals.get(u.id) ?? null;
    if (key && key !== prev) tutorialMoveCount++;
    tutorialGoals.set(u.id, key);
  }
}

/**
 * Once a frame. Only the step the player is actually on is checked — steps are
 * a sequence, and a later objective happening to be true early must not skip
 * the teaching before it. A step with no done() is informational and waits for
 * the Continue button.
 */
function updateTutorial() {
  if (!tutorialLevel) return false;
  trackTutorialMoves();
  let changed = false;
  while (tutorialStep < tutorialLevel.steps.length) {
    const s = tutorialLevel.steps[tutorialStep];
    if (typeof s.done !== 'function') break; // informational: needs Continue
    let ok = false;
    try { ok = !!s.done(); } catch (e) { ok = false; }
    if (!ok) break;
    tutorialStepDone[tutorialStep] = true;
    tutorialStep++;
    changed = true;
  }
  if (tutorialStep >= tutorialLevel.steps.length && !tutorialDone) {
    tutorialDone = true;
    tutorialCompleted.add(tutorialLevel.id);
    saveTutorialProgress(tutorialCompleted);
    changed = true;
  }
  if (changed) renderTutorialPanel();
  return changed;
}

function nextTutorialLevel() {
  if (!tutorialLevel) return null;
  const i = TUTORIAL_LEVELS.findIndex(l => l.id === tutorialLevel.id);
  return i >= 0 && i + 1 < TUTORIAL_LEVELS.length ? TUTORIAL_LEVELS[i + 1] : null;
}

// ---- panel ----

/**
 * Sit directly above the action bar. The bar changes height with the selection
 * (a worker shows a three-row grid, the map bar is one row), so this has to run
 * whenever that box changes, not just when the step does — otherwise the panel
 * is left sitting on top of the buttons.
 */
function positionTutorialPanel(el) {
  const bottom = typeof uiPanelTop === 'function' ? uiPanelTop() : window.innerHeight - 120;
  const px = Math.max(8, window.innerHeight - bottom + 8) + 'px';
  if (el.style.bottom !== px) el.style.bottom = px;
}

let tutorialUiObserver = null;
function watchUiHeightForTutorial() {
  if (tutorialUiObserver || typeof ResizeObserver === 'undefined') return;
  const ui = document.getElementById('ui');
  if (!ui) return;
  tutorialUiObserver = new ResizeObserver(() => {
    const el = document.getElementById('tutorial');
    if (el && el.style.display !== 'none') positionTutorialPanel(el);
  });
  tutorialUiObserver.observe(ui);
}

function renderTutorialPanel() {
  const el = document.getElementById('tutorial');
  if (!el) return;
  if (!tutorialLevel) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  el.classList.toggle('done', tutorialDone);
  positionTutorialPanel(el);
  watchUiHeightForTutorial();

  const total = tutorialLevel.steps.length;
  const num = TUTORIAL_LEVELS.findIndex(l => l.id === tutorialLevel.id) + 1;
  if (tutorialDone) {
    el.innerHTML =
      `<div class="tut-head"><span>Level ${num} complete</span><span>${total}/${total}</span></div>` +
      `<div class="tut-step">${tutorialLevel.title} — done. ${nextTutorialLevel() ? 'Ready for the next one?' : 'That is the whole tutorial.'}</div>` +
      `<div class="tut-buttons">` +
        (nextTutorialLevel() ? `<button type="button" id="tutNext">Next level</button>` : '') +
        `<button type="button" id="tutMenu">Back to menu</button>` +
      `</div>`;
  } else {
    const s = tutorialLevel.steps[tutorialStep];
    const info = typeof s.done !== 'function';
    el.innerHTML =
      `<div class="tut-head"><span>Level ${num} · ${tutorialLevel.title}</span><span>${tutorialStep + 1}/${total}</span></div>` +
      `<div class="tut-step">${s.text}</div>` +
      (s.hint ? `<div class="tut-hint">${s.hint}</div>` : '') +
      `<div class="tut-buttons">` +
        `<button type="button" id="tutSkip">${info ? 'Got it' : 'Skip step'}</button>` +
        `<button type="button" id="tutMenu">Back to menu</button>` +
      `</div>`;
  }
  const skip = document.getElementById('tutSkip');
  if (skip) skip.addEventListener('click', () => {
    tutorialStepDone[tutorialStep] = true;
    tutorialStep++;
    updateTutorial();
    renderTutorialPanel();
  });
  const next = document.getElementById('tutNext');
  if (next) next.addEventListener('click', () => {
    const lvl = nextTutorialLevel();
    if (lvl) startGame(lvl.size, lvl);
  });
  const menu = document.getElementById('tutMenu');
  if (menu) menu.addEventListener('click', () => {
    stopTutorial();
    buildLandingLevelButtons(); // show ticks for anything just finished
    showLanding();
  });
}

function buildLandingLevelButtons() {
  const wrap = document.getElementById('landingLevels');
  if (!wrap) return;
  wrap.innerHTML = '';
  TUTORIAL_LEVELS.forEach((lvl, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'landing-level' + (tutorialCompleted.has(lvl.id) ? ' done' : '');
    b.innerHTML =
      `<span class="lvl-num">${tutorialCompleted.has(lvl.id) ? '✓' : i + 1}</span>` +
      `<span class="lvl-text"><span class="lvl-title">${lvl.title}</span>` +
      `<span class="lvl-goal">${lvl.goal}</span></span>`;
    b.addEventListener('click', () => startGame(lvl.size, lvl));
    wrap.appendChild(b);
  });
}
