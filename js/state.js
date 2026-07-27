// state.js — runtime state, units, claims
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let map = null;
let mineralMap = null;
let treeDensity = null;
let rockElev = null;
let camX = 0, camY = 0, zoom = 1, dpr = 1;
let isDragging = false, lastX = 0, lastY = 0, lastPinchDist = 0;
let pointerDownPos = null, didPan = false;

let units = [];
let nextUnitId = 1;
let selectedUnitId = null;
let selectedBase = null;
let actionMode = null;
let woodInBase = 0;
let vireliumInBase = 0;
let claimedTrees = new Map();
let claimedMinerals = new Map();

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

function makeUnit(x, y) {
  return {
    id: nextUnitId++, x, y,
    path: [], pathIndex: 0, goalX: null, goalY: null,
    harvesting: false, harvestTimer: 0, harvestTX: null, harvestTY: null,
    carryingWood: false, returningToBase: false,
    mining: false, mineTimer: 0, mineTX: null, mineTY: null,
    carryingVirelium: false, returningMineral: false,
    building: false, buildTX: null, buildTY: null,
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
  u.returningToBase = false; u.carryingWood = false;
  u.mining = false; u.mineTimer = 0; u.mineTX = u.mineTY = null;
  u.returningMineral = false; u.carryingVirelium = false;
  u.building = false; u.buildTX = u.buildTY = null;
  u.tunneling = false; u.tunnelStart = null; u.tunnelEnd = null; u.tunnelCarvePath = null;
  u.carveTimer = 0; u.carveTileX = u.carveTileY = null;
}
