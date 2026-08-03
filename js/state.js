// state.js — runtime state, units, claims
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let map = null;
let mineralMap = null;
let treeDensity = null;
let rockElev = null;
let jets = [];
let jetPulses = [];
let camX = 0, camY = 0, zoom = 1, dpr = 1;
let isDragging = false, lastX = 0, lastY = 0, lastPinchDist = 0;
let pointerDownPos = null, didPan = false;

let units = [];
let nextUnitId = 1;
let selectedUnitId = null;
let selectedUnitIds = [];
let fullSelectionIds = [];
let selectionFilter = 'all';
let selectedBase = null;
let selectedArmory = null;
let selectedHut = null;
let actionMode = null;
let woodInBase = 0;
let vireliumInBase = 0;
let claimedTrees = new Map();
let claimedMinerals = new Map();

let playerBase = null;
let armories = [];
/** Queued training: { id, key, unitType, x, y, ox, oy, size, duration, remaining, blocked } */
let trainingJobs = [];
let nextTrainingJobId = 1;
/** Base expansion raising itself: { x, y, duration, remaining } */
let baseUpgrade = null;
let huts = [];
let nextHutId = 1;
/** Fading ground stains: { x, y, age, maxAge, unitType } */
let deathMarks = [];

let cameraPanEnabled = true;

let boxSelectActive = false;
let boxSelectStart = null;
let boxSelectCurrent = null;
let longPressTimer = null;
let longPressFired = false;

let lastTapTime = 0;
let lastTapX = 0, lastTapY = 0;
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_DIST = 28;
const LONG_PRESS_MS = 200;
const LONG_PRESS_MOVE_TOL = 14;
const SELECT_SIMILAR_RANGE = 12;

function makePlayerBase(originX, originY) {
  return {
    level: 1,
    maxWorkers: WORKERS_PER_BASE_LEVEL,
    segments: [{ x: originX, y: originY }]
  };
}

function countWorkers() {
  return units.filter(u => u.unitType === 'worker').length;
}
function countSoldiers() {
  return units.filter(u => u.unitType === 'soldier').length;
}
function countEnemies() {
  return units.filter(u => u.unitType === 'enemy').length;
}
function maxSoldiers() {
  return armories.length * SOLDIERS_PER_ARMORY;
}
function findArmoryAt(tx, ty) {
  for (const a of armories) {
    if (tx >= a.x && tx < a.x + ARMORY_SIZE && ty >= a.y && ty < a.y + ARMORY_SIZE) return a;
  }
  return null;
}
function findHutAt(tx, ty) {
  for (const h of huts) {
    if (tx >= h.x && tx < h.x + HUT_SIZE && ty >= h.y && ty < h.y + HUT_SIZE) return h;
  }
  return null;
}

function tileKey(x, y) { return x + ',' + y; }
function claimTree(x, y, unitId) { claimedTrees.set(tileKey(x, y), unitId); }
function releaseTree(x, y, unitId) {
  const k = tileKey(x, y);
  if (claimedTrees.get(k) === unitId) claimedTrees.delete(k);
}
function isTreeClaimedByOther(x, y, unitId) {
  const owner = claimedTrees.get(tileKey(x, y));
  return owner !== undefined && owner !== unitId;
}
function claimMineral(x, y, unitId) { claimedMinerals.set(tileKey(x, y), unitId); }
function releaseMineral(x, y, unitId) {
  const k = tileKey(x, y);
  if (claimedMinerals.get(k) === unitId) claimedMinerals.delete(k);
}
function isMineralClaimedByOther(x, y, unitId) {
  const owner = claimedMinerals.get(tileKey(x, y));
  return owner !== undefined && owner !== unitId;
}
function releaseAllClaimsForUnit(unitId) {
  for (const [k, id] of [...claimedTrees]) if (id === unitId) claimedTrees.delete(k);
  for (const [k, id] of [...claimedMinerals]) if (id === unitId) claimedMinerals.delete(k);
}

