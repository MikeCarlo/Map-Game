// input.js — pointer, pan, zoom, taps
function screenToTile(clientX, clientY) {
  return { x: (clientX - camX) / (TILE * zoom), y: (clientY - camY) / (TILE * zoom) };
}
function unitAtScreen(clientX, clientY) {
  for (let i = units.length - 1; i >= 0; i--) {
    const u = units[i];
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
function handleTap(clientX, clientY) {
  // Don't treat taps on the bottom action panel as map taps
  if (clientY >= uiPanelTop() - 4) return;
  const u = getSelectedUnit();

  if (actionMode === 'moveTarget' && u) {
    const tile = screenToTile(clientX, clientY);
    if (setMoveTarget(u, tile.x, tile.y)) { actionMode = null; updateUI(); draw(); }
    return;
  }
  if (actionMode === 'cutTarget' && u) {
    const tile = screenToTile(clientX, clientY);
    if (setCutTarget(u, tile.x, tile.y)) { actionMode = null; updateUI(); draw(); }
    return;
  }
  if (actionMode === 'buildTarget' && u) {
    const tile = screenToTile(clientX, clientY);
    if (setBuildTarget(u, tile.x, tile.y)) { actionMode = null; updateUI(); draw(); }
    return;
  }
  if (actionMode === 'mineTarget' && u) {
    const tile = screenToTile(clientX, clientY);
    if (setMineTarget(u, tile.x, tile.y)) { actionMode = null; updateUI(); draw(); }
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
    selectedUnitId = hit.id; selectedBase = null; actionMode = null;
    updateUI(); draw(); return;
  }

  const tile = screenToTile(clientX, clientY);
  const tx = Math.floor(tile.x), ty = Math.floor(tile.y);
  if (inBounds(tx, ty) && map[ty][tx] === TILE_BASE) {
    selectedBase = { x: tx, y: ty };
    selectedUnitId = null; actionMode = null;
    updateUI(); draw(); return;
  }

  selectedUnitId = null; selectedBase = null; actionMode = null;
  updateUI(); draw();
}

canvas.addEventListener('pointerdown', e => {
  if (e.pointerType === 'touch' && !e.isPrimary) return;
  pointerDownPos = { x: e.clientX, y: e.clientY };
  didPan = false; isDragging = true; lastX = e.clientX; lastY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  if (!isDragging) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didPan = true;
  camX += dx; camY += dy; lastX = e.clientX; lastY = e.clientY; draw();
});
canvas.addEventListener('pointerup', e => {
  isDragging = false;
  try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
  if (!didPan && pointerDownPos) {
    if (Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y) < 12)
      handleTap(e.clientX, e.clientY);
  }
  pointerDownPos = null;
});
canvas.addEventListener('pointercancel', () => { isDragging = false; pointerDownPos = null; });

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
