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
  return `Workers ${countWorkers()} / ${playerBase.maxWorkers}`;
}

function soldierCapNote() {
  const max = maxSoldiers();
  if (max <= 0) return 'Soldiers 0 / 0';
  return `Soldiers ${countSoldiers()} / ${max}`;
}

function hideAllBars() {
  ['mapActions', 'unitActions', 'soldierActions', 'buildMenu', 'baseActions', 'armoryActions', 'groupActions', 'selectionFilters']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
}

function selectionSummary(list) {
  const w = list.filter(u => u.unitType === 'worker').length;
  const s = list.filter(u => u.unitType === 'soldier').length;
  const parts = [];
  if (w) parts.push(`${w} Worker${w > 1 ? 's' : ''}`);
  if (s) parts.push(`${s} Soldier${s > 1 ? 's' : ''}`);
  return parts.join(' + ') || '0 units';
}

function updateFilterChips(list) {
  const bar = document.getElementById('selectionFilters');
  if (!bar) return;
  const full = fullSelectionIds.length
    ? units.filter(u => fullSelectionIds.includes(u.id))
    : list;
  const hasW = full.some(u => u.unitType === 'worker');
  const hasS = full.some(u => u.unitType === 'soldier');
  const show = list.length > 1 || (full.length > 1 && (hasW && hasS));
  if (!show && !(hasW && hasS && full.length > 1)) {
    bar.style.display = 'none';
    return;
  }
  if (!(hasW && hasS)) {
    // Still show count chips for pure groups as read-only style? hide if not mixed
    bar.style.display = hasW && hasS ? 'flex' : 'none';
    if (!(hasW && hasS)) return;
  }
  bar.style.display = 'flex';
  const all = document.getElementById('filterAll');
  const fw = document.getElementById('filterWorkers');
  const fs = document.getElementById('filterSoldiers');
  [all, fw, fs].forEach(b => b && b.classList.remove('active'));
  if (selectionFilter === 'worker' && fw) fw.classList.add('active');
  else if (selectionFilter === 'soldier' && fs) fs.classList.add('active');
  else if (all) all.classList.add('active');
  const wc = full.filter(u => u.unitType === 'worker').length;
  const sc = full.filter(u => u.unitType === 'soldier').length;
  if (fw) { fw.style.display = hasW ? '' : 'none'; fw.textContent = `Workers (${wc})`; }
  if (fs) { fs.style.display = hasS ? '' : 'none'; fs.textContent = `Soldiers (${sc})`; }
  if (all) all.textContent = `All (${full.length})`;
}

