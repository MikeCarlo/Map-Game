// landing.js — start screen: pick a map size, or start the tutorial
//
// The game does not generate a world on page load any more; nothing exists
// until startGame() runs. draw()/updateVisibility() both no-op while `map` is
// null, so the loop can spin harmlessly behind the overlay.

let gameStarted = false;

function setMapSize(key) {
  const size = MAP_SIZES[key] || MAP_SIZES[DEFAULT_MAP_SIZE];
  mapSizeKey = MAP_SIZES[key] ? key : DEFAULT_MAP_SIZE;
  MAP_W = size.w;
  MAP_H = size.h;
  invalidateMinimapBuffer(); // its ImageData is sized to the old map
}

function landingEl() { return document.getElementById('landing'); }

function showLanding() {
  gameStarted = false;
  const el = landingEl();
  if (el) el.style.display = 'flex';
  const ui = document.getElementById('ui');
  if (ui) ui.style.visibility = 'hidden';
  const mini = document.getElementById('minimap');
  if (mini) mini.style.display = 'none';
  const info = document.getElementById('info');
  if (info) info.style.display = 'none';
  const cam = document.getElementById('cameraMode');
  if (cam) cam.style.display = 'none';
}

function hideLanding() {
  gameStarted = true;
  const el = landingEl();
  if (el) el.style.display = 'none';
  const ui = document.getElementById('ui');
  if (ui) ui.style.visibility = '';
  const mini = document.getElementById('minimap');
  if (mini) mini.style.display = '';
  const info = document.getElementById('info');
  if (info) info.style.display = '';
  const cam = document.getElementById('cameraMode');
  if (cam) cam.style.display = '';
}

/** Fresh world at the given size. `level` starts a tutorial level instead. */
function startGame(sizeKey, level = null) {
  setMapSize(sizeKey);
  const { baseSpot } = generateMap();
  units = [spawnWorkerBesideBase(baseSpot)];
  selectedUnitId = null; selectedUnitIds = []; fullSelectionIds = [];
  selectedBase = null; selectedArmory = null; selectedHut = null;
  actionMode = null;
  woodInBase = 0; vireliumInBase = 0;
  claimedTrees.clear(); claimedMinerals.clear();
  armories = [];
  deathMarks = [];
  resetDrops();
  resetTraining();
  resetConstruction();
  updateVisibility();
  cameraPanEnabled = true;
  if (typeof updateCameraModeIndicator === 'function') updateCameraModeIndicator();
  if (typeof startTutorialLevel === 'function') startTutorialLevel(level);
  hideLanding();
  resize();
  fitViewToMap();
  updateUI();
  draw();
}

function fitViewToMap() {
  const bottom = uiBottomInset();
  zoom = Math.min((window.innerWidth * 0.9) / (MAP_W * TILE),
                  ((window.innerHeight - bottom) * 0.95) / (MAP_H * TILE));
  camX = (window.innerWidth - MAP_W * TILE * zoom) / 2;
  camY = (window.innerHeight - bottom - MAP_H * TILE * zoom) / 2;
}

function buildLandingSizeButtons() {
  const wrap = document.getElementById('landingSizes');
  if (!wrap) return;
  wrap.innerHTML = '';
  for (const key of Object.keys(MAP_SIZES)) {
    const s = MAP_SIZES[key];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'landing-size';
    b.dataset.size = key;
    b.innerHTML =
      `<span class="landing-size-name">${s.label}</span>` +
      `<span class="landing-size-dim">${s.w} × ${s.h}</span>` +
      `<span class="landing-size-blurb">${s.blurb}</span>`;
    b.addEventListener('click', () => startGame(key));
    wrap.appendChild(b);
  }
}
