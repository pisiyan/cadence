/**
 * Cadence — Focus Timer Engine
 */

const timerState = {
  activeChunkId: null,
  mode: 'countdown',
  running: false,
  targetSeconds: 45 * 60,
  elapsedSeconds: 0,
  elapsedByChunk: {},
  intervalId: null,
};

function formatSecondsHuman(secs) {
  const s = Math.max(0, Math.round(secs || 0));
  const m = Math.floor(s / 60);
  const remS = s % 60;
  if (m === 0) return `${remS}s`;
  return remS > 0 ? `${m}m ${remS}s` : `${m}m`;
}

function getTimerSecondsForChunk(chunkId) {
  if (timerState.activeChunkId === chunkId) {
    return Math.max(timerState.elapsedSeconds, timerState.elapsedByChunk[chunkId] || 0);
  }
  if (timerState.elapsedByChunk[chunkId]) {
    return timerState.elapsedByChunk[chunkId];
  }
  if (!timerState.activeChunkId && timerState.elapsedSeconds > 0) {
    return timerState.elapsedSeconds;
  }
  return 0;
}

function loadChunkIntoTimer(chunkId, autoStart = false) {
  const chunk = state.chunks.find((c) => c.id === chunkId);
  if (!chunk) return;
  const task = state.tasks.find((t) => t.id === chunk.taskId);
  if (task && isTaskBlockedByPrerequisite(task)) {
    const prereq = getPrerequisiteTask(task);
    showToast(`Locked: "${task.title}" can only be started once "${prereq ? prereq.title : 'prerequisite task'}" is finished.`);
    return;
  }

  pauseTimer();
  timerState.activeChunkId = chunk.id;
  timerState.targetSeconds = Math.max(60, Math.round(chunk.durationHours * 3600));
  timerState.elapsedSeconds = timerState.elapsedByChunk[chunk.id] || 0;

  updateTimerUI();
  renderTodayView();

  if (autoStart) {
    startTimer();
    showToast(`Focus timer started for "${task ? task.title : 'Task'}"`);
  }
}

function startTimer() {
  if (timerState.running) return;
  timerState.running = true;
  document.getElementById('focus-timer-panel').classList.add('running');
  document.getElementById('timer-start-label').textContent = 'Pause';

  timerState.intervalId = setInterval(() => {
    timerState.elapsedSeconds += 1;
    if (timerState.activeChunkId) {
      timerState.elapsedByChunk[timerState.activeChunkId] = timerState.elapsedSeconds;
    }

    if (
      timerState.mode === 'countdown' &&
      timerState.elapsedSeconds >= timerState.targetSeconds
    ) {
      pauseTimer();
      updateTimerUI();
      showToast('Session timer complete! Opening Progress Check-In...');
      triggerCheckInFromTimer();
      return;
    }

    updateTimerUI();
  }, 1000);

  updateTimerUI();
}

function pauseTimer() {
  timerState.running = false;
  if (timerState.intervalId) {
    clearInterval(timerState.intervalId);
    timerState.intervalId = null;
  }
  if (timerState.activeChunkId) {
    timerState.elapsedByChunk[timerState.activeChunkId] = timerState.elapsedSeconds;
  }
  const panel = document.getElementById('focus-timer-panel');
  if (panel) panel.classList.remove('running');
  const startLabel = document.getElementById('timer-start-label');
  if (startLabel) startLabel.textContent = timerState.elapsedSeconds > 0 ? 'Resume' : 'Start';
}

function resetTimer() {
  pauseTimer();
  timerState.elapsedSeconds = 0;
  if (timerState.activeChunkId) {
    delete timerState.elapsedByChunk[timerState.activeChunkId];
  }
  updateTimerUI();
}

function addFiveMinutesToTimer() {
  timerState.targetSeconds += 5 * 60;
  updateTimerUI();
}

function triggerCheckInFromTimer() {
  pauseTimer();
  let chunk = state.chunks.find((c) => c.id === timerState.activeChunkId);
  if (!chunk) {
    const todayStr = getTodayStr();
    chunk = state.chunks.find((c) => c.date === todayStr && c.status === 'scheduled');
  }
  if (!chunk) {
    showToast('Select or schedule a task session first to log progress.');
    return;
  }

  openCheckInModal(chunk.id, true);
}

function updateTimerUI() {
  const digitsEl = document.getElementById('timer-display');
  const labelEl = document.getElementById('timer-active-label');
  const progressEl = document.getElementById('timer-progress-fill');

  const displaySecs =
    timerState.mode === 'countdown'
      ? Math.max(0, timerState.targetSeconds - timerState.elapsedSeconds)
      : timerState.elapsedSeconds;

  const mins = Math.floor(displaySecs / 60);
  const secs = displaySecs % 60;
  if (digitsEl) {
    digitsEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  const chunk = state.chunks.find((c) => c.id === timerState.activeChunkId);
  if (chunk) {
    const task = state.tasks.find((t) => t.id === chunk.taskId);
    if (labelEl && task) {
      labelEl.textContent = `${task.priority} • ${task.title}`;
    }
  } else if (labelEl) {
    labelEl.textContent = 'Select "Focus" on a session to begin';
  }

  if (progressEl) {
    const pct =
      timerState.targetSeconds > 0
        ? Math.min(100, (timerState.elapsedSeconds / timerState.targetSeconds) * 100)
        : 0;
    progressEl.style.width = `${pct.toFixed(1)}%`;
  }
}