function updateUI() {
  const info = document.getElementById('info');
  const btnMove = document.getElementById('btnMove');
  const btnCut = document.getElementById('btnCut');
  const btnMine = document.getElementById('btnMine');
  const btnTunnel = document.getElementById('btnTunnel');
  const btnBuild = document.getElementById('btnBuild');
  const btnTrain = document.getElementById('btnTrain');
  const btnUpgrade = document.getElementById('btnUpgrade');
  const btnTrainSoldier = document.getElementById('btnTrainSoldier');
  const btnSoldierMove = document.getElementById('btnSoldierMove');
  const btnGroupMove = document.getElementById('btnGroupMove');
  const btnGroupCut = document.getElementById('btnGroupCut');
  const btnGroupMine = document.getElementById('btnGroupMine');

  btnMove.textContent = 'Move'; btnMove.classList.remove('active');
  btnCut.textContent = 'Cut'; btnCut.classList.remove('active');
  btnMine.textContent = 'Mine'; btnMine.classList.remove('active');
  btnTunnel.textContent = 'Tunnel'; btnTunnel.classList.remove('active');
  btnBuild.textContent = 'Build'; btnBuild.classList.remove('active');
  if (btnSoldierMove) { btnSoldierMove.textContent = 'Move'; btnSoldierMove.classList.remove('active'); }
  if (btnGroupMove) { btnGroupMove.textContent = 'Move'; btnGroupMove.classList.remove('active'); }
  if (btnGroupCut) { btnGroupCut.textContent = 'Cut'; btnGroupCut.classList.remove('active'); }
  if (btnGroupMine) { btnGroupMine.textContent = 'Mine'; btnGroupMine.classList.remove('active'); }

  const selected = getSelectedUnits();
  const u = selected.length === 1 ? selected[0] : null;
  const note = resourceNote(u || selected[0]);
  const modeHint = cameraPanEnabled ? '' : ' [SELECT]';

  hideAllBars();

  if (actionMode === 'buildMenu' && u && u.unitType === 'worker') {
    document.getElementById('buildMenu').style.display = 'flex';
    info.textContent = 'Build: choose Base or Armory';
    return;
  }

  if (selectedArmory) {
    document.getElementById('armoryActions').style.display = 'flex';
    const maxS = maxSoldiers();
    const curS = countSoldiers();
    const atCap = curS >= maxS;
    btnTrainSoldier.textContent = atCap ? `Train Soldier (full)` : `Train Soldier (${curS}/${maxS})`;
    btnTrainSoldier.disabled = atCap || armories.length === 0;
    info.textContent = `Armory — ${soldierCapNote()}${note}`;
    return;
  }

  if (selectedBase) {
    document.getElementById('baseActions').style.display = 'flex';
    const maxW = playerBase ? playerBase.maxWorkers : 3;
    const level = playerBase ? playerBase.level : 1;
    const workers = countWorkers();
    const atCap = workers >= maxW;
    btnTrain.textContent = atCap ? `Train (full)` : `Train (${workers}/${maxW})`;
    btnTrain.disabled = atCap;
    btnUpgrade.textContent = `Upgrade (Lv ${level} → ${level + 1})`;
    info.textContent = `Base Lv ${level} — ${workerCapNote()}${note}`;
    return;
  }

  // Multi-select / group
  if (selected.length > 1) {
    const comp = selectionComposition(selected);
    document.getElementById('groupActions').style.display = 'flex';
    updateFilterChips(selected);

    // Show Cut/Mine only when selection is all workers
    if (btnGroupCut) btnGroupCut.style.display = comp.allWorkers ? '' : 'none';
    if (btnGroupMine) btnGroupMine.style.display = comp.allWorkers ? '' : 'none';

    if (actionMode === 'moveTarget') {
      info.textContent = `Move ${selectionSummary(selected)} — tap destination`;
      if (btnGroupMove) { btnGroupMove.textContent = '✕ Move'; btnGroupMove.classList.add('active'); }
    } else if (actionMode === 'cutTarget') {
      info.textContent = `Group Cut — tap a forest area (${selectionSummary(selected)})`;
      if (btnGroupCut) { btnGroupCut.textContent = '✕ Cut'; btnGroupCut.classList.add('active'); }
    } else if (actionMode === 'mineTarget') {
      info.textContent = `Group Mine — tap Virelium area (${selectionSummary(selected)})`;
      if (btnGroupMine) { btnGroupMine.textContent = '✕ Mine'; btnGroupMine.classList.add('active'); }
    } else if (comp.allWorkers) {
      info.textContent = `${selectionSummary(selected)} — Move / Cut / Mine${modeHint}`;
    } else if (comp.allSoldiers) {
      info.textContent = `${selectionSummary(selected)} — Move${modeHint}`;
    } else {
      info.textContent = `Mixed ${selectionSummary(selected)} — Move only (or filter type)${modeHint}`;
    }
    return;
  }

  if (u && u.unitType === 'soldier') {
    document.getElementById('soldierActions').style.display = 'flex';
    if (actionMode === 'moveTarget') {
      info.textContent = 'Tap a location to move the soldier';
      btnSoldierMove.textContent = '✕ Move';
      btnSoldierMove.classList.add('active');
    } else {
      info.textContent = 'Soldier — Move (double-tap for nearby soldiers)' + modeHint;
    }
    return;
  }

  if (u) {
    document.getElementById('unitActions').style.display = 'grid';
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
    } else if (actionMode === 'buildBaseTarget') {
      info.textContent = 'Tap a clear 3×3 spot to expand the base (+3 workers)';
      btnBuild.textContent = '✕ Base'; btnBuild.classList.add('active');
    } else if (actionMode === 'buildArmoryTarget') {
      info.textContent = 'Tap a clear 2×2 spot to build an Armory (+5 soldiers)';
      btnBuild.textContent = '✕ Armory'; btnBuild.classList.add('active');
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
      info.textContent = u.buildKind === 'armory' ? 'Building armory…' : 'Expanding base…';
    } else {
      info.textContent = 'Worker — actions (double-tap for nearby workers)' + note + modeHint;
    }
    return;
  }

  document.getElementById('mapActions').style.display = 'flex';
  const parts = [];
  if (playerBase) parts.push(workerCapNote());
  if (armories.length) parts.push(soldierCapNote());
  const cap = parts.length ? ' — ' + parts.join(' · ') : '';
  const panHint = cameraPanEnabled
    ? 'Double-tap empty = lock camera · Double-tap unit = select similar'
    : 'SELECT: long-press drag box · Double-tap empty = unlock pan';
  info.textContent = panHint + cap + note;
}
