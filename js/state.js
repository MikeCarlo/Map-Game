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
let selectedBase = null;   // { x, y }
let selectedArmory = null; // { x, y } origin of armory
let actionMode = null;
let woodInBase = 0;
let vireliumInBase = 0;
let claimedTrees = new Map();
let claimedMinerals = new Map();

let playerBase = null; // { level, maxWorkers, segments: [{ x, y }] }
let armories = [];     // { x, y } origin of each 2×2 armory

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
function soldiersAtArmory(ax, ay) {
  // Soldiers are global-capped per armory count for now: each armory allows +5 total capacity
  return countSoldiers();
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
  return {
    id: nextUnitId++, x, y,
    unitType, // 'worker' | 'soldier'
    path: [], pathIndex: 0, goalX: null, goalY: null,
    harvesting: false, harvestTimer: 0, harvestTX: null, harvestTY: null,
    preferTreeX: null, preferTreeY: null,
    carryingWood: false, returningToBase: false,
    mining: false, mineTimer: 0, mineTX: null, mineTY: null,
    carryingVirelium: false, returningMineral: false,
    building: false, buildKind: null, buildTX: null, buildTY: null,
    tunneling: false,
    tunnelStart: null,
    tunnelEnd: null,
    tunnelCarvePath: null,
    carveTimer: 0,
    carveTileX: null,
    carveTileY: null
  };
}
function getSelectedUnit() {
  return units.find(u => u.id === selectedUnitId) || null;
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
  u.tunneling = false; u.tunnelStart = null; u.tunnelEnd = null; u.tunnelCarvePath = null;
  u.carveTimer = 0; u.carveTileX = u.carveTileY = null;
}
