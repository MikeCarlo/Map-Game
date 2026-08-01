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
    const expand = 1 - Math.pow(1 - t, 2);
    const maxR = (p.radius + 1.2) * TILE * zoom;
    const minR = TILE * zoom * 0.4;
    const r = minR + (maxR - minR) * expand;
    const alpha = (1 - t) * (0.35 + 0.15 * Math.min(1, p.amount / 6));
    const cx = camX + p.x * TILE * zoom;
    const cy = camY + p.y * TILE * zoom;

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(0, 229, 255, ${alpha * 0.9})`;
    ctx.lineWidth = Math.max(1.5, 2.5 * zoom * (1 - t * 0.5));
    ctx.stroke();

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

function drawBoxSelect() {
  if (!boxSelectActive || !boxSelectStart || !boxSelectCurrent) return;
  const x = Math.min(boxSelectStart.x, boxSelectCurrent.x);
  const y = Math.min(boxSelectStart.y, boxSelectCurrent.y);
  const w = Math.abs(boxSelectCurrent.x - boxSelectStart.x);
  const h = Math.abs(boxSelectCurrent.y - boxSelectStart.y);
  ctx.fillStyle = 'rgba(255, 238, 85, 0.12)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255, 238, 85, 0.85)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);

  let count = 0;
  for (const u of units) {
    if (u.unitType === 'enemy') continue;
    const sx = camX + u.x * TILE * zoom;
    const sy = camY + u.y * TILE * zoom;
    if (sx >= x && sx <= x + w && sy >= y && sy <= y + h) count++;
  }
  if (count > 0) {
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillStyle = '#FFEE55';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 3;
    const label = String(count);
    ctx.strokeText(label, x + 6, y + 16);
    ctx.fillText(label, x + 6, y + 16);
  }
}

function drawSelectModeFrame() {
  if (cameraPanEnabled) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const ui = document.getElementById('ui');
  const bottom = ui ? Math.max(0, h - ui.getBoundingClientRect().top) : 64;
  const inset = 3;
  const x = inset;
  const y = inset;
  const fw = w - inset * 2;
  const fh = h - bottom - inset * 2;
  if (fw <= 0 || fh <= 0) return;

  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(160, 160, 160, 0.85)';
  ctx.setLineDash([10, 6]);
  ctx.strokeRect(x + 0.5, y + 0.5, fw - 1, fh - 1);
  ctx.strokeStyle = 'rgba(120, 120, 120, 0.55)';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 4]);
  ctx.strokeRect(x + 4.5, y + 4.5, fw - 9, fh - 9);
  ctx.setLineDash([]);
  ctx.restore();
}

function drawHpBar(cx, cy, radius, hp, maxHp) {
  if (hp == null || maxHp == null || hp >= maxHp) return;
  const bw = Math.max(12, radius * 2.2);
  const bh = Math.max(3, 2.5 * zoom);
  const bx = cx - bw / 2;
  const by = cy - radius - bh - 3;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(bx, by, bw, bh);
  const pct = Math.max(0, hp / maxHp);
  ctx.fillStyle = pct > 0.5 ? '#66BB6A' : pct > 0.25 ? '#FFA726' : '#EF5350';
  ctx.fillRect(bx, by, bw * pct, bh);
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

  // Hut HP bars above hut origin
  for (const hut of huts) {
    const hx = camX + (hut.x + HUT_SIZE / 2) * TILE * zoom;
    const hy = camY + hut.y * TILE * zoom;
    const bw = HUT_SIZE * TILE * zoom * 0.9;
    const bh = Math.max(3, 3 * zoom);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(hx - bw / 2, hy - 6, bw, bh);
    const pct = Math.max(0, hut.hp / hut.maxHp);
    ctx.fillStyle = '#EF5350';
    ctx.fillRect(hx - bw / 2, hy - 6, bw * pct, bh);
  }

  if (selectedBase) {
    const sx = camX + selectedBase.x * TILE * zoom;
    const sy = camY + selectedBase.y * TILE * zoom;
    ctx.strokeStyle = '#CE93D8';
    ctx.lineWidth = 2;
    ctx.strokeRect(Math.floor(sx), Math.floor(sy), Math.ceil(TILE * zoom), Math.ceil(TILE * zoom));
  }

  if (selectedArmory) {
    const sx = camX + selectedArmory.x * TILE * zoom;
    const sy = camY + selectedArmory.y * TILE * zoom;
    const size = ARMORY_SIZE * TILE * zoom;
    ctx.strokeStyle = '#FF8A80';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(Math.floor(sx), Math.floor(sy), Math.ceil(size), Math.ceil(size));
  }

  if (selectedHut) {
    const sx = camX + selectedHut.x * TILE * zoom;
    const sy = camY + selectedHut.y * TILE * zoom;
    const size = HUT_SIZE * TILE * zoom;
    ctx.strokeStyle = '#FF7043';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(Math.floor(sx), Math.floor(sy), Math.ceil(size), Math.ceil(size));
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

  const pulse = 0.55 + 0.45 * Math.sin(performance.now() / 220);

  for (const u of units) {
    if (u.goalX !== null && u.unitType !== 'enemy') {
      const tx = camX + u.goalX * TILE * zoom, ty = camY + u.goalY * TILE * zoom;
      ctx.beginPath(); ctx.arc(tx, ty, Math.max(4, 3 * zoom), 0, Math.PI * 2);
      ctx.strokeStyle = '#FFEE55'; ctx.lineWidth = 2; ctx.stroke();
    }
    const cx = camX + u.x * TILE * zoom, cy = camY + u.y * TILE * zoom;
    const radius = Math.max(5, 4.5 * zoom);
    if (isUnitSelected(u.id)) {
      ctx.beginPath(); ctx.arc(cx, cy, radius + 4 + pulse * 2, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 238, 85, ${0.55 + pulse * 0.4})`;
      ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, radius + 8 + pulse * 3, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 238, 85, ${0.2 + pulse * 0.2})`;
      ctx.lineWidth = 1.5; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    if (u.unitType === 'enemy') ctx.fillStyle = '#43A047';
    else if (u.unitType === 'soldier') ctx.fillStyle = '#37474F';
    else ctx.fillStyle = '#E53935';
    ctx.fill();
    if (u.unitType === 'soldier') {
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.55, 0, Math.PI * 2);
      ctx.strokeStyle = '#90A4AE';
      ctx.lineWidth = Math.max(1, zoom);
      ctx.stroke();
    } else if (u.unitType === 'enemy') {
      // fangs / eyes
      ctx.fillStyle = '#1B5E20';
      ctx.beginPath();
      ctx.arc(cx - radius * 0.3, cy - radius * 0.15, radius * 0.22, 0, Math.PI * 2);
      ctx.arc(cx + radius * 0.3, cy - radius * 0.15, radius * 0.22, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(cx - radius * 0.25, cy - radius * 0.25, radius * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
    }
    if (u.hp != null && u.maxHp != null) drawHpBar(cx, cy, radius, u.hp, u.maxHp);
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

  drawBoxSelect();
  drawSelectModeFrame();
}
