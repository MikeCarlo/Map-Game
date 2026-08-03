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

function tutorialFreeTileNearBase(dx, dy, r = 10) {
  if (!playerBase || !playerBase.segments.length) return null;
  const seg = playerBase.segments[0];
  return findFreeStandTile(seg.x + dx, seg.y + dy, null, r);
}

function tutorialSpawn(kind, dx, dy) {
  const spot = tutorialFreeTileNearBase(dx, dy);
  if (!spot) return null;
  const u = makeUnit(spot.x + 0.5, spot.y + 0.5, kind);
  units.push(u);
  return u;
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
  let planted = 0;
  for (let r = 0; r <= 5 && planted < count; r++) {
    for (let ddy = -r; ddy <= r && planted < count; ddy++) {
      for (let ddx = -r; ddx <= r && planted < count; ddx++) {
        const x = spot.x + ddx, y = spot.y + ddy;
        if (!inBounds(x, y) || map[y][x] !== TILE_DIRT) continue;
        if (tutorialTileHasUnit(x, y)) continue; // never wall a unit in
        map[y][x] = TILE_TREE;
        treeDensity[y][x] = 3;
        planted++;
      }
    }
  }
  return planted ? spot : null;
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
    setup: () => { woodInBase = 20; vireliumInBase = 10; },
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
    setup: () => {
      woodInBase = 30; vireliumInBase = 20;
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
    setup: () => {
      woodInBase = 30; vireliumInBase = 20;
      tutorialGrantArmory();
      tutorialSpawn('soldier', 3, 2);
      tutorialSpawn('soldier', -3, 2);
      tutorialSpawn('enemy', 9, 6);
      tutorialSpawn('enemy', -8, 7);
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
        text: 'Wipe out both enemies.',
        hint: 'A killed unit leaves a fading stain — and drops any cargo it carried.',
        done: () => countEnemies() === 0
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
  tutorialStepDone = level ? level.steps.map(() => false) : [];
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

function positionTutorialPanel(el) {
  const bottom = typeof uiPanelTop === 'function' ? uiPanelTop() : window.innerHeight - 120;
  el.style.bottom = Math.max(8, window.innerHeight - bottom + 8) + 'px';
}

function renderTutorialPanel() {
  const el = document.getElementById('tutorial');
  if (!el) return;
  if (!tutorialLevel) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  el.classList.toggle('done', tutorialDone);
  positionTutorialPanel(el);

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
