// input.js — pointer, pan, zoom, taps, box multi-select
function screenToTile(clientX, clientY) {
  return { x: (clientX - camX) / (TILE * zoom), y: (clientY - camY) / (TILE * zoom) };
}
function unitAtScreen(clientX, clientY) {
  for (let i = units.length - 1; i >= 0; i--) {
    const u = units[i];
    if (u.unitType === 'enemy') continue; // not selectable as player unit
    const sx = camX + u.x * TILE * zoom, sy = camY + u.y * TILE * zoom;
    if (Math.hypot(clientX - sx, clientY - sy) < SELECT_RADIUS + Math.max(0, zoom * 2))
      return u;
  }
  return null;
}
function enemyAtScreen(clientX, clientY) {
  for (let i = units.length - 1; i >= 0; i--) {
    const u = units[i];
    if (u.unitType !== 'enemy') continue;
    const sx = camX + u.x * TILE * zoom, sy = camY + u.y * TILE * zoom;
    if (Math.hypot(clientX - sx, clientY - sy) < SELECT_RADIUS + Math.max(0, zoom * 2))
      return u;
  }
  return null;
}
function uiPanelTop() {
  const ui = document.getElementById('ui');
  if (!ui) return window.innerHeight - 120;
  return ui.getBoundingClientRect().top;
}

