// drops.js — cargo left on the ground
//
// A laden worker that gets hit puts its load down where it stands and holds
// position while it swings back (see updateWorkerRetaliation in combat.js).
// Once the fight is over it picks the load back up and carries on to a base,
// so nothing is destroyed by being ambushed — it just has to be collected.

let drops = [];
let nextDropId = 1;

function dropAt(tx, ty, kind) {
  const existing = drops.find(d => d.x === tx && d.y === ty && d.kind === kind);
  if (existing) { existing.count++; return existing; }
  const d = { id: nextDropId++, x: tx, y: ty, kind, count: 1 };
  drops.push(d);
  return d;
}

/** Put whatever this unit is carrying on the ground. Returns the tile, or null. */
function dropCarriedResources(u) {
  if (!u || (!u.carryingWood && !u.carryingVirelium)) return null;
  const tx = Math.max(0, Math.min(MAP_W - 1, Math.floor(u.x)));
  const ty = Math.max(0, Math.min(MAP_H - 1, Math.floor(u.y)));
  if (u.carryingWood) { dropAt(tx, ty, 'wood'); u.carryingWood = false; }
  if (u.carryingVirelium) { dropAt(tx, ty, 'virelium'); u.carryingVirelium = false; }
  u.returningToBase = false;
  u.returningMineral = false;
  return { x: tx, y: ty };
}

/**
 * Under attack: drop the load and stop hauling. The harvesting / mining flags
 * stay set, so once the load is recovered the usual deposit-and-continue logic
 * picks the job back up.
 */
function dropCargoUnderAttack(u) {
  if (!u || u.unitType !== 'worker') return false;
  if (!u.carryingWood && !u.carryingVirelium) return false;
  dropCarriedResources(u);
  u.path = []; u.pathIndex = 0; u.goalX = u.goalY = null;
  return true;
}

function takeDrop(u, d) {
  if (!u || !d || u.carryingWood || u.carryingVirelium) return false;
  if (d.kind === 'wood') u.carryingWood = true; else u.carryingVirelium = true;
  d.count--;
  if (d.count <= 0) drops = drops.filter(x => x.id !== d.id);
  return true;
}

/** Route a just-collected load to a base; deposit logic takes over on arrival. */
function haulPickedUpDrop(u) {
  if (u.carryingWood) {
    u.harvesting = true; u.mining = false;
    returnToBaseWithWood(u);
  } else if (u.carryingVirelium) {
    u.mining = true; u.harvesting = false;
    returnToBaseWithMineral(u);
  }
}

/**
 * Any worker with free hands collects a pile it is standing on. Skipped while
 * it is still trading blows, otherwise it would snatch the load straight back
 * up mid-fight.
 */
function updateDropPickups() {
  if (!drops.length) return false;
  let changed = false;
  for (const u of units) {
    if (u.unitType !== 'worker') continue;
    if (u.carryingWood || u.carryingVirelium) continue;
    if (u.building || u.repairing || u.tunneling) continue;
    if (isWorkerFightingBack(u)) continue;
    for (const d of drops.slice()) {
      if (Math.hypot(d.x + 0.5 - u.x, d.y + 0.5 - u.y) > DROP_PICKUP_RANGE) continue;
      if (!takeDrop(u, d)) continue;
      haulPickedUpDrop(u);
      changed = true;
      break;
    }
  }
  return changed;
}

/** A pile within arm's reach of this unit, if any. */
function nearbyDroppedLoad(u) {
  if (!u) return null;
  return drops.find(d => Math.hypot(d.x + 0.5 - u.x, d.y + 0.5 - u.y) <= DROP_PICKUP_RANGE) || null;
}

function countDrops(kind) {
  return drops.reduce((n, d) => n + (kind && d.kind !== kind ? 0 : d.count), 0);
}

function resetDrops() {
  drops = [];
  nextDropId = 1;
}
