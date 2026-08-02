// minimap.js — overview of the ground you have explored, with tap-to-jump
//
// The terrain layer is built as a 1 px-per-tile ImageData (MAP_W × MAP_H) and
// blown up with smoothing off, so it stays cheap no matter the display size.
// Units and the viewport box are drawn on top at display scale.

const MINIMAP_RES = 256;          // device pixels of the visible canvas
const MINIMAP_VIRELIUM = '#00BCD4';
const MINIMAP_JET = '#00E5FF';

let minimapCanvas = null, minimapCtx = null;
let minimapBuffer = null, minimapBufferCtx = null, minimapImage = null, minimapPixels = null;
let minimapLit = null, minimapDim = null;   // Uint32 palettes indexed by tile id
let minimapVireliumLit = 0, minimapVireliumDim = 0, minimapUnknown = 0;

const MINIMAP_LITTLE_ENDIAN = (function () {
  const buf = new ArrayBuffer(4);
  new Uint32Array(buf)[0] = 0x11223344;
  return new Uint8Array(buf)[0] === 0x44;
})();

function packColor(hex, scale = 1) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  const r = Math.round(((n >> 16) & 255) * scale);
  const g = Math.round(((n >> 8) & 255) * scale);
  const b = Math.round((n & 255) * scale);
  return MINIMAP_LITTLE_ENDIAN
    ? (((255 << 24) | (b << 16) | (g << 8) | r) >>> 0)
    : (((r << 24) | (g << 16) | (b << 8) | 255) >>> 0);
}

/** One flat colour per tile type — per-tile shading is invisible at this size. */
function buildMinimapPalettes() {
  const dim = 1 - FOG_DIM_ALPHA;
  const ids = Object.keys(COLORS).map(Number);
  const maxId = Math.max(...ids, TILE_HUT);
  minimapLit = new Uint32Array(maxId + 1);
  minimapDim = new Uint32Array(maxId + 1);
  for (const id of ids) {
    const hex = id === TILE_JET ? MINIMAP_JET : COLORS[id];
    minimapLit[id] = packColor(hex);
    minimapDim[id] = packColor(hex, dim);
  }
  minimapVireliumLit = packColor(MINIMAP_VIRELIUM);
  minimapVireliumDim = packColor(MINIMAP_VIRELIUM, dim);
  minimapUnknown = packColor(FOG_UNEXPLORED_COLOR);
}

function ensureMinimap() {
  if (minimapCtx) return true;
  minimapCanvas = document.getElementById('minimap');
  if (!minimapCanvas) return false;
  minimapCanvas.width = MINIMAP_RES;
  minimapCanvas.height = MINIMAP_RES;
  minimapCtx = minimapCanvas.getContext('2d');
  minimapCtx.imageSmoothingEnabled = false;
  minimapBuffer = document.createElement('canvas');
  minimapBuffer.width = MAP_W;
  minimapBuffer.height = MAP_H;
  minimapBufferCtx = minimapBuffer.getContext('2d');
  minimapImage = minimapBufferCtx.createImageData(MAP_W, MAP_H);
  minimapPixels = new Uint32Array(minimapImage.data.buffer);
  buildMinimapPalettes();
  return true;
}

function drawMinimapTerrain() {
  for (let y = 0; y < MAP_H; y++) {
    const row = y * MAP_W;
    for (let x = 0; x < MAP_W; x++) {
      const i = row + x;
      if (!isTileExplored(x, y)) { minimapPixels[i] = minimapUnknown; continue; }
      const lit = isTileVisible(x, y);
      const tile = map[y][x];
      if (mineralMap[y][x] > 0 && (tile === TILE_DIRT || tile === TILE_STUMP)) {
        minimapPixels[i] = lit ? minimapVireliumLit : minimapVireliumDim;
      } else {
        minimapPixels[i] = lit ? minimapLit[tile] : minimapDim[tile];
      }
    }
  }
  minimapBufferCtx.putImageData(minimapImage, 0, 0);
}

/** Rectangle of the world the camera is currently showing, in minimap pixels. */
function minimapViewportRect(scale) {
  const bottom = typeof uiPanelTop === 'function' ? uiPanelTop() : window.innerHeight;
  const x0 = (-camX) / (TILE * zoom), y0 = (-camY) / (TILE * zoom);
  const x1 = (window.innerWidth - camX) / (TILE * zoom);
  const y1 = (bottom - camY) / (TILE * zoom);
  return {
    x: x0 * scale, y: y0 * scale,
    w: Math.max(2, (x1 - x0) * scale), h: Math.max(2, (y1 - y0) * scale)
  };
}

function drawMinimap() {
  if (!map || !ensureMinimap()) return;
  const scale = MINIMAP_RES / MAP_W;

  drawMinimapTerrain();
  minimapCtx.clearRect(0, 0, MINIMAP_RES, MINIMAP_RES);
  minimapCtx.drawImage(minimapBuffer, 0, 0, MINIMAP_RES, MINIMAP_RES);

  const dot = Math.max(3, scale * 1.6);
  for (const u of units) {
    if (!isUnitRevealed(u)) continue;
    minimapCtx.fillStyle = u.unitType === 'enemy' ? '#66BB6A'
      : u.unitType === 'soldier' ? '#ECEFF1' : '#FF5252';
    minimapCtx.fillRect(u.x * scale - dot / 2, u.y * scale - dot / 2, dot, dot);
  }

  // selection highlight so you can find the units you are commanding
  for (const u of units) {
    if (!isUnitSelected(u.id)) continue;
    minimapCtx.strokeStyle = '#FFEE55';
    minimapCtx.lineWidth = 1.5;
    minimapCtx.strokeRect(u.x * scale - dot, u.y * scale - dot, dot * 2, dot * 2);
  }

  const vp = minimapViewportRect(scale);
  minimapCtx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  minimapCtx.lineWidth = 2;
  minimapCtx.strokeRect(vp.x, vp.y, vp.w, vp.h);
}

/** Tap the minimap to centre the camera on that spot. */
function minimapJumpTo(clientX, clientY) {
  if (!minimapCanvas) return;
  const r = minimapCanvas.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const tx = Math.max(0, Math.min(MAP_W, ((clientX - r.left) / r.width) * MAP_W));
  const ty = Math.max(0, Math.min(MAP_H, ((clientY - r.top) / r.height) * MAP_H));
  const bottom = typeof uiPanelTop === 'function' ? uiPanelTop() : window.innerHeight;
  camX = window.innerWidth / 2 - tx * TILE * zoom;
  camY = bottom / 2 - ty * TILE * zoom;
  draw();
}

(function bindMinimap() {
  const el = document.getElementById('minimap');
  if (!el) return;
  const onDown = e => {
    e.preventDefault();
    e.stopPropagation();
    minimapJumpTo(e.clientX, e.clientY);
  };
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', e => {
    if (e.buttons) onDown(e);   // drag to scrub across the map
  });
})();
