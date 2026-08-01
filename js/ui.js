// ui.js — bottom bar and info text
function resourceNote(u) {
  const parts = [];
  if (woodInBase > 0 || (u && u.carryingWood))
    parts.push(`Wood: ${u && u.carryingWood ? '1 carried, ' : ''}${woodInBase} base`);
  if (vireliumInBase > 0 || (u && u.carryingVirelium))
    parts.push(`Virelium: ${u && u.carryingVirelium ? '1 carried, ' : ''}${vireliumInBase} base`);
  return parts.length ? '  |  ' + parts.join(' · ') : '';
}

function workerCapNote() {
  if (!playerBase) return '';
  return `Workers ${units.length} / ${playerBase.maxWorkers}`;
}

function hideAllBars() {
  document.getElementById('mapActions').style.display = 'none';
  document.getElementById('unitActions').style.display = 'none';
  document.getElementById('baseActions').style.display = 'none';
}

function updateUI() {
  const mapA = document.getElementById('mapActions');
  const unitA = document.getElementById('unitActions');
  const baseA = document.getElementById('baseActions');
  const info = document.getElementById('info');
  const btnMove = document.getElementById('btnMove');
  const btnCut = document.getElementById('btnCut');
  const btnMine = document.getElementById('btnMine');
  const btnTunnel = document.getElementById('btnTunnel');
  const btnBuild = document.getElementById('btnBuild');
  const btnTrain = document.getElementById('btnTrain');
  const btnUpgrade = document.getElementById('btnUpgrade');

  btnMove.textContent = 'Move'; btnMove.classList.remove('active');
  btnCut.textContent = 'Cut'; btnCut.classList.remove('active');
  btnMine.textContent = 'Mine'; btnMine.classList.remove('active');
  btnTunnel.textContent = 'Tunnel'; btnTunnel.classList.remove('active');
  btnBuild.textContent = 'Build'; btnBuild.classList.remove('active');

  const u = getSelectedUnit();
  const note = resourceNote(u);

  hideAllBars();

  if (selectedBase) {
    baseA.style.display = 'flex';
    const maxW = playerBase ? playerBase.maxWorkers : 3;
    const level = playerBase ? playerBase.level : 1;
    const atCap = units.length >= maxW;
    btnTrain.textContent = atCap ? `Train (full)` : `Train (${units.length}/${maxW})`;
    btnTrain.disabled = atCap;
    btnUpgrade.textContent = `Upgrade (Lv ${level} → ${level + 1})`;
    info.textContent = `Base Lv ${level} — ${workerCapNote()}${note}`;
  } else if (u) {
    unitA.style.display = 'grid';
    if (actionMode === 'moveTarget') {
      info.textContent = 'Tap a location to move there';
      btnMove.textContent = '✕ Move'; btnMove.classList.add('active');
    } else if (actionMode === 'cutTarget') {
      info.textContent = 'Tap a tree to start cutting';
      btnCut.textContent = '✕ Cut'; btnCut.classList.add('active');
    } else if (actionMode === 'mineTarget') {
      info.textContent = 'Tap a Virelium deposit (cyan) to mine';
      btnMine.textContent = '✕ Mine'; btnMine.classList.add('active');
    } else if (actionMode === 'tunnelStart') {
      info.textContent = 'Tunnel: tap START point (on or next to mountain)';
      btnTunnel.textContent = '✕ Tunnel'; btnTunnel.classList.add('active');
    } else if (actionMode === 'tunnelEnd') {
      info.textContent = 'Tunnel: tap END point (path will be carved through rock)';
      btnTunnel.textContent = '✕ Tunnel'; btnTunnel.classList.add('active');
    } else if (actionMode === 'buildTarget') {
      info.textContent = 'Tap a clear 3×3 spot to expand the base (+3 workers)';
      btnBuild.textContent = '✕ Build'; btnBuild.classList.add('active');
    } else if (u.harvesting) {
      if (u.returningToBase && u.carryingWood)
        info.textContent = 'Carrying wood → returning to base…' + note;
      else if (u.carryingWood)
        info.textContent = 'Carrying wood' + note;
      else
        info.textContent = 'Harvesting trees…' + note;
    } else if (u.mining) {
      if (u.returningMineral && u.carryingVirelium)
        info.textContent = 'Carrying Virelium → returning to base…' + note;
      else if (u.carryingVirelium)
        info.textContent = 'Carrying Virelium' + note;
      else
        info.textContent = 'Mining Virelium…' + note;
    } else if (u.tunneling) {
      info.textContent = 'Tunneling through the mountain…';
    } else if (u.building) {
      info.textContent = 'Expanding base…';
    } else {
      info.textContent = 'Character selected — choose an action' + note;
    }
  } else {
    mapA.style.display = 'flex';
    const cap = playerBase ? ` — ${workerCapNote()}` : '';
    info.textContent = 'Tap a red dot or purple base to select' + cap + note;
  }
}