function makeUnit(x, y, unitType = 'worker') {
  const u = {
    id: nextUnitId++, x, y,
    unitType,
    path: [], pathIndex: 0, goalX: null, goalY: null,
    harvesting: false, harvestTimer: 0, harvestTX: null, harvestTY: null,
    preferTreeX: null, preferTreeY: null,
    carryingWood: false, returningToBase: false,
    mining: false, mineTimer: 0, mineTX: null, mineTY: null,
    carryingVirelium: false, returningMineral: false,
    building: false, buildKind: null, buildTX: null, buildTY: null,
    buildTimer: 0, buildDuration: 0,
    repairing: false, repairTimer: 0, repairTX: null, repairTY: null,
    tunneling: false,
    tunnelStart: null,
    tunnelEnd: null,
    tunnelCarvePath: null,
    carveTimer: 0,
    carveTileX: null,
    carveTileY: null,
    hp: null,
    maxHp: null,
    attacking: false,
    attackTargetId: null,
    attackHutId: null,
    attackTimer: 0,
    attackRepathTimer: 0,
    retaliateTargetId: null,
    retaliateTimer: 0,
    defending: false,
    defendX: null,
    defendY: null,
    defendRepathTimer: 0
  };
  if (unitType === 'soldier') {
    u.hp = SOLDIER_MAX_HP;
    u.maxHp = SOLDIER_MAX_HP;
  } else if (unitType === 'worker') {
    u.hp = WORKER_MAX_HP;
    u.maxHp = WORKER_MAX_HP;
  } else if (unitType === 'enemy') {
    u.hp = ENEMY_MAX_HP;
    u.maxHp = ENEMY_MAX_HP;
  }
  return u;
}
function getSelectedUnit() {
  return units.find(u => u.id === selectedUnitId) || null;
}
function getSelectedUnits() {
  if (selectedUnitIds.length) {
    return units.filter(u => selectedUnitIds.includes(u.id));
  }
  const one = getSelectedUnit();
  return one ? [one] : [];
}
function isUnitSelected(id) {
  if (selectedUnitIds.length) return selectedUnitIds.includes(id);
  return selectedUnitId === id;
}
function applySelectionFilter() {
  let ids = fullSelectionIds.length ? fullSelectionIds : selectedUnitIds;
  if (selectionFilter === 'worker') {
    ids = ids.filter(id => {
      const u = units.find(x => x.id === id);
      return u && u.unitType === 'worker';
    });
  } else if (selectionFilter === 'soldier') {
    ids = ids.filter(id => {
      const u = units.find(x => x.id === id);
      return u && u.unitType === 'soldier';
    });
  }
  selectedUnitIds = ids;
  selectedUnitId = ids.length === 1 ? ids[0] : (ids[0] ?? null);
}
function setSingleSelection(id) {
  selectedUnitId = id;
  selectedUnitIds = id != null ? [id] : [];
  fullSelectionIds = selectedUnitIds.slice();
  selectionFilter = 'all';
  selectedBase = null;
  selectedArmory = null;
  selectedHut = null;
}
function setMultiSelection(ids) {
  fullSelectionIds = [...new Set(ids)];
  selectionFilter = 'all';
  selectedUnitIds = fullSelectionIds.slice();
  selectedUnitId = selectedUnitIds.length === 1 ? selectedUnitIds[0] : (selectedUnitIds[0] ?? null);
  selectedBase = null;
  selectedArmory = null;
  selectedHut = null;
  actionMode = null;
}
function clearSelection() {
  selectedUnitId = null;
  selectedUnitIds = [];
  fullSelectionIds = [];
  selectionFilter = 'all';
  selectedBase = null;
  selectedArmory = null;
  selectedHut = null;
  actionMode = null;
}
function selectionComposition(list) {
  const workers = list.filter(u => u.unitType === 'worker');
  const soldiers = list.filter(u => u.unitType === 'soldier');
  return {
    workers, soldiers,
    allWorkers: workers.length === list.length && list.length > 0,
    allSoldiers: soldiers.length === list.length && list.length > 0,
    mixed: workers.length > 0 && soldiers.length > 0
  };
}
function isUnitIdleForSelect(u) {
  if (!u) return false;
  if (u.unitType === 'enemy') return false;
  if (u.path && u.path.length && u.pathIndex < u.path.length) return false;
  if (u.harvesting || u.mining || u.building || u.repairing || u.tunneling || u.attacking) return false;
  if (u.defending) return false;
  if (u.carryingWood || u.carryingVirelium) return false;
  return true;
}
function selectSimilarNear(seed) {
  if (!seed || seed.unitType === 'enemy') return;
  const ids = [];
  const r = SELECT_SIMILAR_RANGE;
  for (const u of units) {
    if (u.unitType !== seed.unitType) continue;
    if (!isUnitIdleForSelect(u) && u.id !== seed.id) continue;
    if (Math.hypot(u.x - seed.x, u.y - seed.y) <= r) ids.push(u.id);
  }
  if (!ids.includes(seed.id)) ids.push(seed.id);
  setMultiSelection(ids);
}
function clearUnitOrders(u) {
  if (!u) return;
  releaseAllClaimsForUnit(u.id);
  u.path = []; u.pathIndex = 0; u.goalX = u.goalY = null;
  u.harvesting = false; u.harvestTimer = 0; u.harvestTX = u.harvestTY = null;
  u.preferTreeX = u.preferTreeY = null;
  u.returningToBase = false; u.carryingWood = false;
  u.mining = false; u.mineTimer = 0; u.mineTX = u.mineTY = null;
  u.returningMineral = false; u.carryingVirelium = false;
  u.building = false; u.buildKind = null; u.buildTX = u.buildTY = null;
  u.buildTimer = 0; u.buildDuration = 0;
  u.repairing = false; u.repairTimer = 0; u.repairTX = u.repairTY = null;
  u.tunneling = false; u.tunnelStart = null; u.tunnelEnd = null; u.tunnelCarvePath = null;
  u.carveTimer = 0; u.carveTileX = u.carveTileY = null;
  u.attacking = false; u.attackTargetId = null; u.attackHutId = null; u.attackTimer = 0;
  u.attackRepathTimer = 0;
  u.defending = false; u.defendX = u.defendY = null; u.defendRepathTimer = 0;
}
