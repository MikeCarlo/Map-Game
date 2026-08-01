// main.js — game loop, buttons, init
function tryMoveUnit(u, dx, dy) {
  const newX = u.x + dx, newY = u.y + dy;
  if (isWalkable(newX, newY)) { u.x = newX; u.y = newY; return true; }
  let moved = false;
  if (isWalkable(newX, u.y)) { u.x = newX; moved = true; }
  if (isWalkable(u.x, newY)) { u.y = newY; moved = true; }
  return moved;
}

function uiBottomInset() {
  const ui = document.getElementById('ui');
  if (!ui) return 120;
  return Math.max(100, window.innerHeight - ui.getBoundingClientRect().top + 8);
}

let lastFrameTime = performance.now();
function gameLoop(now) {
  const dt = Math.min(0.05, (now - lastFrameTime) / 1000);
  lastFrameTime = now;
  let needDraw = false;

  if (updateJets(dt)) needDraw = true;

  for (const u of units) {
    if (u.harvesting && u.harvestTimer > 0 && !u.carryingWood) {
      u.harvestTimer -= dt;
      if (u.harvestTimer <= 0) finishCurrentTree(u);
      needDraw = true;
    }
    if (u.mining && u.mineTimer > 0 && !u.carryingVirelium) {
      u.mineTimer -= dt;
      if (u.mineTimer <= 0) finishMine(u);
      needDraw = true;
    }
    if (u.tunneling && u.carveTimer > 0) {
      u.carveTimer -= dt;
      if (u.carveTimer <= 0) {
        if (u.carveTileX !== null && u.carveTileY !== null) carveRockAt(u.carveTileX, u.carveTileY);
        u.carveTimer = 0; u.carveTileX = u.carveTileY = null;
      }
      needDraw = true;
      continue;
    }
    if (u.path.length && u.pathIndex < u.path.length) {
      const wp = u.path[u.pathIndex];
      const dx = wp.x - u.x, dy = wp.y - u.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.12) {
        u.x = wp.x; u.y = wp.y;
        const tx = Math.floor(u.x), ty = Math.floor(u.y);
        if (u.tunneling && inBounds(tx, ty) && map[ty][tx] === TILE_ROCK) {
          beginCarveTile(u, tx, ty); needDraw = true; continue;
        }
        u.pathIndex++;
        if (u.pathIndex >= u.path.length) {
          u.path = []; u.pathIndex = 0; u.goalX = u.goalY = null;
          resolveIdleStand(u);
          if (u.tunneling && u.tunnelCarvePath) startTunnelCarve(u);
          else if (u.tunneling) finishTunnel(u);
          else if (u.harvesting) startHarvestOnArrival(u);
          else if (u.mining) startMineOnArrival(u);
          else if (u.building) finishBuild(u);
        }
      } else {
        const step = Math.min(getUnitSpeed(u) * dt, dist);
        const ndx = (dx / dist) * step, ndy = (dy / dist) * step;
        const newX = u.x + ndx, newY = u.y + ndy;
        const nx = Math.floor(newX), ny = Math.floor(newY);
        const onRockTunnel = u.tunneling && inBounds(nx, ny) && map[ny][nx] === TILE_ROCK;
        if (onRockTunnel || isWalkable(newX, newY)) {
          if (onRockTunnel && (nx !== Math.floor(u.x) || ny !== Math.floor(u.y))) {
            u.x = nx + 0.5; u.y = ny + 0.5; beginCarveTile(u, nx, ny);
          } else { u.x = newX; u.y = newY; }
        } else tryMoveUnit(u, ndx, ndy);
      }
      needDraw = true;
    }
  }

  if (separateIdleUnits()) needDraw = true;

  // Pulse selection rings
  if (selectedUnitIds.length || selectedUnitId != null) needDraw = true;

  if (needDraw) draw();
  requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);

document.getElementById('btnNew').addEventListener('click', newMap);
document.getElementById('btnResetView').addEventListener('click', () => {
  const bottom = uiBottomInset();
  zoom = Math.min((window.innerWidth * 0.9) / (MAP_W * TILE), ((window.innerHeight - bottom) * 0.95) / (MAP_H * TILE));
  camX = (window.innerWidth - MAP_W * TILE * zoom) / 2;
  camY = (window.innerHeight - bottom - MAP_H * TILE * zoom) / 2;
  draw();
});