function clearLongPressTimer() {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

function startBoxSelect(x, y) {
  boxSelectActive = true;
  longPressFired = true;
  boxSelectStart = { x, y };
  boxSelectCurrent = { x, y };
  didPan = true;
  draw();
}

function finishBoxSelect() {
  if (!boxSelectActive || !boxSelectStart || !boxSelectCurrent) {
    boxSelectActive = false;
    boxSelectStart = boxSelectCurrent = null;
    return;
  }
  const x1 = Math.min(boxSelectStart.x, boxSelectCurrent.x);
  const y1 = Math.min(boxSelectStart.y, boxSelectCurrent.y);
  const x2 = Math.max(boxSelectStart.x, boxSelectCurrent.x);
  const y2 = Math.max(boxSelectStart.y, boxSelectCurrent.y);
  const ids = [];
  for (const u of units) {
    if (u.unitType === 'enemy') continue;
    const sx = camX + u.x * TILE * zoom;
    const sy = camY + u.y * TILE * zoom;
    if (sx >= x1 && sx <= x2 && sy >= y1 && sy <= y2) ids.push(u.id);
  }
  if (ids.length) setMultiSelection(ids);
  else clearSelection();
  boxSelectActive = false;
  boxSelectStart = boxSelectCurrent = null;
  updateUI(); draw();
}

function toggleCameraPan() {
  cameraPanEnabled = !cameraPanEnabled;
  if (cameraPanEnabled) {
    boxSelectActive = false;
    boxSelectStart = boxSelectCurrent = null;
    clearLongPressTimer();
    longPressFired = false;
  }
  updateCameraModeIndicator();
  updateUI();
  draw();
}

function updateCameraModeIndicator() {
  const el = document.getElementById('cameraMode');
  if (!el) return;
  if (cameraPanEnabled) {
    el.textContent = 'PAN';
    el.className = 'camera-mode pan-on';
    el.title = 'Camera pan ON — double-tap empty ground to lock for multi-select';
  } else {
    el.textContent = 'SELECT';
    el.className = 'camera-mode pan-locked';
    el.title = 'Camera locked — long-press drag to multi-select. Double-tap empty to unlock.';
  }
}

function handleTap(clientX, clientY) {
  if (clientY >= uiPanelTop() - 4) return;

  const now = performance.now();
  const isDouble =
    now - lastTapTime < DOUBLE_TAP_MS &&
    Math.hypot(clientX - lastTapX, clientY - lastTapY) < DOUBLE_TAP_DIST;
  lastTapTime = now;
  lastTapX = clientX;
  lastTapY = clientY;

  const hitForDouble = unitAtScreen(clientX, clientY);
  if (isDouble) {
    if (hitForDouble) {
      selectSimilarNear(hitForDouble);
      actionMode = null;
      updateUI(); draw();
    } else {
      toggleCameraPan();
    }
    return;
  }

  const selected = getSelectedUnits();
  const primary = selected[0] || null;

  if (actionMode === 'moveTarget' && selected.length) {
    const tile = screenToTile(clientX, clientY);
    if (selected.length === 1) {
      if (setMoveTarget(selected[0], tile.x, tile.y)) {
        actionMode = null; updateUI(); draw();
      }
    } else if (setGroupMoveTarget(selected, tile.x, tile.y)) {
      actionMode = null; updateUI(); draw();
    }
    return;
  }

  if (actionMode === 'attackTarget' && selected.length) {
    const tile = screenToTile(clientX, clientY);
    const soldiers = selected.filter(u => u.unitType === 'soldier');
    if (soldiers.length > 1) {
      if (setGroupAttackAtPoint(soldiers, tile.x, tile.y)) {
        actionMode = null; updateUI(); draw();
      }
    } else if (soldiers.length === 1) {
      if (setAttackAtPoint(soldiers[0], tile.x, tile.y)) {
        actionMode = null; updateUI(); draw();
      }
    }
    return;
  }

  if (actionMode === 'defendTarget' && selected.length) {
    const tile = screenToTile(clientX, clientY);
    const soldiers = selected.filter(u => u.unitType === 'soldier');
    if (soldiers.length > 1) {
      if (setGroupDefendPost(soldiers, tile.x, tile.y)) {
        actionMode = null; updateUI(); draw();
      }
    } else if (soldiers.length === 1) {
      if (setDefendPost(soldiers[0], tile.x, tile.y)) {
        actionMode = null; updateUI(); draw();
      }
    }
    return;
  }

  if (actionMode === 'cutTarget' && selected.length) {
    const tile = screenToTile(clientX, clientY);
    const workers = selected.filter(u => u.unitType === 'worker');
    if (workers.length > 1) {
      if (setGroupCutTarget(workers, tile.x, tile.y)) {
        actionMode = null; updateUI(); draw();
      }
    } else if (workers.length === 1) {
      if (setCutTarget(workers[0], tile.x, tile.y)) {
        actionMode = null; updateUI(); draw();
      }
    }
    return;
  }

  if (actionMode === 'mineTarget' && selected.length) {
    const tile = screenToTile(clientX, clientY);
    const workers = selected.filter(u => u.unitType === 'worker');
    if (workers.length > 1) {
      if (setGroupMineTarget(workers, tile.x, tile.y)) {
        actionMode = null; updateUI(); draw();
      }
    } else if (workers.length === 1) {
      if (setMineTarget(workers[0], tile.x, tile.y)) {
        actionMode = null; updateUI(); draw();
      }
    }
    return;
  }

  const u = primary;
  if (actionMode === 'buildBaseTarget' && u) {
    const tile = screenToTile(clientX, clientY);
    if (setBuildTarget(u, tile.x, tile.y, 'base')) { actionMode = null; updateUI(); draw(); }
    return;
  }
  if (actionMode === 'buildArmoryTarget' && u) {
    const tile = screenToTile(clientX, clientY);
    if (setBuildTarget(u, tile.x, tile.y, 'armory')) { actionMode = null; updateUI(); draw(); }
    return;
  }
  if (actionMode === 'tunnelStart' && u) {
    const tile = screenToTile(clientX, clientY);
    if (setTunnelStart(u, tile.x, tile.y)) {
      actionMode = 'tunnelEnd';
      updateUI(); draw();
    }
    return;
  }
  if (actionMode === 'tunnelEnd' && u) {
    const tile = screenToTile(clientX, clientY);
    if (setTunnelEnd(u, tile.x, tile.y)) {
      actionMode = null;
      updateUI(); draw();
    }
    return;
  }

  const hit = unitAtScreen(clientX, clientY);
  if (hit) {
    setSingleSelection(hit.id);
    actionMode = null;
    updateUI(); draw(); return;
  }

  const tile = screenToTile(clientX, clientY);
  const tx = Math.floor(tile.x), ty = Math.floor(tile.y);
  if (inBounds(tx, ty) && map[ty][tx] === TILE_BASE) {
    selectedBase = { x: tx, y: ty };
    selectedArmory = null;
    selectedHut = null;
    selectedUnitId = null;
    selectedUnitIds = [];
    fullSelectionIds = [];
    actionMode = null;
    updateUI(); draw(); return;
  }
  if (inBounds(tx, ty) && map[ty][tx] === TILE_ARMORY) {
    const a = findArmoryAt(tx, ty);
    if (a) {
      selectedArmory = { x: a.x, y: a.y };
      selectedBase = null;
      selectedHut = null;
      selectedUnitId = null;
      selectedUnitIds = [];
      fullSelectionIds = [];
      actionMode = null;
      updateUI(); draw(); return;
    }
  }
  if (inBounds(tx, ty) && map[ty][tx] === TILE_HUT) {
    const h = findHutAt(tx, ty);
    if (h) {
      selectedHut = { x: h.x, y: h.y };
      selectedBase = null;
      selectedArmory = null;
      selectedUnitId = null;
      selectedUnitIds = [];
      fullSelectionIds = [];
      actionMode = null;
      updateUI(); draw(); return;
    }
  }

  clearSelection();
  updateUI(); draw();
}

canvas.addEventListener('pointerdown', e => {
  if (e.pointerType === 'touch' && !e.isPrimary) return;
  if (e.clientY >= uiPanelTop() - 4) return;

  pointerDownPos = { x: e.clientX, y: e.clientY };
  didPan = false;
  isDragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  longPressFired = false;
  boxSelectActive = false;
  boxSelectStart = boxSelectCurrent = null;
  clearLongPressTimer();

  if (!cameraPanEnabled) {
    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      if (!isDragging || !pointerDownPos) return;
      startBoxSelect(pointerDownPos.x, pointerDownPos.y);
    }, LONG_PRESS_MS);
  }

  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', e => {
  if (!isDragging) return;

  if (boxSelectActive) {
    boxSelectCurrent = { x: e.clientX, y: e.clientY };
    draw();
    return;
  }

  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  const movedFromStart = pointerDownPos
    ? Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y)
    : 0;

  if (longPressTimer && movedFromStart > LONG_PRESS_MOVE_TOL) {
    clearLongPressTimer();
  }

  if (cameraPanEnabled) {
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didPan = true;
    camX += dx; camY += dy;
    lastX = e.clientX; lastY = e.clientY;
    draw();
  } else {
    lastX = e.clientX; lastY = e.clientY;
    if (movedFromStart > 3) didPan = true;
  }
});

