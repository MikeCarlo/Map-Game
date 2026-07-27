// render.js — canvas drawing
function resize() {
  dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

function drawJetPulses() {
  if (!jetPulses || !jetPulses.length) return;
  for (const p of jetPulses) {
    const t = Math.min(1, p.age / p.maxAge);
    // Ease-out expand
    const expand = 1 - Math.pow(1 - t, 2);
    const maxR = (p.radius + 1.2) * TILE * zoom;
    const minR = TILE * zoom * 0.4;
    const r = minR + (maxR - minR) * expand;
    const alpha = (1 - t) * (0.35 + 0.15 * Math.min(1, p.amount / 6));
    const cx = camX + p.x * TILE * zoom;
    const cy = camY + p.y * TILE * zoom;

    // Outer glow ring
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(0, 229, 255, ${alpha * 0.9})`;
    ctx.lineWidth = Math.max(1.5, 2.5 * zoom * (1 - t * 0.5));
    ctx.stroke();

    // Second trailing ring (slightly behind)
    if (t > 0.12) {
      const t2 = Math.max(0, t - 0.12);
      const expand2 = 1 - Math.pow(1 - t2, 2);
      const r2 = minR + (maxR - minR) * expand2 * 0.85;
      ctx.beginPath();
      ctx.arc(cx, cy, r2, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0, 188, 212, ${alpha * 0.45})`;
      ctx.lineWidth = Math.max(1, 1.5 * zoom);
      ctx.stroke();
    }

    // Bright core flash at start
    if (t < 0.35) {
      const coreA = (1 - t / 0.35) * 0.55;
      const coreR = TILE * zoom * (0.6 + t * 1.2);
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 229, 255, ${coreA})`;
      ctx.fill();
    }
  }
}

function draw() {
  if (!map) return;
  const w = window.innerWidth, h = window.innerHeight;
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, w, h);
  const worldW = MAP_W * TILE * zoom, worldH = MAP_H * TILE * zoom;
  camX = Math.min(w * 0.3, Math.max(w - worldW - w * 0.3, camX));
  camY = Math.min(h * 0.3, Math.max(h - worldH - h * 0.3 - 56, camY));
  const startTX = Math.max(0, Math.floor((-camX) / (TILE * zoom)));
  const startTY = Math.max(0, Math.floor((-camY) / (TILE * zoom)));
  const endTX = Math.min(MAP_W, Math.ceil((w - camX) / (TILE * zoom)) + 1);
  const endTY = Math.min(MAP_H, Math.ceil((h - camY) / (TILE * zoom)) + 1);

  for (let ty = startTY; ty < endTY; ty++) {
    for (let tx = startTX; tx < endTX; tx++) {
      const tile = map[ty][tx];
      let color = tileColor(tx, ty, tile);
      if (mineralMap && mineralMap[ty][tx] > 0 && (tile === TILE_DIRT || tile === TILE_STUMP)) {
        const d = Math.min(10, mineralMap[ty][tx]);
        color = VIRELIUM_SHADES[d - 1];
      }
      ctx.fillStyle = color;
      const sx = camX + tx * TILE * zoom, sy = camY + ty * TILE * zoom;
      const tw = Math.ceil(TILE * zoom), th = Math.ceil(TILE * zoom);
      ctx.fillRect(Math.floor(sx), Math.floor(sy), tw, th);
      if (tile === TILE_JET) {
        ctx.fillStyle = '#00E5FF';
        ctx.fillRect(Math.floor(sx), Math.floor(sy), tw, Math.max(1, Math.ceil(zoom)));
        ctx.fillRect(Math.floor(sx), Math.floor(sy + th - Math.max(1, zoom)), tw, Math.max(1, Math.ceil(zoom)));
        ctx.fillRect(Math.floor(sx), Math.floor(sy), Math.max(1, Math.ceil(zoom)), th);
        ctx.fillRect(Math.floor(sx + tw - Math.max(1, zoom)), Math.floor(sy), Math.max(1, Math.ceil(zoom)), th);
        ctx.fillStyle = '#050510';
        const inset = Math.max(1, Math.floor(zoom * 1.5));
        ctx.fillRect(Math.floor(sx + inset), Math.floor(sy + inset), Math.max(1, tw - inset * 2), Math.max(1, th - inset * 2));
      }
    }
  }

  drawJetPulses();

  if (selectedBase) {
    const sx = camX + selectedBase.x * TILE * zoom;
    const sy = camY + selectedBase.y * TILE * zoom;
    ctx.strokeStyle = '#CE93D8';
    ctx.lineWidth = 2;
    ctx.strokeRect(Math.floor(sx), Math.floor(sy), Math.ceil(TILE * zoom), Math.ceil(TILE * zoom));
  }

  const selU = getSelectedUnit();
  if (selU && selU.tunnelStart && (actionMode === 'tunnelEnd' || selU.tunneling)) {
    const sx = camX + selU.tunnelStart.x * TILE * zoom;
    const sy = camY + selU.tunnelStart.y * TILE * zoom;
    const tw = Math.ceil(TILE * zoom);
    ctx.strokeStyle = '#FF9800';
    ctx.lineWidth = 2;
    ctx.strokeRect(Math.floor(sx), Math.floor(sy), tw, tw);
    if (selU.tunnelEnd) {
      const ex = camX + selU.tunnelEnd.x * TILE * zoom;
      const ey = camY + selU.tunnelEnd.y * TILE * zoom;
      ctx.strokeStyle = '#FFC107';
      ctx.strokeRect(Math.floor(ex), Math.floor(ey), tw, tw);
    }
  }

  for (const u of units) {
    if (u.goalX !== null) {
      const tx = camX + u.goalX * TILE * zoom, ty = camY + u.goalY * TILE * zoom;
      ctx.beginPath(); ctx.arc(tx, ty, Math.max(4, 3 * zoom), 0, Math.PI * 2);
      ctx.strokeStyle = '#FFEE55'; ctx.lineWidth = 2; ctx.stroke();
    }
    const cx = camX + u.x * TILE * zoom, cy = camY + u.y * TILE * zoom;
    const radius = Math.max(5, 4.5 * zoom);
    if (u.id === selectedUnitId) {
      ctx.beginPath(); ctx.arc(cx, cy, radius + 5, 0, Math.PI * 2);
      ctx.strokeStyle = '#FFEE55'; ctx.lineWidth = 2.5; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#E53935'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx - radius * 0.25, cy - radius * 0.25, radius * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
    if (u.carryingWood) {
      const wr = Math.max(3, 2.5 * zoom);
      ctx.fillStyle = '#A1887F';
      ctx.fillRect(cx + radius * 0.4, cy - wr, wr * 1.8, wr);
      ctx.strokeStyle = '#5D4037'; ctx.lineWidth = 1;
      ctx.strokeRect(cx + radius * 0.4, cy - wr, wr * 1.8, wr);
    }
    if (u.carryingVirelium) {
      const wr = Math.max(3, 2.5 * zoom);
      ctx.fillStyle = '#00E5FF';
      ctx.beginPath();
      ctx.arc(cx + radius * 0.7, cy - radius * 0.2, wr * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#006064'; ctx.lineWidth = 1; ctx.stroke();
    }
  }
}
