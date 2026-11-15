/**
 * Cadence — Interactive Modals & Manual Editors
 */

function openModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.add('open');
}

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.remove('open');
}

function deleteTaskById(taskId) {
  if (!taskId) return;
  const task = state.tasks.find((t) => t.id === taskId);
  const title = task ? task.title : 'Task';

  if (timerState.activeChunkId) {
    const activeCh = state.chunks.find((c) => c.id === timerState.activeChunkId);
    if (activeCh && activeCh.taskId === taskId) {
      resetTimer();
      timerState.activeChunkId = null;
    }
  }

  for (const t of state.tasks) {
    if (t.dependsOnTaskId === taskId) {
      t.dependsOnTaskId = null;
    }
  }

  state.tasks = state.tasks.filter((t) => t.id !== taskId);
  state.chunks = state.chunks.filter((c) => c.taskId !== taskId);
  runChunkingEngine();
  renderAll();
  showToast(`Deleted "${title}".`);
}

function syncTaskStartModeUI() {
  const modeEl = document.getElementById('task-start-mode-select');
  const dateWrap = document.getElementById('task-start-date-wrap');
  const depWrap = document.getElementById('task-start-depends-wrap');
  if (!modeEl || !dateWrap || !depWrap) return;

  const mode = modeEl.value;
  dateWrap.style.display = mode === 'date' ? 'flex' : 'none';
  depWrap.style.display = mode === 'after_task' ? 'flex' : 'none';
  updateTaskModalTargetPreview();
}