canvas.addEventListener('pointerup', e => {
  clearLongPressTimer();
  isDragging = false;
  try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}

  if (boxSelectActive) {
    finishBoxSelect();
    pointerDownPos = null;
    longPressFired = false;
    return;
  }

  if (!didPan && pointerDownPos && !longPressFired) {
    if (Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y) < 12)
      handleTap(e.clientX, e.clientY);
  }
  pointerDownPos = null;
  longPressFired = false;
});

canvas.addEventListener('pointercancel', () => {
  clearLongPressTimer();
  isDragging = false;
  pointerDownPos = null;
  if (boxSelectActive) {
    boxSelectActive = false;
    boxSelectStart = boxSelectCurrent = null;
    draw();
  }
  longPressFired = false;
});

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const oldZoom = zoom;
  zoom = Math.max(0.25, Math.min(6, zoom * (e.deltaY < 0 ? 1.12 : 0.89)));
  camX = e.clientX - (e.clientX - camX) * (zoom / oldZoom);
  camY = e.clientY - (e.clientY - camY) * (zoom / oldZoom);
  draw();
}, { passive: false });

let pointers = new Map();
function getDist(t1, t2) { return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY); }
canvas.addEventListener('pointerdown', e => {
  pointers.set(e.pointerId, e);
  if (pointers.size === 2) {
    isDragging = false;
    clearLongPressTimer();
    boxSelectActive = false;
    boxSelectStart = boxSelectCurrent = null;
    lastPinchDist = getDist(...pointers.values());
  }
});
canvas.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, e);
  if (pointers.size === 2) {
    const pts = [...pointers.values()];
    const dist = getDist(pts[0], pts[1]);
    if (lastPinchDist > 0) {
      const oldZoom = zoom;
      zoom = Math.max(0.25, Math.min(6, zoom * (dist / lastPinchDist)));
      const mx = (pts[0].clientX + pts[1].clientX) / 2;
      const my = (pts[0].clientY + pts[1].clientY) / 2;
      camX = mx - (mx - camX) * (zoom / oldZoom);
      camY = my - (my - camY) * (zoom / oldZoom);
      draw();
    }
    lastPinchDist = dist;
  }
});
canvas.addEventListener('pointerup', e => { pointers.delete(e.pointerId); if (pointers.size < 2) lastPinchDist = 0; });
canvas.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); if (pointers.size < 2) lastPinchDist = 0; });

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', updateCameraModeIndicator);
} else {
  updateCameraModeIndicator();
}
