// ui.js — bottom bar and info text
function resourceNote(u) {
  const parts = [];
  if (woodInBase > 0 || (u && u.carryingWood))
    parts.push(`Wood: ${u && u.carryingWood ? '1 carried, ' : ''}${woodInBase} base`);
  if (vireliumInBase > 0 || (u && u.carryingVirelium))
    parts.push(`Virelium: ${u && u.carryingVirelium ? '1 carried, ' : ''}${vireliumInBase} base`);
  return parts.length ? '  |  ' + parts.join(' · ') : '';
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

  btnMove.textContent = 'Move'; btnMove.classList.remove('active');
  btnCut.textContent = 'Cut'; btnCut.classList.remove('active');
  btnMine.textContent = 'Mine'; btnMine.classList.remove('active');
  btnTunnel.textContent = 'Tunnel'; btnTunnel.classList.remove('active');
  btnBuild.textContent = 'Build'; btnBuild.classList.remove('active');

  const u = getSelectedUnit();
  const note = resourceNote(u);

  if (selectedBase) {
    mapA.style.display = 'none';
    unitA.style.display = 'none';
    baseA.style.display = 'flex';
    info.textContent = 'Base selected — Train a new character' + note;
  } else if (u) {
    mapA.style.display = 'none';
    unitA.style.display = 'flex';
    baseA.style.display = 'none';
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
      info.textContent = 'Tap a clear spot for an L-shaped base';
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
      info.textContent = 'Building base…';
    } else {
      info.textContent = 'Character selected — choose an action' + note;
    }
  } else {
    mapA.style.display = 'flex';
    unitA.style.display = 'none';
    baseA.style.display = 'none';
    info.textContent = 'Tap a red dot or purple base to select' + note;
  }
}
