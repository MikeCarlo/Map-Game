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
  if (!(hasW && hasS)) {
    bar.style.display = 'none';
    return;
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
  const btnSoldierAttack = document.getElementById('btnSoldierAttack');
  const btnGroupMove = document.getElementById('btnGroupMove');
  const btnGroupCut = document.getElementById('btnGroupCut');
  const btnGroupMine = document.getElementById('btnGroupMine');
  const btnGroupAttack = document.getElementById('btnGroupAttack');
  const btnSoldierDefend = document.getElementById('btnSoldierDefend');
  const btnGroupDefend = document.getElementById('btnGroupDefend');

  btnMove.textContent = 'Move'; btnMove.classList.remove('active');
  btnCut.textContent = 'Cut'; btnCut.classList.remove('active');
  btnMine.textContent = 'Mine'; btnMine.classList.remove('active');
  btnTunnel.textContent = 'Tunnel'; btnTunnel.classList.remove('active');
  btnBuild.textContent = 'Build'; btnBuild.classList.remove('active');
  if (btnSoldierMove) { btnSoldierMove.textContent = 'Move'; btnSoldierMove.classList.remove('active'); }
  if (btnSoldierAttack) { btnSoldierAttack.textContent = 'Attack'; btnSoldierAttack.classList.remove('active'); }
  if (btnGroupMove) { btnGroupMove.textContent = 'Move'; btnGroupMove.classList.remove('active'); }
  if (btnGroupCut) { btnGroupCut.textContent = 'Cut'; btnGroupCut.classList.remove('active'); }
  if (btnGroupMine) { btnGroupMine.textContent = 'Mine'; btnGroupMine.classList.remove('active'); }
  if (btnGroupAttack) { btnGroupAttack.textContent = 'Attack'; btnGroupAttack.classList.remove('active'); }
  if (btnSoldierDefend) { btnSoldierDefend.textContent = 'Defend'; btnSoldierDefend.classList.remove('active'); }
  if (btnGroupDefend) { btnGroupDefend.textContent = 'Defend'; btnGroupDefend.classList.remove('active'); }

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

  if (selectedHut) {
    const h = findHutAt(selectedHut.x, selectedHut.y);
    document.getElementById('mapActions').style.display = 'flex';
    if (h && isTileVisible(h.x, h.y)) {
      const st = hutHealthStats(h);
      info.textContent = `Enemy Hut — HP ${st.cur}/${st.max} · Enemies ${countVisibleEnemies()}`;
    }
    else if (h) info.textContent = 'Enemy Hut — out of sight (last known position)';
    else info.textContent = 'Enemy hut destroyed';
    return;
  }

  if (selectedArmory) {
    document.getElementById('armoryActions').style.display = 'flex';
    const key = trainingKeyForArmory(selectedArmory);
    const queued = trainingQueueLength(key);
    const maxS = maxSoldiers();
    const curS = countSoldiers();
    const atCap = trainingCapReached('soldier');
    const queueFull = queued >= TRAIN_QUEUE_MAX;
    btnTrainSoldier.textContent = atCap
      ? `Train Soldier (full)`
      : `Train Soldier (${curS + queued}/${maxS})`;
    btnTrainSoldier.disabled = atCap || queueFull || armories.length === 0;
    const btnCancelTrainSoldier = document.getElementById('btnCancelTrainSoldier');
    if (btnCancelTrainSoldier) {
      btnCancelTrainSoldier.style.display = queued ? '' : 'none';
      btnCancelTrainSoldier.textContent = `✕ Queue (${queued})`;
    }
    info.textContent = `Armory — ${soldierCapNote()}${trainingNote(key)}${note}`;
    return;
  }

  if (selectedBase) {
    document.getElementById('baseActions').style.display = 'flex';
    const key = trainingKeyForBase();
    const queued = trainingQueueLength(key);
    const maxW = playerBase ? playerBase.maxWorkers : 3;
    const level = playerBase ? playerBase.level : 1;
    const workers = countWorkers();
    const atCap = trainingCapReached('worker');
    const queueFull = queued >= TRAIN_QUEUE_MAX;
    btnTrain.textContent = atCap ? `Train (full)` : `Train (${workers + queued}/${maxW})`;
    btnTrain.disabled = atCap || queueFull;
    const btnCancelTrain = document.getElementById('btnCancelTrain');
    if (btnCancelTrain) {
      btnCancelTrain.style.display = queued ? '' : 'none';
      btnCancelTrain.textContent = `✕ Queue (${queued})`;
    }
    btnUpgrade.classList.remove('active');
    if (baseUpgrade) {
      btnUpgrade.textContent = `✕ Upgrading ${Math.round(baseUpgradeProgress() * 100)}%`;
      btnUpgrade.classList.add('active');
    } else {
      btnUpgrade.textContent = `Upgrade (Lv ${level} → ${level + 1})`;
    }
    const upNote = baseUpgrade
      ? ` · Expansion ${Math.round(baseUpgradeProgress() * 100)}%`
      : '';
    info.textContent = `Base Lv ${level} — ${workerCapNote()}${trainingNote(key)}${upNote}${note}`;
    return;
  }

  if (selected.length > 1) {
    const comp = selectionComposition(selected);
    document.getElementById('groupActions').style.display = 'flex';
    updateFilterChips(selected);

    if (btnGroupCut) btnGroupCut.style.display = comp.allWorkers ? '' : 'none';
    if (btnGroupMine) btnGroupMine.style.display = comp.allWorkers ? '' : 'none';
    if (btnGroupAttack) btnGroupAttack.style.display = comp.allSoldiers ? '' : 'none';
    if (btnGroupDefend) btnGroupDefend.style.display = comp.allSoldiers ? '' : 'none';

    if (actionMode === 'moveTarget') {
      info.textContent = `Move ${selectionSummary(selected)} — tap destination`;
      if (btnGroupMove) { btnGroupMove.textContent = '✕ Move'; btnGroupMove.classList.add('active'); }
    } else if (actionMode === 'attackTarget') {
      info.textContent = `Attack — tap an enemy or hut (${selectionSummary(selected)})`;
      if (btnGroupAttack) { btnGroupAttack.textContent = '✕ Attack'; btnGroupAttack.classList.add('active'); }
    } else if (actionMode === 'defendTarget') {
      info.textContent = `Defend — tap the spot to hold (${selectionSummary(selected)})`;
      if (btnGroupDefend) { btnGroupDefend.textContent = '✕ Defend'; btnGroupDefend.classList.add('active'); }
    } else if (actionMode === 'cutTarget') {
      info.textContent = `Group Cut — tap a forest area (${selectionSummary(selected)})`;
      if (btnGroupCut) { btnGroupCut.textContent = '✕ Cut'; btnGroupCut.classList.add('active'); }
    } else if (actionMode === 'mineTarget') {
      info.textContent = `Group Mine — tap Virelium area (${selectionSummary(selected)})`;
      if (btnGroupMine) { btnGroupMine.textContent = '✕ Mine'; btnGroupMine.classList.add('active'); }
    } else if (comp.allWorkers) {
      info.textContent = `${selectionSummary(selected)} — Move / Cut / Mine${modeHint}`;
    } else if (comp.allSoldiers) {
      const holding = selected.filter(s => s.defending).length;
      const duty = holding ? ` — ${holding} holding post` : '';
      info.textContent = `${selectionSummary(selected)} — Move / Attack / Defend${duty}${modeHint}`;
    } else {
      info.textContent = `Mixed ${selectionSummary(selected)} — Move only (or filter type)${modeHint}`;
    }
    return;
  }

  if (u && u.unitType === 'soldier') {
    document.getElementById('soldierActions').style.display = 'flex';
    const hp = u.hp != null ? ` HP ${Math.ceil(u.hp)}/${u.maxHp}` : '';
    if (actionMode === 'moveTarget') {
      info.textContent = 'Tap a location to move the soldier';
      btnSoldierMove.textContent = '✕ Move';
      btnSoldierMove.classList.add('active');
    } else if (actionMode === 'attackTarget') {
      info.textContent = 'Tap an enemy (green) or hut to attack';
      if (btnSoldierAttack) { btnSoldierAttack.textContent = '✕ Attack'; btnSoldierAttack.classList.add('active'); }
    } else if (actionMode === 'defendTarget') {
      info.textContent = 'Tap the spot for the soldier to defend';
      if (btnSoldierDefend) { btnSoldierDefend.textContent = '✕ Defend'; btnSoldierDefend.classList.add('active'); }
    } else if (u.defending && u.attacking) {
      info.textContent = 'Soldier defending post — engaging…' + hp;
    } else if (u.defending) {
      info.textContent = 'Soldier holding post' + hp;
    } else if (u.attacking) {
      info.textContent = 'Soldier attacking…' + hp;
    } else {
      info.textContent = 'Soldier — Move / Attack / Defend' + hp + modeHint;
    }
    return;
  }

  if (u) {
    document.getElementById('unitActions').style.display = 'grid';
    const whp = u.hp != null ? ` HP ${Math.ceil(u.hp)}/${u.maxHp}` : '';
    if (isWorkerFightingBack(u)) {
      info.textContent = `Worker under attack — fighting back${whp}`;
      return;
    }
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
      const what = u.buildKind === 'armory' ? 'Building armory' : 'Expanding base';
      info.textContent = isBuildInProgress(u)
        ? `${what}… ${Math.round(buildProgress(u) * 100)}%`
        : `${what} — walking to the site…`;
    } else {
      info.textContent = 'Worker' + whp + ' — actions (double-tap for nearby workers)' + note + modeHint;
    }
    return;
  }

  document.getElementById('mapActions').style.display = 'flex';
  const parts = [];
  if (playerBase) parts.push(workerCapNote());
  if (armories.length) parts.push(soldierCapNote());
  const knownHut = huts.find(h => isTileVisible(h.x, h.y));
  if (knownHut) {
    const st = hutHealthStats(knownHut);
    parts.push(`Hut HP ${st.cur}/${st.max}`);
  }
  const seenEnemies = countVisibleEnemies();
  if (seenEnemies) parts.push(`Enemies ${seenEnemies} in sight`);
  const cap = parts.length ? ' — ' + parts.join(' · ') : '';
  const panHint = cameraPanEnabled
    ? 'Double-tap empty = lock camera · Double-tap unit = select similar'
    : 'SELECT: long-press drag box · Double-tap empty = unlock pan';
  info.textContent = panHint + cap + note;
}
