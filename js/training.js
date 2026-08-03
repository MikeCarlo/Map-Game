// training.js — queued, timed unit training at the base / armories
// Buildings stay selected while they train: jobs live here, not on the unit.

function trainingKeyForBase() { return 'base'; }
function trainingKeyForArmory(a) { return a ? `armory:${a.x},${a.y}` : null; }

function trainingJobsFor(key) {
  return trainingJobs.filter(j => j.key === key);
}
function activeTrainingJob(key) {
  const list = trainingJobsFor(key);
  return list.length ? list[0] : null;
}
function trainingQueueLength(key) {
  return trainingJobsFor(key).length;
}
function queuedTrainingCount(unitType) {
  return trainingJobs.filter(j => j.unitType === unitType).length;
}
/** 0..1 for the bar over the building */
function trainingProgress(job) {
  if (!job || job.duration <= 0) return 1;
  return Math.max(0, Math.min(1, 1 - job.remaining / job.duration));
}

/** Cap counts units already queued, so you cannot over-order. */
function trainingCapReached(unitType) {
  if (unitType === 'worker') {
    if (!playerBase) return true;
    return countWorkers() + queuedTrainingCount('worker') >= playerBase.maxWorkers;
  }
  return countSoldiers() + queuedTrainingCount('soldier') >= maxSoldiers();
}
/** Cap re-checked at pop time — a base segment may have fallen mid-train. */
function trainingCapFull(unitType) {
  if (unitType === 'worker') {
    if (!playerBase) return true;
    return countWorkers() >= playerBase.maxWorkers;
  }
  return countSoldiers() >= maxSoldiers();
}

function findBaseSegmentAt(tx, ty) {
  if (!playerBase) return null;
  for (const seg of playerBase.segments) {
    if (tx >= seg.x && tx < seg.x + BASE_SEGMENT_SIZE &&
        ty >= seg.y && ty < seg.y + BASE_SEGMENT_SIZE) return seg;
  }
  return null;
}

function enqueueTraining(key, unitType, x, y, ox, oy, size) {
  if (trainingCapReached(unitType)) return false;
  if (trainingQueueLength(key) >= TRAIN_QUEUE_MAX) return false;
  const duration = unitType === 'soldier' ? TRAIN_SOLDIER_TIME : TRAIN_WORKER_TIME;
  trainingJobs.push({
    id: nextTrainingJobId++,
    key, unitType,
    x, y,               // spawn anchor
    ox, oy, size,       // building box, for the progress bar
    duration, remaining: duration,
    blocked: false
  });
  return true;
}

/** Cancel the newest job in a queue (the button on the building bar). */
function cancelLastTraining(key) {
  const list = trainingJobsFor(key);
  if (!list.length) return false;
  const last = list[list.length - 1];
  trainingJobs = trainingJobs.filter(j => j.id !== last.id);
  return true;
}
function cancelTrainingForKey(key) {
  const before = trainingJobs.length;
  trainingJobs = trainingJobs.filter(j => j.key !== key);
  return trainingJobs.length !== before;
}

function updateTraining(dt) {
  if (!trainingJobs.length) return false;
  const ticked = new Set();
  const done = [];
  let changed = false;

  for (const job of trainingJobs) {
    if (ticked.has(job.key)) continue; // one at a time per building
    ticked.add(job.key);

    if (job.remaining > 0) {
      job.remaining = Math.max(0, job.remaining - dt);
      changed = true;
    }
    if (job.remaining > 0) continue;

    if (trainingCapFull(job.unitType)) { done.push(job.id); changed = true; continue; }

    const u = spawnUnitNear(job.x, job.y, job.unitType);
    if (u) {
      job.blocked = false;
      done.push(job.id);
      changed = true;
    } else if (!job.blocked) {
      job.blocked = true; // no free tile — hold, retry next frame
      changed = true;
    }
  }

  if (done.length) {
    trainingJobs = trainingJobs.filter(j => !done.includes(j.id));
    updateUI();
  }
  return changed;
}

/** Info-bar fragment for a selected building. */
function trainingNote(key) {
  const job = activeTrainingJob(key);
  if (!job) return '';
  const queued = trainingQueueLength(key) - 1;
  const extra = queued > 0 ? ` (+${queued} queued)` : '';
  if (job.blocked) return ` · Trained — waiting for space${extra}`;
  return ` · Training ${Math.round(trainingProgress(job) * 100)}%${extra}`;
}

/** Drop / re-anchor jobs after a building loses tiles. */
function pruneTrainingJobs() {
  if (!trainingJobs.length) return;
  trainingJobs = trainingJobs.filter(job => {
    if (job.key === trainingKeyForBase()) {
      if (!playerBase || !playerBase.segments.length) return false;
      if (!findBaseSegmentAt(job.ox, job.oy)) {
        const seg = playerBase.segments[0];
        job.ox = seg.x; job.oy = seg.y;
        job.x = seg.x + 1; job.y = seg.y + 1;
      }
      return true;
    }
    return !!findArmoryAt(job.ox, job.oy);
  });
}

function resetTraining() {
  trainingJobs = [];
}
