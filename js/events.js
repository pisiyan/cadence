/**
 * Cadence — Event Listeners & Initialization
 */

function populateHabitProjectSelect() {
  const sel = document.getElementById('habit-project-input');
  if (!sel) return;
  const prevVal = sel.value;
  sel.innerHTML = state.projects
    .map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`)
    .join('');
  if (prevVal && state.projects.some((p) => p.id === prevVal)) {
    sel.value = prevVal;
  }
}

function syncHabitFormUI() {
  populateHabitProjectSelect();
  const freq = document.getElementById('habit-freq-input')?.value || 'daily';
  const consumesEl = document.getElementById('habit-consumes-input');
  const isTimeless = freq === 'timeless';

  const consumes = !isTimeless && Boolean(consumesEl?.checked);
  const durWrap = document.getElementById('habit-duration-wrap');
  const cycleRow = document.getElementById('habit-cycle-options-row');
  const intervalWrap = document.getElementById('habit-interval-wrap');
  const intervalLabel = document.getElementById('habit-interval-label');
  const domWrap = document.getElementById('habit-dom-wrap');
  const weekdaysWrap = document.getElementById('habit-weekdays-wrap');
  const taskMetaRow = document.getElementById('habit-task-meta-row');
  const consumesWrap = document.getElementById('habit-consumes-wrap');

  if (durWrap) durWrap.style.display = isTimeless ? 'none' : 'flex';
  if (consumesWrap) consumesWrap.style.display = isTimeless ? 'none' : 'inline-flex';
  if (taskMetaRow) taskMetaRow.style.display = 'grid';

  if (cycleRow) cycleRow.style.display = isTimeless ? 'none' : 'grid';
  if (intervalWrap) intervalWrap.style.display = isTimeless ? 'none' : 'flex';
  if (domWrap) domWrap.style.display = freq === 'monthly' ? 'flex' : 'none';
  if (weekdaysWrap) weekdaysWrap.style.display = freq === 'weekly' ? 'flex' : 'none';

  if (intervalLabel) {
    if (freq === 'daily' || freq === 'custom') intervalLabel.textContent = 'Every N Days';
    else if (freq === 'weekly') intervalLabel.textContent = 'Every N Weeks';
    else if (freq === 'monthly') intervalLabel.textContent = 'Every N Months';
  }
}

function openHabitEditor(habit) {
  populateHabitProjectSelect();
  document.getElementById('habit-edit-id').value = habit.id;
  document.getElementById('habit-title-input').value = habit.title;
  document.getElementById('habit-freq-input').value = habit.frequency || 'daily';
  document.getElementById('habit-duration-input').value = habit.durationMins || 30;
  document.getElementById('habit-interval-input').value = habit.intervalCount || 1;
  document.getElementById('habit-dom-input').value = habit.dayOfMonth || 1;
  document.getElementById('habit-project-input').value = habit.projectId || state.projects[0]?.id || '';
  document.getElementById('habit-priority-input').value = habit.priority || 'P2';
  document.getElementById('habit-consumes-input').checked = Boolean(habit.consumesCapacity);

  const selectedDays = Array.isArray(habit.daysOfWeek) ? habit.daysOfWeek : [parseDateLocal(getTodayStr()).getDay()];
  document.querySelectorAll('#habit-weekdays-picker input[type="checkbox"]').forEach((cb) => {
    cb.checked = selectedDays.includes(Number(cb.value));
  });

  syncHabitFormUI();
  document.getElementById('form-add-habit').style.display = 'block';
}

function setupEventListeners() {
  document.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const targetView = tab.dataset.view;
      state.activeView = targetView;
      document.querySelectorAll('.nav-tab').forEach((t) => t.classList.toggle('active', t === tab));
      document.querySelectorAll('.view-panel').forEach((panel) => {
        panel.classList.toggle('active', panel.id === `view-${targetView}`);
      });
      saveState();
      renderAll();
    });
  });

  document.getElementById('btn-theme-toggle').addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    saveState();
    renderAll();
  });

  document.getElementById('btn-new-task').addEventListener('click', () => openTaskModal(null));
  document.getElementById('btn-new-task-secondary').addEventListener('click', () => openTaskModal(null));
  document.getElementById('btn-open-capacity').addEventListener('click', openCapacityModal);
  document.getElementById('btn-overload-adjust').addEventListener('click', openCapacityModal);

  // Inline Today Capacity Editor
  document.getElementById('today-inline-cap').addEventListener('change', (e) => {
    const val = Math.max(0, Number(e.target.value) || 0);
    setDayOverride(getTodayStr(), val);
    runChunkingEngine();
    renderAll();
    showToast(`Today's available hours set to ${val}h.`);
  });

  document.getElementById('btn-reset-today-override').addEventListener('click', () => {
    clearDayOverride(getTodayStr());
    runChunkingEngine();
    renderAll();
    showToast("Reset today's hours to baseline pattern.");
  });

  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
  });

  document.querySelectorAll('#task-priority-selector .priority-option').forEach((btn) => {
    btn.addEventListener('click', () => setTaskModalPriority(btn.dataset.prio));
  });

  ['task-deadline-input', 'task-buffer-days-input', 'task-start-date-input', 'task-depends-select'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateTaskModalTargetPreview);
    if (el) el.addEventListener('change', updateTaskModalTargetPreview);
  });

  document.getElementById('task-start-mode-select').addEventListener('change', syncTaskStartModeUI);

  document.getElementById('task-est-hours-input').addEventListener('input', () => {
    const est = Math.max(0.25, Number(document.getElementById('task-est-hours-input').value) || 0.25);
    const maxInp = document.getElementById('task-max-hours-input');
    if (Number(maxInp.value) < est) {
      maxInp.value = est;
    }
    updateTaskModalTargetPreview();
  });
  document.getElementById('task-max-hours-input').addEventListener('input', updateTaskModalTargetPreview);

  // Submit Create / Edit Task Form
  document.getElementById('form-task').addEventListener('submit', (e) => {
    e.preventDefault();
    const editId = document.getElementById('task-id-input').value;
    const title = document.getElementById('task-title-input').value.trim();
    const projectId = document.getElementById('task-project-select').value;
    const deadline = document.getElementById('task-deadline-input').value;
    const bufferDays = Math.max(0, Number(document.getElementById('task-buffer-days-input').value) || 0);
    const priority = document.getElementById('task-priority-input').value || 'P2';
    const estimatedHours = Math.max(0.25, Number(document.getElementById('task-est-hours-input').value) || 1);
    const maxHours = Math.max(estimatedHours, Number(document.getElementById('task-max-hours-input').value) || estimatedHours);
    const loggedHours = Math.max(0, Number(document.getElementById('task-logged-input').value) || 0);
    const remainingHours = Math.max(0, roundTwo(maxHours - loggedHours));
    const minMins = Math.max(15, Number(document.getElementById('task-session-min').value) || 30);
    const maxMins = Math.max(minMins, Number(document.getElementById('task-session-max').value) || 60);
    const notes = document.getElementById('task-notes-input').value.trim();
    const startMode = document.getElementById('task-start-mode-select')?.value || 'anytime';
    const rawStartDate = document.getElementById('task-start-date-input')?.value || null;
    const rawDependsId = document.getElementById('task-depends-select')?.value || null;

    const startDate = startMode === 'date' && rawStartDate ? rawStartDate : null;
    const dependsOnTaskId = startMode === 'after_task' && rawDependsId ? rawDependsId : null;

    if (editId) {
      const existing = state.tasks.find((t) => t.id === editId);
      if (existing) {
        existing.title = title;
        existing.projectId = projectId;
        existing.deadline = deadline;
        existing.bufferDays = bufferDays;
        existing.priority = priority;
        existing.estimatedHours = estimatedHours;
        existing.maxHours = maxHours;
        delete existing.taskBufferHours;
        existing.remainingHours = remainingHours;
        existing.loggedHours = loggedHours;
        existing.completed = remainingHours <= 0;
        existing.minSessionMins = minMins;
        existing.maxSessionMins = maxMins;
        existing.notes = notes;
        existing.startDate = startDate;
        existing.dependsOnTaskId = dependsOnTaskId !== editId ? dependsOnTaskId : null;
      }
      showToast(`Updated "${title}".`);
    } else {
      state.tasks.push({
        id: uid('task'),
        title,
        projectId,
        priority,
        estimatedHours,
        maxHours,
        remainingHours,
        loggedHours,
        deadline,
        bufferDays,
        minSessionMins: minMins,
        maxSessionMins: maxMins,
        notes,
        startDate,
        dependsOnTaskId,
        completed: remainingHours <= 0,
        createdAt: getTodayStr(),
      });
      showToast(
        dependsOnTaskId
          ? `Scheduled follow-up task "${title}" (${priority}).`
          : startDate
          ? `Scheduled "${title}" starting ${formatHumanDate(startDate)}.`
          : `Scheduled "${title}" (${priority}).`
      );
    }

    closeModal('modal-task');
    runChunkingEngine();
    renderAll();
  });

  document.getElementById('btn-delete-task-modal').addEventListener('click', () => {
    const editId = document.getElementById('task-id-input').value;
    closeModal('modal-task');
    if (editId) deleteTaskById(editId);
  });

  // Manual Session / Chunk Editor Modal
  document.getElementById('form-edit-chunk').addEventListener('submit', (e) => {
    e.preventDefault();
    const chunkId = document.getElementById('edit-chunk-id').value;
    const chunk = state.chunks.find((c) => c.id === chunkId);
    if (!chunk) return;
    const newDate = document.getElementById('edit-chunk-date').value;
    const newDur = Math.max(0.25, roundTwo(Number(document.getElementById('edit-chunk-duration').value) || 0.5));

    chunk.date = newDate;
    chunk.durationHours = newDur;
    chunk.manualLock = true;
    if (newDate >= getTodayStr() && chunk.status === 'unreported') {
      chunk.status = 'scheduled';
    }

    closeModal('modal-edit-chunk');
    runChunkingEngine();
    renderAll();
    showToast(`Session updated (${formatMinutesOrHours(newDur)} on ${formatHumanDate(newDate)}).`);
  });

  document.getElementById('btn-edit-chunk-open-task').addEventListener('click', () => {
    const chunkId = document.getElementById('edit-chunk-id').value;
    const chunk = state.chunks.find((c) => c.id === chunkId);
    closeModal('modal-edit-chunk');
    if (!chunk) return;
    const task = state.tasks.find((t) => t.id === chunk.taskId);
    if (task && isHabitTask(task)) {
      const h = state.habits.find((item) => item.id === task.habitId);
      if (h) openHabitEditor(h);
      return;
    }
    openTaskModal(chunk.taskId);
  });

  document.getElementById('btn-edit-chunk-add-dependent').addEventListener('click', () => {
    const chunkId = document.getElementById('edit-chunk-id').value;
    const chunk = state.chunks.find((c) => c.id === chunkId);
    closeModal('modal-edit-chunk');
    if (chunk) openTaskModal(null, chunk.taskId);
  });

  document.getElementById('btn-edit-chunk-delete-task').addEventListener('click', () => {
    const chunkId = document.getElementById('edit-chunk-id').value;
    const chunk = state.chunks.find((c) => c.id === chunkId);
    closeModal('modal-edit-chunk');
    if (chunk) deleteTaskById(chunk.taskId);
  });

  document.getElementById('btn-delete-chunk-only').addEventListener('click', () => {
    const chunkId = document.getElementById('edit-chunk-id').value;
    const chunk = state.chunks.find((c) => c.id === chunkId);
    closeModal('modal-edit-chunk');
    if (!chunk) return;
    const task = state.tasks.find((t) => t.id === chunk.taskId);
    if (task && !isHabitTask(task) && chunk.status !== 'completed') {
      task.remainingHours = Math.max(0, roundTwo(task.remainingHours - chunk.durationHours));
      if (task.remainingHours <= 0) task.completed = true;
    }
    state.chunks = state.chunks.filter((c) => c.id !== chunkId);
    runChunkingEngine();
    renderAll();
    showToast('Session removed.');
  });

  document.getElementById('btn-edit-chunk-checkin').addEventListener('click', () => {
    const chunkId = document.getElementById('edit-chunk-id').value;
    closeModal('modal-edit-chunk');
    if (chunkId) openCheckInModal(chunkId);
  });

  // Capacity & Buffer Days Modal
  document.getElementById('capacity-mode-select').addEventListener('change', syncCapacityModalModeVisibility);

  document.getElementById('form-capacity').addEventListener('submit', (e) => {
    e.preventDefault();
    state.capacity.defaultBufferDays = Math.max(0, Number(document.getElementById('default-buffer-days-input').value) || 0);
    state.capacity.mode = document.getElementById('capacity-mode-select').value;

    state.capacity.weekdayWeekend = {
      weekday: Number(document.getElementById('cap-weekday-hours').value) || 4.5,
      weekend: Number(document.getElementById('cap-weekend-hours').value) || 5.5,
    };

    for (let d = 0; d <= 6; d++) {
      state.capacity.weekly[d] = Number(document.getElementById(`wd-${d}`).value) || 0;
    }

    const parsedDays = document
      .getElementById('monthly-days-input')
      .value.split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n >= 1 && n <= 31);

    state.capacity.monthlyRule = {
      days: parsedDays.length > 0 ? parsedDays : [1, 15],
      hours: Number(document.getElementById('monthly-hours-input').value) || 3.0,
    };

    closeModal('modal-capacity');
    runChunkingEngine();
    renderAll();
    showToast('Baseline capacity & buffer days saved.');
  });

  // Check-In Modal
  document.getElementById('btn-use-timer-logged').addEventListener('click', () => {
    const chunkId = document.getElementById('checkin-chunk-id').value;
    const chunk = state.chunks.find((c) => c.id === chunkId);
    const task = chunk ? state.tasks.find((t) => t.id === chunk.taskId) : null;
    if (!chunk || !task) return;
    const timerSecs = getTimerSecondsForChunk(chunk.id);
    const timerHrs = timerSecs > 0 ? roundTwo(Math.max(0.01, timerSecs / 3600)) : 0;
    document.getElementById('checkin-logged-hours').value = timerHrs;
    const rem = roundTwo(Math.max(0, task.remainingHours - timerHrs));
    document.getElementById('checkin-auto-val').textContent = `${formatHours(rem)} left`;
    document.getElementById('checkin-auto-sub').textContent = `− ${formatHours(timerHrs)} logged above`;
    selectCheckInMode('timer');
  });

  document.getElementById('btn-use-planned-logged').addEventListener('click', () => {
    const chunkId = document.getElementById('checkin-chunk-id').value;
    const chunk = state.chunks.find((c) => c.id === chunkId);
    const task = chunk ? state.tasks.find((t) => t.id === chunk.taskId) : null;
    if (!chunk || !task) return;
    const plannedHrs = chunk.durationHours;
    document.getElementById('checkin-logged-hours').value = plannedHrs;
    const rem = roundTwo(Math.max(0, task.remainingHours - plannedHrs));
    document.getElementById('checkin-auto-val').textContent = `${formatHours(rem)} left`;
    document.getElementById('checkin-auto-sub').textContent = `− ${formatHours(plannedHrs)} logged above`;
    selectCheckInMode('auto');
  });

  document.getElementById('card-checkin-timer').addEventListener('click', () => {
    const chunkId = document.getElementById('checkin-chunk-id').value;
    const chunk = state.chunks.find((c) => c.id === chunkId);
    if (chunk) {
      const timerSecs = getTimerSecondsForChunk(chunk.id);
      const timerHrs = timerSecs > 0 ? roundTwo(Math.max(0.01, timerSecs / 3600)) : 0;
      document.getElementById('checkin-logged-hours').value = timerHrs;
    }
    selectCheckInMode('timer');
  });

  document.getElementById('card-checkin-auto').addEventListener('click', () => selectCheckInMode('auto'));
  document.getElementById('card-checkin-manual').addEventListener('click', () => {
    selectCheckInMode('manual');
    document.getElementById('checkin-manual-hours').focus();
  });
  document.getElementById('checkin-manual-hours').addEventListener('focus', () => selectCheckInMode('manual'));

  document.getElementById('checkin-logged-hours').addEventListener('input', (e) => {
    const chunkId = document.getElementById('checkin-chunk-id').value;
    const chunk = state.chunks.find((c) => c.id === chunkId);
    const task = chunk ? state.tasks.find((t) => t.id === chunk.taskId) : null;
    if (!task) return;
    const logged = Number(e.target.value) || 0;
    const autoRem = roundTwo(Math.max(0, task.remainingHours - logged));
    document.getElementById('checkin-auto-val').textContent = `${formatHours(autoRem)} left`;
    document.getElementById('checkin-auto-sub').textContent = `− ${formatHours(logged)} logged above`;
  });

  document.getElementById('form-checkin').addEventListener('submit', (e) => {
    e.preventDefault();
    const chunkId = document.getElementById('checkin-chunk-id').value;
    const chunk = state.chunks.find((c) => c.id === chunkId);
    if (!chunk) return;
    const task = state.tasks.find((t) => t.id === chunk.taskId);
    if (!task) return;

    const timerSecs = getTimerSecondsForChunk(chunk.id);
    const timerHrs = timerSecs > 0 ? roundTwo(Math.max(0.01, timerSecs / 3600)) : 0;
    const mode = document.getElementById('checkin-mode-input').value;

    let loggedHrs = Math.max(0, roundTwo(Number(document.getElementById('checkin-logged-hours').value) || 0));
    let newRemaining = 0;

    if (mode === 'timer') {
      loggedHrs = timerHrs > 0 ? timerHrs : loggedHrs;
      newRemaining = Math.max(0, roundTwo(task.remainingHours - loggedHrs));
    } else if (mode === 'manual') {
      newRemaining = Math.max(0, roundTwo(Number(document.getElementById('checkin-manual-hours').value) || 0));
    } else {
      newRemaining = Math.max(0, roundTwo(task.remainingHours - loggedHrs));
    }

    chunk.status = 'completed';
    chunk.loggedHours = loggedHrs;
    chunk.completedAt = new Date().toISOString();

    if (isHabitTask(task)) {
      const h = state.habits.find((item) => item.id === task.habitId);
      if (h) {
        if (!h.completedPeriods) h.completedPeriods = {};
        h.completedPeriods[getHabitPeriodKey(h, chunk.date)] = true;
      }
    } else {
      task.loggedHours = roundTwo((Number(task.loggedHours) || 0) + loggedHrs);
      task.remainingHours = newRemaining;
      if (newRemaining <= 0) {
        task.completed = true;
      } else if (task.deadline < getTodayStr()) {
        task.deadline = addDays(getTodayStr(), 2);
      }
    }

    state.logs.push({
      id: uid('log'),
      taskId: task.id,
      chunkId: chunk.id,
      date: getTodayStr(),
      loggedHours: loggedHrs,
      plannedHours: chunk.durationHours,
      priority: task.priority,
      timestamp: new Date().toISOString(),
    });

    delete timerState.elapsedByChunk[chunk.id];
    if (timerState.activeChunkId === chunk.id || !timerState.activeChunkId) {
      resetTimer();
      timerState.activeChunkId = null;
    }

    closeModal('modal-checkin');
    runChunkingEngine();
    renderAll();
    showToast(
      isHabitTask(task)
        ? `Habit "${task.title}" logged (${loggedHrs}h)!`
        : newRemaining <= 0
        ? `Task "${task.title}" completed!`
        : `Logged ${loggedHrs}h. ${newRemaining}h remaining reflowed into schedule.`
    );
  });

  // Focus Timer Controls
  document.getElementById('btn-mode-countdown').addEventListener('click', () => {
    timerState.mode = 'countdown';
    document.getElementById('btn-mode-countdown').classList.add('active');
    document.getElementById('btn-mode-stopwatch').classList.remove('active');
    updateTimerUI();
  });

  document.getElementById('btn-mode-stopwatch').addEventListener('click', () => {
    timerState.mode = 'stopwatch';
    document.getElementById('btn-mode-stopwatch').classList.add('active');
    document.getElementById('btn-mode-countdown').classList.remove('active');
    updateTimerUI();
  });

  document.getElementById('btn-timer-start-pause').addEventListener('click', () => {
    if (timerState.running) {
      pauseTimer();
    } else {
      if (!timerState.activeChunkId) {
        const firstToday = state.chunks.find((c) => c.date === getTodayStr() && c.status === 'scheduled');
        if (firstToday) {
          loadChunkIntoTimer(firstToday.id, false);
        }
      }
      startTimer();
    }
  });

  document.getElementById('btn-timer-plus5').addEventListener('click', addFiveMinutesToTimer);
  document.getElementById('btn-timer-reset').addEventListener('click', resetTimer);
  document.getElementById('btn-timer-finish').addEventListener('click', triggerCheckInFromTimer);

  // Habits & Checklists Controls
  document.querySelectorAll('.habit-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      state.activeHabitTab = tab.dataset.freq;
      saveState();
      renderHabitsPanel();
    });
  });

  document.getElementById('habit-freq-input').addEventListener('change', syncHabitFormUI);
  document.getElementById('habit-consumes-input').addEventListener('change', syncHabitFormUI);

  document.getElementById('btn-toggle-add-habit').addEventListener('click', () => {
    const form = document.getElementById('form-add-habit');
    populateHabitProjectSelect();
    document.getElementById('habit-edit-id').value = '';
    document.getElementById('habit-title-input').value = '';
    const activeTab = state.activeHabitTab || 'daily';
    document.getElementById('habit-freq-input').value = activeTab;
    document.getElementById('habit-duration-input').value = '30';
    document.getElementById('habit-interval-input').value = '1';
    document.getElementById('habit-dom-input').value = '1';
    document.getElementById('habit-priority-input').value = 'P2';
    document.getElementById('habit-consumes-input').checked = activeTab !== 'timeless';

    const todayDow = parseDateLocal(getTodayStr()).getDay();
    document.querySelectorAll('#habit-weekdays-picker input[type="checkbox"]').forEach((cb) => {
      cb.checked = Number(cb.value) === todayDow;
    });

    syncHabitFormUI();
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
  });

  document.getElementById('btn-cancel-habit').addEventListener('click', () => {
    document.getElementById('form-add-habit').style.display = 'none';
  });

  document.getElementById('form-add-habit').addEventListener('submit', (e) => {
    e.preventDefault();
    const editId = document.getElementById('habit-edit-id').value;
    const title = document.getElementById('habit-title-input').value.trim();
    const frequency = document.getElementById('habit-freq-input').value;
    const durationMins = Number(document.getElementById('habit-duration-input').value) || 30;
    const intervalCount = Math.max(1, Number(document.getElementById('habit-interval-input').value) || 1);
    const dayOfMonth = Math.max(1, Math.min(31, Number(document.getElementById('habit-dom-input').value) || 1));
    const projectId = document.getElementById('habit-project-input').value || state.projects[0]?.id;
    const priority = document.getElementById('habit-priority-input').value || 'P2';
    const consumesCapacity = frequency === 'timeless' ? false : document.getElementById('habit-consumes-input').checked;

    const daysOfWeek = [];
    document.querySelectorAll('#habit-weekdays-picker input[type="checkbox"]:checked').forEach((cb) => {
      daysOfWeek.push(Number(cb.value));
    });
    if (frequency === 'weekly' && daysOfWeek.length === 0) {
      daysOfWeek.push(parseDateLocal(getTodayStr()).getDay());
    }

    if (!title) return;

    if (editId) {
      const existing = state.habits.find((h) => h.id === editId);
      if (existing) {
        existing.title = title;
        existing.frequency = frequency;
        existing.durationMins = durationMins;
        existing.intervalCount = intervalCount;
        existing.dayOfMonth = dayOfMonth;
        existing.daysOfWeek = daysOfWeek;
        existing.projectId = projectId;
        existing.priority = priority;
        existing.consumesCapacity = consumesCapacity;
        if (!existing.anchorDate) existing.anchorDate = getTodayStr();
      }
      showToast(`Updated "${title}".`);
    } else {
      state.habits.push({
        id: uid('hab'),
        title,
        frequency,
        durationMins,
        intervalCount,
        dayOfMonth,
        daysOfWeek,
        projectId,
        priority,
        consumesCapacity,
        anchorDate: getTodayStr(),
        completedPeriods: {},
      });
      showToast(`Added "${title}".`);
    }

    state.activeHabitTab = frequency;
    document.getElementById('habit-edit-id').value = '';
    document.getElementById('habit-title-input').value = '';
    document.getElementById('form-add-habit').style.display = 'none';

    runChunkingEngine();
    renderAll();
  });

  // Weekly Visualizer Controls
  document.getElementById('btn-horizon-14').addEventListener('click', () => {
    state.forecastWeeks = 2;
    saveState();
    renderAll();
  });
  document.getElementById('btn-horizon-28').addEventListener('click', () => {
    state.forecastWeeks = 4;
    saveState();
    renderAll();
  });

  document.getElementById('btn-strategy-asap').addEventListener('click', () => {
    state.distributionStrategy = 'asap';
    runChunkingEngine();
    renderAll();
    showToast('Switched to Front-Load distribution.');
  });
  document.getElementById('btn-strategy-spread').addEventListener('click', () => {
    state.distributionStrategy = 'spread';
    runChunkingEngine();
    renderAll();
    showToast('Switched to Equal Spread distribution.');
  });
  document.getElementById('btn-strategy-buffer').addEventListener('click', () => {
    state.distributionStrategy = 'buffer_paced';
    runChunkingEngine();
    renderAll();
    showToast('Switched to Buffer-Paced distribution.');
  });

  document.getElementById('focus-period-start').addEventListener('change', (e) => {
    if (!e.target.value) return;
    state.focusPeriod.startDate = e.target.value;
    if (state.focusPeriod.endDate < e.target.value) {
      state.focusPeriod.endDate = addDays(e.target.value, 6);
    }
    runChunkingEngine();
    renderAll();
  });

  document.getElementById('focus-period-end').addEventListener('change', (e) => {
    if (!e.target.value) return;
    state.focusPeriod.endDate = e.target.value;
    runChunkingEngine();
    renderAll();
  });

  document.querySelectorAll('[data-period-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const days = Number(btn.dataset.periodPreset) || 7;
      state.focusPeriod.startDate = getTodayStr();
      state.focusPeriod.endDate = addDays(getTodayStr(), days - 1);
      runChunkingEngine();
      renderAll();
      showToast(`Set Focus Period to next ${days} days.`);
    });
  });

  const applyFocusIntensity = (val) => {
    const clamped = Math.max(0, Math.min(100, Number(val) || 0));
    state.focusPeriod.focusIntensityPct = clamped;
    runChunkingEngine();
    renderAll();
  };

  document.getElementById('focus-intensity-slider').addEventListener('input', (e) => {
    applyFocusIntensity(e.target.value);
  });

  document.getElementById('focus-intensity-num').addEventListener('change', (e) => {
    applyFocusIntensity(e.target.value);
  });

  document.getElementById('btn-simulate-past-day').addEventListener('click', () => {
    const yesterday = addDays(getTodayStr(), -1);
    const activeTask = state.tasks.find((t) => !isHabitTask(t) && !t.completed && t.remainingHours > 0) || state.tasks[0];
    if (!activeTask) return;
    state.chunks.push({
      id: uid('chk_past'),
      taskId: activeTask.id,
      date: yesterday,
      durationHours: 0.75,
      loggedHours: 0,
      status: 'unreported',
      chunkIndex: 1,
      totalChunks: 2,
    });
    runChunkingEngine();
    renderAll();
    showToast('Simulated an unresponded past session in Today view.');
  });

  // Manage Sections Drawer
  document.getElementById('btn-manage-projects').addEventListener('click', () => {
    const drawer = document.getElementById('section-manager-drawer');
    drawer.style.display = drawer.style.display === 'none' ? 'flex' : 'none';
    renderSectionsManagerList();
  });

  document.getElementById('btn-cancel-project').addEventListener('click', () => {
    document.getElementById('section-manager-drawer').style.display = 'none';
  });

  document.getElementById('form-quick-project').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('new-project-name').value.trim();
    const color = document.getElementById('new-project-color').value;
    if (!name) return;
    state.projects.push({
      id: uid('proj'),
      name,
      color,
    });
    document.getElementById('new-project-name').value = '';
    saveState();
    renderAll();
    showToast(`Created section "${name}".`);
  });

  document.getElementById('btn-reset-demo').addEventListener('click', () => {
    const preservedProjects = Array.isArray(state.projects) && state.projects.length > 0
      ? JSON.parse(JSON.stringify(state.projects))
      : null;
    state = createDefaultState();
    if (preservedProjects) {
      state.projects = preservedProjects;
      const defaultProjId = state.projects[0].id;
      for (const t of state.tasks) {
        if (!state.projects.some((p) => p.id === t.projectId)) {
          t.projectId = defaultProjId;
        }
      }
    }
    runChunkingEngine();
    renderAll();
    showToast('Demo tasks reset (your edited sections were preserved).');
  });

  // Persist section name/color edits immediately as the user types
  document.body.addEventListener('input', (e) => {
    const secNameInp = e.target.closest('[data-section-name-id]');
    if (secNameInp) {
      const p = state.projects.find((x) => x.id === secNameInp.dataset.sectionNameId);
      if (p && secNameInp.value.trim()) {
        p.name = secNameInp.value.trim();
        saveState();
        populateHabitProjectSelect();
      }
      return;
    }

    const secColorInp = e.target.closest('[data-section-color-id]');
    if (secColorInp) {
      const p = state.projects.find((x) => x.id === secColorInp.dataset.sectionColorId);
      if (p) {
        p.color = secColorInp.value;
        saveState();
      }
    }
  });

  document.body.addEventListener('click', (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;

    if (action === 'checkin-chunk') {
      openCheckInModal(actionEl.dataset.chunkId);
    } else if (action === 'focus-chunk') {
      loadChunkIntoTimer(actionEl.dataset.chunkId, true);
    } else if (action === 'add-dependent-task') {
      openTaskModal(null, actionEl.dataset.taskId);
    } else if (action === 'open-edit-chunk') {
      openEditChunkModal(actionEl.dataset.chunkId);
    } else if (action === 'quick-focus-intensity') {
      const newIntensity = Math.max(0, Math.min(100, Number(actionEl.dataset.intensity) || 0));
      const deadline = actionEl.dataset.deadline;
      if (!state.focusPeriod) {
        state.focusPeriod = { startDate: getTodayStr(), endDate: deadline || addDays(getTodayStr(), 6), focusIntensityPct: newIntensity };
      } else {
        state.focusPeriod.focusIntensityPct = newIntensity;
        if (deadline && state.focusPeriod.endDate < deadline) {
          state.focusPeriod.endDate = deadline;
        }
      }
      runChunkingEngine();
      renderAll();
      showToast(`Focus Intensity set to ${newIntensity}% and schedule reflowed.`);
    } else if (action === 'quick-drop-buffer') {
      const task = state.tasks.find((t) => t.id === actionEl.dataset.taskId);
      if (task) {
        task.bufferDays = 0;
        runChunkingEngine();
        renderAll();
        showToast(`Set "${task.title}" to 0d buffer and reflowed.`);
      }
    } else if (action === 'quick-min-session') {
      const task = state.tasks.find((t) => t.id === actionEl.dataset.taskId);
      const mins = Number(actionEl.dataset.mins) || 15;
      if (task) {
        task.minSessionMins = mins;
        runChunkingEngine();
        renderAll();
        showToast(`Allowed ${mins}m minimum chunks for "${task.title}" and reflowed.`);
      }
    } else if (action === 'reschedule-unreported') {
      const chunkId = actionEl.dataset.chunkId;
      const chunk = state.chunks.find((c) => c.id === chunkId);
      if (chunk) {
        const task = state.tasks.find((t) => t.id === chunk.taskId);
        if (task && task.deadline < getTodayStr()) {
          task.deadline = addDays(getTodayStr(), 3);
        }
      }
      state.chunks = state.chunks.filter((c) => c.id !== chunkId);
      runChunkingEngine();
      renderAll();
      showToast('Rescheduled into upcoming available capacity.');
    } else if (action === 'reset-day-override') {
      const dStr = actionEl.dataset.date;
      clearDayOverride(dStr);
      runChunkingEngine();
      renderAll();
      showToast(`Reset ${formatHumanDate(dStr)} to baseline pattern.`);
    } else if (action === 'filter-project') {
      state.selectedProjectFilter = actionEl.dataset.projectId;
      saveState();
      renderAll();
    } else if (action === 'edit-task') {
      openTaskModal(actionEl.dataset.taskId);
    } else if (action === 'delete-task') {
      deleteTaskById(actionEl.dataset.taskId);
    } else if (action === 'toggle-habit-capacity') {
      const h = state.habits.find((item) => item.id === actionEl.dataset.habitId);
      if (h && h.frequency !== 'timeless') {
        h.consumesCapacity = !h.consumesCapacity;
        runChunkingEngine();
        renderAll();
        showToast(
          h.consumesCapacity
            ? `"${h.title}" now creates scheduled task sessions (${roundTwo(h.durationMins / 60)}h).`
            : `"${h.title}" set to passive checklist.`
        );
      }
    } else if (action === 'edit-habit') {
      const h = state.habits.find((item) => item.id === actionEl.dataset.habitId);
      if (h) openHabitEditor(h);
    } else if (action === 'delete-habit') {
      const habId = actionEl.dataset.habitId;
      state.habits = state.habits.filter((item) => item.id !== habId);
      state.chunks = state.chunks.filter((c) => c.habitId !== habId && c.taskId !== getHabitTaskId(habId));
      runChunkingEngine();
      renderAll();
    } else if (action === 'delete-section') {
      const secId = actionEl.dataset.sectionId;
      if (state.projects.length <= 1) return;
      state.projects = state.projects.filter((p) => p.id !== secId);
      const fallbackId = state.projects[0].id;
      for (const t of state.tasks) {
        if (t.projectId === secId) t.projectId = fallbackId;
      }
      for (const h of state.habits) {
        if (h.projectId === secId) h.projectId = fallbackId;
      }
      saveState();
      renderAll();
    }
  });

  document.body.addEventListener('change', (e) => {
    const capInp = e.target.closest('[data-inline-cap-date]');
    if (capInp) {
      const dStr = capInp.dataset.inlineCapDate;
      const val = Math.max(0, Number(capInp.value) || 0);
      setDayOverride(dStr, val);
      runChunkingEngine();
      renderAll();
      showToast(`Updated ${formatHumanDate(dStr)} available hours to ${val}h.`);
      return;
    }

    const secNameInp = e.target.closest('[data-section-name-id]');
    if (secNameInp) {
      const p = state.projects.find((x) => x.id === secNameInp.dataset.sectionNameId);
      if (p && secNameInp.value.trim()) {
        p.name = secNameInp.value.trim();
        saveState();
        renderAll();
      }
      return;
    }

    const secColorInp = e.target.closest('[data-section-color-id]');
    if (secColorInp) {
      const p = state.projects.find((x) => x.id === secColorInp.dataset.sectionColorId);
      if (p) {
        p.color = secColorInp.value;
        saveState();
        renderAll();
      }
      return;
    }

    const checkEl = e.target.closest('[data-action="toggle-habit-check"]');
    if (checkEl) {
      const h = state.habits.find((item) => item.id === checkEl.dataset.habitId);
      if (!h) return;
      const periodKey = getHabitPeriodKey(h);
      if (!h.completedPeriods) h.completedPeriods = {};
      h.completedPeriods[periodKey] = checkEl.checked;
      runChunkingEngine();
      renderAll();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  runChunkingEngine();
  setupEventListeners();
  renderAll();
});
