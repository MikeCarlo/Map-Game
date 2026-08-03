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
    if (!isPointVisible(p.x, p.y)) continue;
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

function drawDeathMarks() {
  if (!deathMarks || !deathMarks.length) return;
  for (const m of deathMarks) {
    if (!isPointVisible(m.x, m.y)) continue;
    const t = Math.min(1, m.age / m.maxAge);
    const alpha = (1 - t) * 0.45;
    if (alpha <= 0.01) continue;
    const cx = camX + m.x * TILE * zoom;
    const cy = camY + m.y * TILE * zoom;
    const radius = Math.max(5, 4.5 * zoom) * (1 - t * 0.15);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(180, 180, 185, ${alpha})`;
    ctx.fill();
  }
}

/**
 * Defend posts: a marker per defending soldier, plus the guard radius for the
 * selected ones so the player can see what ground is covered.
 */
function drawDefendPosts(pulse) {
  for (const u of units) {
    if (!u.defending || u.defendX == null) continue;
    const px = camX + u.defendX * TILE * zoom;
    const py = camY + u.defendY * TILE * zoom;
    const selected = isUnitSelected(u.id);

    if (selected) {
      ctx.beginPath();
      ctx.arc(px, py, DEFEND_RADIUS * TILE * zoom, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(66, 165, 245, ${0.05 + pulse * 0.03})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(66, 165, 245, ${0.35 + pulse * 0.2})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const r = Math.max(4, 3 * zoom);
    ctx.beginPath();
    ctx.moveTo(px, py - r);
    ctx.lineTo(px + r, py);
    ctx.lineTo(px, py + r);
    ctx.lineTo(px - r, py);
    ctx.closePath();
    ctx.fillStyle = `rgba(66, 165, 245, ${selected ? 0.55 : 0.3})`;
    ctx.fill();
    ctx.strokeStyle = '#42A5F5';
    ctx.lineWidth = 2;
    ctx.stroke();

    // tether from the soldier back to its post while it is away
    if (Math.hypot(u.x - u.defendX, u.y - u.defendY) > DEFEND_POST_SLACK) {
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(camX + u.x * TILE * zoom, camY + u.y * TILE * zoom);
      ctx.strokeStyle = 'rgba(66, 165, 245, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

/** Draw unit body as a pie-arc: full circle at full HP, half circle at 50%, etc. */
/** Radial progress dial centred on a footprint of `size` tiles at (ox, oy) */
function drawProgressDial(ox, oy, size, pct, color, label) {
  const box = size * TILE * zoom;
  const cx = camX + (ox + size / 2) * TILE * zoom;
  const cy = camY + (oy + size / 2) * TILE * zoom;
  const r = Math.max(5, box * 0.3); // stays visible zoomed out, still fits the footprint
  const ring = Math.max(2, r * 0.32);

  // dark disc so the dial reads over any building color
  ctx.beginPath();
  ctx.arc(cx, cy, r + ring * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fill();

  // unfilled track
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = ring;
  ctx.stroke();

  // progress sweep, clockwise from 12 o'clock
  if (pct > 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
    ctx.strokeStyle = color;
    ctx.lineWidth = ring;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  if (label && r > 9) {
    ctx.fillStyle = '#FFF';
    ctx.font = `bold ${Math.max(8, Math.round(r * 0.9))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, cy + 0.5);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}

/** Dial in the middle of every building that is training */
function drawTrainingDials() {
  if (typeof trainingJobs === 'undefined' || !trainingJobs.length) return;
  const drawn = new Set();
  for (const job of trainingJobs) {
    if (drawn.has(job.key)) continue; // one active job per building
    drawn.add(job.key);
    const color = job.blocked ? '#FF7043' : (job.unitType === 'soldier' ? '#FF8A80' : '#E1BEE7');
    const queued = trainingQueueLength(job.key) - 1;
    drawProgressDial(job.ox, job.oy, job.size, trainingProgress(job), color,
      queued > 0 ? `+${queued}` : '');
  }
}

/** Ground marked out for a building that is still going up */
function drawConstructionSites() {
  if (typeof constructionSites !== 'function') return;
  const t = TILE * zoom;
  for (const s of constructionSites()) {
    const sx = camX + s.x * t, sy = camY + s.y * t;
    const box = s.size * t;
    ctx.fillStyle = 'rgba(255, 183, 77, 0.18)';
    ctx.fillRect(Math.floor(sx), Math.floor(sy), Math.ceil(box), Math.ceil(box));
    ctx.save();
    ctx.setLineDash([Math.max(3, 2 * zoom), Math.max(3, 2 * zoom)]);
    ctx.strokeStyle = s.kind === 'armory' ? '#FF8A80' : '#CE93D8';
    ctx.lineWidth = 2;
    ctx.strokeRect(Math.floor(sx) + 1, Math.floor(sy) + 1, Math.ceil(box) - 2, Math.ceil(box) - 2);
    ctx.restore();
  }
}

/** Progress dial for each site, drawn over the units */
function drawConstructionDials() {
  if (typeof constructionSites !== 'function') return;
  for (const s of constructionSites()) {
    drawProgressDial(s.x, s.y, s.size, s.pct, '#FFB74D', '');
  }
}

function drawUnitBody(cx, cy, radius, fillStyle, hp, maxHp) {
  const pct = (hp != null && maxHp > 0)
    ? Math.max(0.08, Math.min(1, hp / maxHp))
    : 1;
  ctx.fillStyle = fillStyle;
  if (pct >= 0.999) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  // Arc from top (-PI/2), clockwise through pct of full circle
  const start = -Math.PI / 2;
  const end = start + pct * Math.PI * 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, radius, start, end, false);
  ctx.closePath();
  ctx.fill();
  // Soft outline so the missing slice is readable
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
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
      const sxU = camX + tx * TILE * zoom, syU = camY + ty * TILE * zoom;
      const twU = Math.ceil(TILE * zoom), thU = Math.ceil(TILE * zoom);
      if (!isTileExplored(tx, ty)) {
        ctx.fillStyle = FOG_UNEXPLORED_COLOR;
        ctx.fillRect(Math.floor(sxU), Math.floor(syU), twU, thU);
        continue;
      }
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
      // Explored but out of sight: remembered terrain, shaded
      if (!isTileVisible(tx, ty)) {
        ctx.fillStyle = `rgba(0, 0, 0, ${FOG_DIM_ALPHA})`;
        ctx.fillRect(Math.floor(sx), Math.floor(sy), tw, th);
      }
    }
  }

  drawJetPulses();
  drawDeathMarks();

  // Hut damage: darken slightly instead of a bar
  for (const hut of huts) {
    const stats = hutHealthStats(hut);
    if (stats.max <= 0 || stats.cur >= stats.max) continue;
    const pct = Math.max(0, stats.cur / stats.max);
    const size = TILE * zoom;
    ctx.fillStyle = `rgba(0,0,0,${(1 - pct) * 0.35})`;
    for (const t of liveTilesInFootprint(hut.x, hut.y, HUT_FOOTPRINT)) {
      if (!isTileVisible(t.x, t.y)) continue; // damage state is live information
      const sx = camX + t.x * TILE * zoom;
      const sy = camY + t.y * TILE * zoom;
      ctx.fillRect(Math.floor(sx), Math.floor(sy), Math.ceil(size), Math.ceil(size));
    }
  }

  drawConstructionSites();

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

  if (selectedHut && isTileExplored(selectedHut.x, selectedHut.y)) {
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

  drawDefendPosts(pulse);

  for (const u of units) {
    if (!isUnitRevealed(u)) continue; // enemies only where you can see
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

    let fill = '#E53935';
    if (u.unitType === 'enemy') fill = '#43A047';
    else if (u.unitType === 'soldier') fill = '#37474F';

    drawUnitBody(cx, cy, radius, fill, u.hp, u.maxHp);

    if (u.unitType === 'soldier') {
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.55, 0, Math.PI * 2);
      ctx.strokeStyle = u.defending ? '#42A5F5' : '#90A4AE';
      ctx.lineWidth = Math.max(1, zoom);
      ctx.stroke();
    } else if (u.unitType === 'enemy') {
      ctx.fillStyle = '#1B5E20';
      ctx.beginPath();
      ctx.arc(cx - radius * 0.3, cy - radius * 0.15, radius * 0.22, 0, Math.PI * 2);
      ctx.arc(cx + radius * 0.3, cy - radius * 0.15, radius * 0.22, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(cx - radius * 0.25, cy - radius * 0.25, radius * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
    }
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

  // dials last so the builder never hides its own progress
  drawConstructionDials();
  drawTrainingDials();

  drawBoxSelect();
  drawSelectModeFrame();
  if (typeof drawMinimap === 'function') drawMinimap();
}
