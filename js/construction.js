// construction.js — buildings take time to go up
// Worker builds (armory / new base segment) run on the worker's buildTimer.
// The base Upgrade button runs a site here: no worker, it raises itself.

function buildTimeFor(kind) {
  return kind === 'armory' ? BUILD_ARMORY_TIME : BUILD_BASE_TIME;
}

/** 0..1 for a worker that is on site putting a building up */
function buildProgress(u) {
  if (!u || !u.building || !u.buildDuration) return 0;
  return Math.max(0, Math.min(1, 1 - u.buildTimer / u.buildDuration));
}
function isBuildInProgress(u) {
  return !!(u && u.building && u.buildTimer > 0);
}

function baseUpgradeProgress() {
  if (!baseUpgrade || !baseUpgrade.duration) return 0;
  return Math.max(0, Math.min(1, 1 - baseUpgrade.remaining / baseUpgrade.duration));
}

function startBaseUpgrade() {
  if (baseUpgrade) return false;
  const spot = findUpgradeSpot();
  if (!spot) return false;
  baseUpgrade = {
    x: spot.x, y: spot.y,
    duration: BASE_UPGRADE_TIME,
    remaining: BASE_UPGRADE_TIME
  };
  return true;
}

function cancelBaseUpgrade() {
  if (!baseUpgrade) return false;
  baseUpgrade = null;
  return true;
}

function updateBaseUpgrade(dt) {
  if (!baseUpgrade) return false;
  if (!playerBase) { baseUpgrade = null; updateUI(); return true; }
  baseUpgrade.remaining -= dt;
  if (baseUpgrade.remaining > 0) return true;
  const { x, y } = baseUpgrade;
  baseUpgrade = null;
  if (canPlaceBase(x, y)) {
    registerBaseSegment(x, y);
  } else {
    const info = document.getElementById('info');
    if (info) info.textContent = 'Expansion site got blocked — upgrade cancelled';
  }
  updateUI();
  return true;
}

/** Ground already spoken for by a build that has not finished yet. */
function isReservedByConstruction(x, y, ignoreUnitId) {
  if (baseUpgrade &&
      x >= baseUpgrade.x && x < baseUpgrade.x + BASE_SEGMENT_SIZE &&
      y >= baseUpgrade.y && y < baseUpgrade.y + BASE_SEGMENT_SIZE) return true;
  for (const u of units) {
    if (!u.building || u.buildTX == null) continue;
    if (ignoreUnitId != null && u.id === ignoreUnitId) continue;
    const size = u.buildKind === 'armory' ? ARMORY_SIZE : BASE_SEGMENT_SIZE;
    if (x >= u.buildTX && x < u.buildTX + size &&
        y >= u.buildTY && y < u.buildTY + size) return true;
  }
  return false;
}

function footprintIsFree(ax, ay, footprint, ignoreUnitId) {
  for (const { dx, dy } of footprint) {
    if (isReservedByConstruction(ax + dx, ay + dy, ignoreUnitId)) return false;
  }
  return true;
}

/** Every site with a dial on it: worker builds + the base upgrade. */
function constructionSites() {
  const sites = [];
  if (baseUpgrade) {
    sites.push({
      x: baseUpgrade.x, y: baseUpgrade.y,
      size: BASE_SEGMENT_SIZE,
      kind: 'base',
      pct: baseUpgradeProgress()
    });
  }
  for (const u of units) {
    if (!isBuildInProgress(u)) continue;
    sites.push({
      x: u.buildTX, y: u.buildTY,
      size: u.buildKind === 'armory' ? ARMORY_SIZE : BASE_SEGMENT_SIZE,
      kind: u.buildKind === 'armory' ? 'armory' : 'base',
      pct: buildProgress(u)
    });
  }
  return sites;
}

function resetConstruction() {
  baseUpgrade = null;
}