document.getElementById('btnMove').addEventListener('click', () => {
  const u = getSelectedUnit(); if (!u) return;
  if (actionMode === 'moveTarget') actionMode = null;
  else { actionMode = 'moveTarget'; clearUnitOrders(u); }
  updateUI(); draw();
});
document.getElementById('btnSoldierMove').addEventListener('click', () => {
  const u = getSelectedUnit(); if (!u || u.unitType !== 'soldier') return;
  if (actionMode === 'moveTarget') actionMode = null;
  else { actionMode = 'moveTarget'; clearUnitOrders(u); }
  updateUI(); draw();
});
document.getElementById('btnGroupMove').addEventListener('click', () => {
  const list = getSelectedUnits();
  if (list.length < 1) return;
  if (actionMode === 'moveTarget') actionMode = null;
  else {
    actionMode = 'moveTarget';
    for (const u of list) clearUnitOrders(u);
  }
  updateUI(); draw();
});
document.getElementById('btnGroupCut').addEventListener('click', () => {
  const list = getSelectedUnits().filter(u => u.unitType === 'worker');
  if (!list.length) return;
  if (actionMode === 'cutTarget') actionMode = null;
  else {
    actionMode = 'cutTarget';
    for (const u of list) clearUnitOrders(u);
  }
  updateUI(); draw();
});
document.getElementById('btnGroupMine').addEventListener('click', () => {
  const list = getSelectedUnits().filter(u => u.unitType === 'worker');
  if (!list.length) return;
  if (actionMode === 'mineTarget') actionMode = null;
  else {
    actionMode = 'mineTarget';
    for (const u of list) clearUnitOrders(u);
  }
  updateUI(); draw();
});
document.getElementById('btnCut').addEventListener('click', () => {
  const u = getSelectedUnit(); if (!u || u.unitType !== 'worker') return;
  if (actionMode === 'cutTarget') actionMode = null;
  else { actionMode = 'cutTarget'; clearUnitOrders(u); }
  updateUI(); draw();
});
document.getElementById('btnMine').addEventListener('click', () => {
  const u = getSelectedUnit(); if (!u || u.unitType !== 'worker') return;
  if (actionMode === 'mineTarget') actionMode = null;
  else { actionMode = 'mineTarget'; clearUnitOrders(u); }
  updateUI(); draw();
});
document.getElementById('btnTunnel').addEventListener('click', () => {
  const u = getSelectedUnit(); if (!u || u.unitType !== 'worker') return;
  if (actionMode === 'tunnelStart' || actionMode === 'tunnelEnd') {
    actionMode = null; u.tunnelStart = null; u.tunnelEnd = null;
  } else {
    clearUnitOrders(u); actionMode = 'tunnelStart';
  }
  updateUI(); draw();
});

document.getElementById('btnBuild').addEventListener('click', () => {
  const u = getSelectedUnit(); if (!u || u.unitType !== 'worker') return;
  clearUnitOrders(u);
  actionMode = 'buildMenu';
  updateUI(); draw();
});
document.getElementById('btnBuildBase').addEventListener('click', () => {
  const u = getSelectedUnit(); if (!u) return;
  actionMode = 'buildBaseTarget';
  updateUI(); draw();
});
document.getElementById('btnBuildArmory').addEventListener('click', () => {
  const u = getSelectedUnit(); if (!u) return;
  actionMode = 'buildArmoryTarget';
  updateUI(); draw();
});
document.getElementById('btnBuildCancel').addEventListener('click', () => {
  actionMode = null;
  updateUI(); draw();
});

document.getElementById('btnCancel').addEventListener('click', () => {
  const u = getSelectedUnit();
  if (u) clearUnitOrders(u);
  clearSelection();
  updateUI(); draw();
});
document.getElementById('btnSoldierCancel').addEventListener('click', () => {
  const u = getSelectedUnit();
  if (u) clearUnitOrders(u);
  clearSelection();
  updateUI(); draw();
});
document.getElementById('btnGroupCancel').addEventListener('click', () => {
  for (const u of getSelectedUnits()) clearUnitOrders(u);
  clearSelection();
  updateUI(); draw();
});

function onFilterChip(filter) {
  selectionFilter = filter;
  applySelectionFilter();
  actionMode = null;
  updateUI(); draw();
}
document.getElementById('filterAll').addEventListener('click', () => onFilterChip('all'));
document.getElementById('filterWorkers').addEventListener('click', () => onFilterChip('worker'));
document.getElementById('filterSoldiers').addEventListener('click', () => onFilterChip('soldier'));

document.getElementById('btnTrain').addEventListener('click', () => {
  if (!selectedBase) return;
  trainUnitAtBase(selectedBase.x, selectedBase.y);
});
document.getElementById('btnUpgrade').addEventListener('click', () => {
  if (!playerBase) return;
  if (!upgradeBase()) {
    const info = document.getElementById('info');
    if (info) info.textContent = 'No clear space to expand the base (need a free 3×3)';
  }
});
document.getElementById('btnCancelBase').addEventListener('click', () => {
  selectedBase = null; updateUI(); draw();
});

document.getElementById('btnTrainSoldier').addEventListener('click', () => {
  if (!selectedArmory) return;
  trainSoldierAtArmory(selectedArmory.x, selectedArmory.y);
});
document.getElementById('btnCancelArmory').addEventListener('click', () => {
  selectedArmory = null; updateUI(); draw();
});

window.addEventListener('resize', resize);

(function initGame() {
  const { baseSpot } = generateMap();
  units = [spawnWorkerBesideBase(baseSpot)];
  armories = [];
  cameraPanEnabled = true;
  if (typeof updateCameraModeIndicator === 'function') updateCameraModeIndicator();
  resize();
  setTimeout(() => document.getElementById('btnResetView').click(), 50);
  updateUI();
})();