function openTaskModal(taskId = null, presetDependsOnTaskId = null) {
  const projSelect = document.getElementById('task-project-select');
  projSelect.innerHTML = state.projects
    .map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`)
    .join('');

  const dependsSelect = document.getElementById('task-depends-select');
  if (dependsSelect) {
    const candidateTasks = state.tasks.filter((t) => t.id !== taskId && !isHabitTask(t));
    dependsSelect.innerHTML = [
      `<option value="">Select task to wait for...</option>`,
      ...candidateTasks.map(
        (t) =>
          `<option value="${t.id}">⏳ "${escapeHtml(t.title)}" (${t.priority})</option>`
      ),
    ].join('');
  }

  const startModeSelect = document.getElementById('task-start-mode-select');
  const startDateInput = document.getElementById('task-start-date-input');
  const defBufferDays = state.capacity.defaultBufferDays ?? 1;
  const deleteBtn = document.getElementById('btn-delete-task-modal');

  if (taskId) {
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const m = getTaskHoursMetrics(task);
    document.getElementById('modal-task-title').textContent = 'Edit Task (All Fields Editable)';
    document.getElementById('task-id-input').value = task.id;
    document.getElementById('task-title-input').value = task.title;
    projSelect.value = task.projectId;
    document.getElementById('task-deadline-input').value = task.deadline;
    document.getElementById('task-buffer-days-input').value = task.bufferDays ?? defBufferDays;
    setTaskModalPriority(task.priority);
    document.getElementById('task-est-hours-input').value = m.estimatedHours;
    document.getElementById('task-max-hours-input').value = m.maxHours;
    document.getElementById('task-logged-input').value = task.loggedHours ?? 0;
    document.getElementById('task-session-min').value = task.minSessionMins ?? 30;
    document.getElementById('task-session-max').value = task.maxSessionMins ?? 60;
    document.getElementById('task-notes-input').value = task.notes || '';

    if (task.dependsOnTaskId) {
      if (startModeSelect) startModeSelect.value = 'after_task';
      if (dependsSelect) dependsSelect.value = task.dependsOnTaskId;
      if (startDateInput) startDateInput.value = getTodayStr();
    } else if (task.startDate) {
      if (startModeSelect) startModeSelect.value = 'date';
      if (startDateInput) startDateInput.value = task.startDate;
      if (dependsSelect) dependsSelect.value = '';
    } else {
      if (startModeSelect) startModeSelect.value = 'anytime';
      if (startDateInput) startDateInput.value = getTodayStr();
      if (dependsSelect) dependsSelect.value = '';
    }

    if (deleteBtn) deleteBtn.style.display = 'inline-flex';
  } else {
    const prereqTask = presetDependsOnTaskId
      ? state.tasks.find((t) => t.id === presetDependsOnTaskId)
      : null;

    document.getElementById('modal-task-title').textContent = prereqTask
      ? `Follow-Up Task (Starts After "${prereqTask.title}")`
      : 'Schedule New Task';
    document.getElementById('task-id-input').value = '';
    document.getElementById('task-title-input').value = '';
    if (prereqTask) {
      projSelect.value = prereqTask.projectId;
      const baseDeadline = prereqTask.deadline >= getTodayStr() ? prereqTask.deadline : getTodayStr();
      document.getElementById('task-deadline-input').value = addDays(baseDeadline, 3);
      setTaskModalPriority(prereqTask.priority || 'P2');
      if (startModeSelect) startModeSelect.value = 'after_task';
      if (dependsSelect) dependsSelect.value = presetDependsOnTaskId;
      if (startDateInput) startDateInput.value = getTodayStr();
    } else {
      document.getElementById('task-deadline-input').value = addDays(getTodayStr(), 5);
      setTaskModalPriority('P2');
      if (startModeSelect) startModeSelect.value = 'anytime';
      if (dependsSelect) dependsSelect.value = '';
      if (startDateInput) startDateInput.value = getTodayStr();
    }
    document.getElementById('task-buffer-days-input').value = defBufferDays;
    document.getElementById('task-est-hours-input').value = '3.0';
    document.getElementById('task-max-hours-input').value = '3.5';
    document.getElementById('task-logged-input').value = '0';
    document.getElementById('task-session-min').value = '30';
    document.getElementById('task-session-max').value = '60';
    document.getElementById('task-notes-input').value = '';
    if (deleteBtn) deleteBtn.style.display = 'none';
  }

  syncTaskStartModeUI();
  openModal('modal-task');
}

function setTaskModalPriority(prio) {
  document.getElementById('task-priority-input').value = prio;
  document.querySelectorAll('#task-priority-selector .priority-option').forEach((btn) => {
    btn.classList.toggle('selected', btn.dataset.prio === prio);
  });
}

function updateTaskModalTargetPreview() {
  const deadline = document.getElementById('task-deadline-input').value || getTodayStr();
  const bufDays = Math.max(0, Number(document.getElementById('task-buffer-days-input').value) || 0);
  const targetDate = addDays(deadline, -bufDays);
  const estHrs = Math.max(0.25, Number(document.getElementById('task-est-hours-input').value) || 0.25);
  const rawMaxHrs = Number(document.getElementById('task-max-hours-input').value) || estHrs;
  const maxHrs = Math.max(estHrs, rawMaxHrs);
  const bufHrs = roundTwo(maxHrs - estHrs);
  const bufPct = estHrs > 0 ? Math.round((bufHrs / estHrs) * 100) : 0;

  const badgeEl = document.getElementById('task-buffer-pct-badge');
  if (badgeEl) {
    badgeEl.textContent = `+${bufPct}% buffer`;
  }

  const startMode = document.getElementById('task-start-mode-select')?.value || 'anytime';
  let startSummary = 'Start: Anytime';
  if (startMode === 'date') {
    const sDate = document.getElementById('task-start-date-input')?.value;
    startSummary = sDate ? `Start: ${formatHumanDate(sDate)}` : 'Start: Specific Date';
  } else if (startMode === 'after_task') {
    const depId = document.getElementById('task-depends-select')?.value;
    const depTask = state.tasks.find((t) => t.id === depId);
    startSummary = depTask ? `Start: After "${depTask.title}" finishes` : 'Start: After selected task finishes';
  }

  document.getElementById('task-target-date-preview').textContent =
    `${startSummary} → Target Done: ${formatHumanDate(targetDate)} (${bufDays}d early) • Est: ${formatHours(estHrs)} / Max: ${formatHours(maxHrs)} (+${bufPct}% buffer)`;
}

function openEditChunkModal(chunkId) {
  const chunk = state.chunks.find((c) => c.id === chunkId);
  if (!chunk) return;
  const task = state.tasks.find((t) => t.id === chunk.taskId);
  const isHab = isChunkHabit(chunk);
  document.getElementById('edit-chunk-id').value = chunk.id;
  document.getElementById('edit-chunk-task-label').textContent = task
    ? `${isHab ? '🔁 Habit • ' : ''}${task.priority} • ${task.title}${!isHab ? ` (Session ${chunk.chunkIndex} of ${chunk.totalChunks})` : ''}`
    : 'Scheduled Session';
  document.getElementById('edit-chunk-date').value = chunk.date;
  document.getElementById('edit-chunk-duration').value = chunk.durationHours;
  openModal('modal-edit-chunk');
}

function openCheckInModal(chunkId, openedFromTimer = false) {
  const chunk = state.chunks.find((c) => c.id === chunkId);
  if (!chunk) return;
  const task = state.tasks.find((t) => t.id === chunk.taskId);
  if (!task) return;
  if (isTaskBlockedByPrerequisite(task)) {
    const prereq = getPrerequisiteTask(task);
    showToast(`Locked: "${task.title}" can only be started once "${prereq ? prereq.title : 'prerequisite task'}" is finished.`);
    return;
  }
  const proj = getProjectById(task.projectId);

  const timerSecs = getTimerSecondsForChunk(chunk.id);
  const timerHrs = timerSecs > 0 ? roundTwo(Math.max(0.01, timerSecs / 3600)) : 0;
  const plannedHrs = chunk.durationHours;

  document.getElementById('checkin-chunk-id').value = chunk.id;
  document.getElementById('checkin-task-summary').innerHTML = `
    <div>
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
        <span class="priority-badge ${task.priority}">${task.priority}</span>
        <span class="project-pill"><span class="project-dot" style="background: ${proj.color}"></span>${escapeHtml(proj.name)}</span>
      </div>
      <div style="font-weight: 700; font-size: 16px; color: var(--text-primary);">${escapeHtml(task.title)}</div>
    </div>
    <div class="mono" style="text-align: right; font-size: 12px; color: var(--text-secondary);">
      <div>Timer: <strong>${formatSecondsHuman(timerSecs)}</strong> (${timerHrs}h)</div>
      <div>Planned: <strong>${formatMinutesOrHours(plannedHrs)}</strong> (${plannedHrs}h)</div>
    </div>
  `;

  document.getElementById('checkin-timer-pill-label').textContent = `${formatSecondsHuman(timerSecs)} • ${timerHrs}h`;
  document.getElementById('checkin-planned-pill-label').textContent = `${formatMinutesOrHours(plannedHrs)} • ${plannedHrs}h`;

  const useTimerByDefault = timerSecs > 0 || openedFromTimer === true;
  const initialLogged = useTimerByDefault && timerHrs > 0 ? timerHrs : plannedHrs;

  document.getElementById('checkin-logged-hours').value = initialLogged;
  document.getElementById('checkin-prev-remaining').textContent = formatHours(task.remainingHours);

  const timerDeductedRem = roundTwo(Math.max(0, task.remainingHours - timerHrs));
  document.getElementById('checkin-timer-rem-val').textContent = `${formatHours(timerDeductedRem)} left`;
  document.getElementById('checkin-timer-rem-sub').textContent = `− ${formatSecondsHuman(timerSecs)} (${timerHrs}h) timer`;

  const autoDeductedRem = roundTwo(Math.max(0, task.remainingHours - initialLogged));
  document.getElementById('checkin-auto-val').textContent = `${formatHours(autoDeductedRem)} left`;
  document.getElementById('checkin-auto-sub').textContent = `− ${formatHours(initialLogged)} logged above`;

  document.getElementById('checkin-manual-hours').value = useTimerByDefault && timerHrs > 0 ? timerDeductedRem : autoDeductedRem;

  selectCheckInMode(useTimerByDefault && timerHrs > 0 ? 'timer' : 'auto');
  openModal('modal-checkin');
}

function selectCheckInMode(mode) {
  document.getElementById('checkin-mode-input').value = mode;
  const timerCard = document.getElementById('card-checkin-timer');
  if (timerCard) timerCard.classList.toggle('selected', mode === 'timer');
  document.getElementById('card-checkin-auto').classList.toggle('selected', mode === 'auto');
  document.getElementById('card-checkin-manual').classList.toggle('selected', mode === 'manual');
}

function openCapacityModal() {
  const cap = state.capacity;
  document.getElementById('default-buffer-days-input').value = cap.defaultBufferDays ?? 1;
  document.getElementById('capacity-mode-select').value = cap.mode || 'weekly';

  document.getElementById('cap-weekday-hours').value = cap.weekdayWeekend?.weekday ?? 4.5;
  document.getElementById('cap-weekend-hours').value = cap.weekdayWeekend?.weekend ?? 5.5;

  for (let d = 0; d <= 6; d++) {
    const inp = document.getElementById(`wd-${d}`);
    if (inp) inp.value = cap.weekly?.[d] ?? 4.5;
  }

  document.getElementById('monthly-days-input').value = (cap.monthlyRule?.days || [1, 15]).join(', ');
  document.getElementById('monthly-hours-input').value = cap.monthlyRule?.hours ?? 3.0;

  syncCapacityModalModeVisibility();
  openModal('modal-capacity');
}

function syncCapacityModalModeVisibility() {
  const mode = document.getElementById('capacity-mode-select').value;
  document.getElementById('pattern-section-weekday-weekend').style.display =
    mode === 'weekday_weekend' ? 'grid' : 'none';
  document.getElementById('pattern-section-weekly').style.display =
    mode === 'weekly' || mode === 'monthly' ? 'flex' : 'none';
  document.getElementById('pattern-section-monthly').style.display =
    mode === 'monthly' ? 'flex' : 'none';
}
