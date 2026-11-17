/**
 * Cadence — UI Renderers (Today View, Overload Diagnostics, Habits/Checklists, Weekly Visualizer, Stats)
 */

function renderAll() {
  document.documentElement.setAttribute('data-theme', state.theme || 'light');
  const defBuf = state.capacity.defaultBufferDays ?? 1;
  document.getElementById('header-buffer-display').textContent = `${defBuf}d early`;
  document.getElementById('forecast-tab-badge').textContent = `${state.forecastWeeks || 2}w`;

  renderTodayView();
  renderForecastView();
  renderStatsView();
  updateTimerUI();
  if (typeof populateHabitProjectSelect === 'function') {
    populateHabitProjectSelect();
  }
  const taskProjSelect = document.getElementById('task-project-select');
  if (taskProjSelect) {
    const prevTaskProj = taskProjSelect.value;
    taskProjSelect.innerHTML = state.projects
      .map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`)
      .join('');
    if (prevTaskProj && state.projects.some((p) => p.id === prevTaskProj)) {
      taskProjSelect.value = prevTaskProj;
    }
  }
}

function isChunkHabit(ch) {
  if (!ch) return false;
  if (ch.isHabitChunk) return true;
  const t = state.tasks.find((task) => task.id === ch.taskId);
  return isHabitTask(t);
}

// -------------------- 1. RENDER TODAY VIEW --------------------

function renderOverloadBanner() {
  const overloadedTasks = state.tasks.filter((t) => !isHabitTask(t) && !t.completed && t.unscheduledDeficitHours > 0);
  const overloadBanner = document.getElementById('overload-banner');
  const descEl = document.getElementById('overload-banner-desc');

  if (overloadedTasks.length === 0) {
    overloadBanner.style.display = 'none';
    return;
  }

  overloadBanner.style.display = 'block';
  const currentIntensity = Math.max(0, Math.min(100, Number(state.focusPeriod?.focusIntensityPct) || 0));

  descEl.innerHTML = overloadedTasks
    .map((t) => {
      const diag = t.deficitDiagnosis || {};
      const m = getTaskHoursMetrics(t);
      const nextIntensity = Math.min(100, currentIntensity + 25);

      const actionButtons = [];
      if (currentIntensity < 100 && m.fullBufferHours > 0) {
        actionButtons.push(`
          <button type="button" class="btn btn-xs btn-primary" data-action="quick-focus-intensity" data-intensity="${nextIntensity}" data-deadline="${t.deadline}">
            Focus ${nextIntensity}%
          </button>
        `);
        if (nextIntensity < 100) {
          actionButtons.push(`
            <button type="button" class="btn btn-xs btn-secondary" data-action="quick-focus-intensity" data-intensity="100" data-deadline="${t.deadline}">
              100% Focus (Est. Only)
            </button>
          `);
        }
      }
      if ((Number(t.bufferDays) || 0) > 0) {
        actionButtons.push(`
          <button type="button" class="btn btn-xs btn-secondary" data-action="quick-drop-buffer" data-task-id="${t.id}">
            Use 0d Buffer
          </button>
        `);
      }
      if ((diag.minSessionBlockedHours || 0) > 0.05 && (Number(t.minSessionMins) || 30) > 15) {
        actionButtons.push(`
          <button type="button" class="btn btn-xs btn-secondary" data-action="quick-min-session" data-task-id="${t.id}" data-mins="15">
            Allow 15m Chunks
          </button>
        `);
      }
      actionButtons.push(`
        <button type="button" class="btn btn-xs btn-secondary" data-action="edit-task" data-task-id="${t.id}">
          Edit Task
        </button>
      `);

      return `
        <div style="margin-top: 8px; padding: 10px 12px; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-sm); display: flex; flex-direction: column; gap: 6px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="priority-badge ${t.priority}">${t.priority}</span>
              <strong style="color: var(--text-primary);">${escapeHtml(t.title)}</strong>
              <span class="mono" style="font-size: 12px; font-weight: 700; color: var(--status-danger);">
                ${t.unscheduledDeficitHours}h couldn't fit before ${formatHumanDate(t.deadline)}
              </span>
            </div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              ${actionButtons.join('')}
            </div>
          </div>
          <div style="font-size: 12.5px; color: var(--text-secondary); line-height: 1.45;">
            ${escapeHtml(diag.reasonText || `Not enough free capacity before ${formatHumanDate(t.deadline)}.`)}
          </div>
        </div>
      `;
    })
    .join('');
}

function renderTodayView() {
  const todayStr = getTodayStr();
  const capInfo = getDailyCapacityInfo(todayStr);

  document.getElementById('today-date-heading').textContent = formatFullDateHeading(todayStr);
  const patternBadge = document.getElementById('today-pattern-badge');
  patternBadge.textContent = capInfo.source;

  const resetTodayBtn = document.getElementById('btn-reset-today-override');
  resetTodayBtn.style.display = capInfo.isOverridden ? 'inline-block' : 'none';

  const capWrap = document.getElementById('today-inline-cap-wrap');
  capWrap.classList.toggle('is-overridden', capInfo.isOverridden);

  const todayCapInput = document.getElementById('today-inline-cap');
  if (document.activeElement !== todayCapInput) {
    todayCapInput.value = capInfo.totalHours;
  }

  const todayChunks = state.chunks
    .filter((c) => c.date === todayStr)
    .sort((a, b) => {
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      if (a.status !== 'completed' && b.status === 'completed') return -1;
      const taskA = state.tasks.find((t) => t.id === a.taskId);
      const taskB = state.tasks.find((t) => t.id === b.taskId);
      const pA = PRIORITY_RANK[taskA?.priority] || 4;
      const pB = PRIORITY_RANK[taskB?.priority] || 4;
      return pA - pB;
    });

  const completedHours = roundTwo(
    todayChunks
      .filter((c) => c.status === 'completed')
      .reduce((acc, c) => acc + (Number(c.loggedHours ?? c.durationHours) || 0), 0)
  );

  const scheduledRemainingChunks = todayChunks.filter((c) => c.status !== 'completed');
  const scheduledTaskHours = roundTwo(
    scheduledRemainingChunks
      .filter((c) => !isChunkHabit(c))
      .reduce((acc, c) => acc + (Number(c.durationHours) || 0), 0)
  );
  const scheduledHabitHours = roundTwo(
    scheduledRemainingChunks
      .filter((c) => isChunkHabit(c))
      .reduce((acc, c) => acc + (Number(c.durationHours) || 0), 0)
  );
  const totalHabitHoursToday = roundTwo(
    todayChunks
      .filter((c) => isChunkHabit(c))
      .reduce((acc, c) => acc + (Number(c.status === 'completed' ? (c.loggedHours ?? c.durationHours) : c.durationHours) || 0), 0)
  );

  const usedWorkHours = roundTwo(completedHours + scheduledTaskHours + scheduledHabitHours);
  const openWorkPool = roundTwo(Math.max(0, capInfo.netWorkHours - usedWorkHours));

  document.getElementById('today-logged-val').innerHTML = `${completedHours.toFixed(1)}<span class="unit">h</span>`;
  document.getElementById('today-scheduled-val').innerHTML = `${scheduledTaskHours.toFixed(1)}<span class="unit">h</span>`;
  document.getElementById('today-habit-val').innerHTML = `${totalHabitHoursToday.toFixed(1)}<span class="unit">h</span>`;
  document.getElementById('today-free-val').innerHTML = `${openWorkPool.toFixed(1)}<span class="unit">h</span>`;

  const unreportedChunks = state.chunks.filter((c) => c.status === 'unreported');
  const todayBadge = document.getElementById('today-tab-badge');
  todayBadge.textContent = scheduledRemainingChunks.length + unreportedChunks.length;
  todayBadge.classList.toggle('badge-warning', unreportedChunks.length > 0);

  const denom = Math.max(capInfo.totalHours, usedWorkHours, 0.5);
  const barEl = document.getElementById('today-capacity-bar');

  const typeHours = {};
  for (const ch of scheduledRemainingChunks) {
    if (isChunkHabit(ch)) continue;
    const t = state.tasks.find((task) => task.id === ch.taskId);
    const proj = getProjectById(t?.projectId);
    typeHours[proj.id] = (typeHours[proj.id] || 0) + ch.durationHours;
  }

  const typeSegmentsHtml = state.projects
    .map((p) => {
      const hrs = roundTwo(typeHours[p.id] || 0);
      if (hrs <= 0) return '';
      return `<div class="cap-segment" style="width: ${((hrs / denom) * 100).toFixed(1)}%; background: ${p.color};" title="${escapeHtml(p.name)}: ${hrs}h"></div>`;
    })
    .join('');

  barEl.innerHTML = `
    <div class="cap-segment cap-segment-completed" style="width: ${((completedHours / denom) * 100).toFixed(1)}%" title="Logged Today: ${completedHours}h"></div>
    ${typeSegmentsHtml}
    <div class="cap-segment cap-segment-habits" style="width: ${((scheduledHabitHours / denom) * 100).toFixed(1)}%" title="Scheduled Habits: ${scheduledHabitHours}h"></div>
  `;

  const legendEl = document.querySelector('#view-today .capacity-legend .legend-items');
  if (legendEl) {
    legendEl.innerHTML = [
      `<span class="legend-item"><i class="legend-dot" style="background: var(--status-success)"></i> Logged</span>`,
      ...state.projects.map(
        (p) => `<span class="legend-item"><i class="legend-dot" style="background: ${p.color}"></i> ${escapeHtml(p.name)}</span>`
      ),
      `<span class="legend-item"><i class="legend-dot habits-dot"></i> Habits</span>`,
    ].join('');
  }

  const allocPct = capInfo.totalHours > 0 ? Math.round((usedWorkHours / capInfo.totalHours) * 100) : 0;
  document.getElementById('today-utilization-text').textContent =
    `${usedWorkHours}h allocated of ${capInfo.totalHours}h available (${allocPct}%)`;

  const unreportedBanner = document.getElementById('unreported-banner');
  const unreportedListEl = document.getElementById('unreported-chunks-list');
  if (unreportedChunks.length > 0) {
    unreportedBanner.style.display = 'block';
    document.getElementById('unreported-count').textContent = unreportedChunks.length;
    unreportedListEl.innerHTML = unreportedChunks
      .map((ch) => {
        const task = state.tasks.find((t) => t.id === ch.taskId);
        if (!task) return '';
        const m = getTaskHoursMetrics(task);
        const isDeadlineOverdue = task.deadline < todayStr;
        const badgeText = isDeadlineOverdue
          ? `Overdue Deadline (${formatHumanDate(task.deadline)})`
          : `Unresponded Session (${formatHumanDate(ch.date)})`;
        const badgeColor = isDeadlineOverdue ? 'var(--status-danger)' : 'var(--status-warning)';

        return `
          <div class="overdue-item-card ${isDeadlineOverdue ? '' : 'unreported-type'}">
            <div style="min-width: 0; display: flex; flex-direction: column; gap: 6px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="priority-badge ${task.priority}">${task.priority}</span>
                <span class="mono" style="font-size: 12px; font-weight: 700; color: ${badgeColor};">${badgeText}</span>
              </div>
              <div style="font-weight: 700; font-size: 15px; color: var(--text-primary);">${escapeHtml(task.title)}</div>
              <div style="font-size: 13px; color: var(--text-secondary);">
                Session: ${formatMinutesOrHours(ch.durationHours)} • <strong>${formatHours(m.effectiveRemainingHours)}</strong> left (Est ${formatHours(m.estimatedHours)} / Max ${formatHours(m.maxHours)} • +${m.effectiveBufferPct}% buf)
              </div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px; flex-shrink: 0;">
              <button type="button" class="btn btn-xs btn-primary" data-action="checkin-chunk" data-chunk-id="${ch.id}">
                Log Progress
              </button>
              <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                <button type="button" class="btn btn-xs btn-secondary" data-action="add-dependent-task" data-task-id="${task.id}" title="Place a task that can only start once this task finishes">
                  + Follow-Up
                </button>
                <button type="button" class="btn btn-xs btn-secondary" data-action="edit-task" data-task-id="${task.id}">
                  Edit
                </button>
                <button type="button" class="btn btn-xs btn-secondary" data-action="reschedule-unreported" data-chunk-id="${ch.id}">
                  Reschedule
                </button>
                <button type="button" class="btn btn-xs btn-danger-ghost" data-action="delete-task" data-task-id="${task.id}" title="Delete this task">
                  Delete
                </button>
              </div>
            </div>
          </div>
        `;
      })
      .join('');
  } else {
    unreportedBanner.style.display = 'none';
  }

  renderOverloadBanner();
  renderProjectFilterChips('today-project-filters');

  const filteredTodayChunks = todayChunks.filter((ch) => {
    if (state.selectedProjectFilter === 'ALL') return true;
    const task = state.tasks.find((t) => t.id === ch.taskId);
    return task && task.projectId === state.selectedProjectFilter;
  });

  document.getElementById('today-chunks-count').textContent = `${filteredTodayChunks.length} session${filteredTodayChunks.length === 1 ? '' : 's'}`;

  const container = document.getElementById('today-chunks-container');
  if (filteredTodayChunks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">No sessions scheduled for today</p>
        <p style="font-size: 13.5px;">Add a new task or adjust today's hours above.</p>
      </div>
    `;
  } else {
    container.innerHTML = filteredTodayChunks
      .map((ch) => {
        const task = state.tasks.find((t) => t.id === ch.taskId);
        if (!task) return '';
        const isHab = isChunkHabit(ch);
        const habit = isHab ? state.habits.find((h) => h.id === (ch.habitId || task.habitId)) : null;
        const m = getTaskHoursMetrics(task);
        const proj = getProjectById(task.projectId);
        const targetDate = getTargetCompletionDate(task);
        const isCompleted = ch.status === 'completed';
        const isActiveTimer = timerState.activeChunkId === ch.id;
        const prereq = getPrerequisiteTask(task);
        const isLockedByPrereq = isTaskBlockedByPrerequisite(task);

        let depBadgeHtml = '';
        if (prereq) {
          depBadgeHtml = isLockedByPrereq
            ? `<span class="project-pill" style="background: var(--status-warning-bg); color: var(--status-warning);" title="Can only start once '${escapeHtml(prereq.title)}' is finished">🔒 Starts after: ${escapeHtml(prereq.title)}</span>`
            : `<span class="project-pill" style="background: var(--status-success-bg); color: var(--status-success);">✓ Ready (After ${escapeHtml(prereq.title)})</span>`;
        }

        const habitBadgeHtml = isHab
          ? `<span class="project-pill" style="background: var(--accent-secondary-soft, rgba(15,118,110,0.12)); color: var(--accent-secondary); font-weight: 700;">🔁 Habit</span>`
          : '';

        const metaRowHtml = isHab
          ? `<span>${escapeHtml(habit ? getHabitCycleSummary(habit) : 'Recurring Habit')}</span>
             <span>•</span>
             <span>Scheduled ${formatMinutesOrHours(ch.durationHours)}</span>`
          : `<span><strong>${formatHours(m.effectiveRemainingHours)}</strong> left (Est ${formatHours(m.estimatedHours)} / Max ${formatHours(m.maxHours)} • +${m.effectiveBufferPct}% buffer)</span>
             <span>•</span>
             <span>Target: ${formatHumanDate(targetDate)} (${task.bufferDays || 0}d early)</span>`;

        return `
          <article class="chunk-card priority-${task.priority} ${isCompleted ? 'completed' : ''} ${isActiveTimer ? 'active-timer-chunk' : ''}" style="--task-type-color: ${proj.color}; ${isLockedByPrereq ? 'opacity: 0.85;' : ''}">
            <div class="chunk-main">
              <div class="chunk-badges">
                <span class="priority-badge ${task.priority}">${task.priority}</span>
                <span class="project-pill">
                  <span class="project-dot" style="background: ${proj.color}"></span>
                  ${escapeHtml(proj.name)}
                </span>
                ${habitBadgeHtml}
                ${!isHab ? `<span class="chunk-index-tag">Session ${ch.chunkIndex} of ${ch.totalChunks}</span>` : ''}
                ${depBadgeHtml}
              </div>
              <h3 class="chunk-title">${escapeHtml(task.title)}</h3>
              <div class="chunk-meta-row">
                ${metaRowHtml}
              </div>
            </div>

            <div class="chunk-actions">
              <button
                type="button"
                class="btn btn-xs btn-secondary mono"
                data-action="open-edit-chunk"
                data-chunk-id="${ch.id}"
                title="Click to move this session to another date or edit its duration"
              >
                ${formatMinutesOrHours(ch.durationHours)} ${isHab ? '• Move / Edit' : '✎'}
              </button>
              ${
                !isCompleted
                  ? isLockedByPrereq
                    ? `
                  <button type="button" class="btn btn-xs btn-secondary" disabled style="opacity: 0.6; cursor: not-allowed;" title="Finish '${escapeHtml(prereq ? prereq.title : 'prerequisite')}' first">
                    🔒 Locked
                  </button>
                `
                    : `
                  <button type="button" class="btn btn-sm btn-secondary" data-action="focus-chunk" data-chunk-id="${ch.id}">
                    Focus
                  </button>
                  <button type="button" class="btn btn-sm btn-primary" data-action="checkin-chunk" data-chunk-id="${ch.id}">
                    Check-In
                  </button>
                `
                  : `
                <span class="mono" style="font-size: 12.5px; color: var(--status-success); font-weight: 700; padding: 0 8px;">✓ Logged ${formatHours(ch.loggedHours)}</span>
              `
              }
              ${
                !isHab
                  ? `
                <button
                  type="button"
                  class="btn btn-xs btn-secondary"
                  data-action="add-dependent-task"
                  data-task-id="${task.id}"
                  title="Place a task that can only be started once this task has finished"
                >
                  + Follow-Up
                </button>
              `
                  : ''
              }
              <button
                type="button"
                class="btn btn-xs btn-ghost"
                data-action="${isHab && habit ? 'edit-habit' : 'edit-task'}"
                ${isHab && habit ? `data-habit-id="${habit.id}"` : `data-task-id="${task.id}"`}
                title="${isHab ? 'Edit habit cycle settings' : 'Edit task'}"
              >
                ${isHab ? 'Cycle' : 'Edit'}
              </button>
              ${
                isHab
                  ? `
                <button
                  type="button"
                  class="btn btn-xs btn-danger-ghost"
                  data-action="delete-chunk-only"
                  data-chunk-id="${ch.id}"
                  title="Delete only this scheduled habit session"
                >
                  Skip Session
                </button>
              `
                  : `
                <button
                  type="button"
                  class="btn btn-xs btn-danger-ghost"
                  data-action="delete-task"
                  data-task-id="${task.id}"
                  title="Delete task"
                >
                  Delete
                </button>
              `
              }
            </div>
          </article>
        `;
      })
      .join('');
  }

  renderHabitsPanel();
}

function renderHabitsPanel() {
  const tab = ['checklist', 'timed', 'all'].includes(state.activeHabitTab)
    ? state.activeHabitTab
    : 'checklist';

  document.querySelectorAll('.habit-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.freq === tab);
  });

  const filteredHabits = state.habits.filter((h) => {
    const timed = habitHasDuration(h);
    if (tab === 'checklist') return !timed;
    if (tab === 'timed') return timed;
    return true;
  });

  const completedCount = filteredHabits.filter((h) => {
    const pk = getHabitPeriodKey(h);
    return h.completedPeriods && h.completedPeriods[pk];
  }).length;
  document.getElementById('habits-progress-pill').textContent = `${completedCount}/${filteredHabits.length}`;

  const listEl = document.getElementById('habits-list-container');
  if (filteredHabits.length === 0) {
    const label =
      tab === 'checklist'
        ? 'side checklist items (no time duration)'
        : tab === 'timed'
        ? 'timed habits'
        : 'habits or checklist items';
    listEl.innerHTML = `<div class="empty-state" style="padding: 24px;">No ${label} yet. Click <strong>+ Add Item / Habit</strong> above.</div>`;
    return;
  }

  const todayStr = getTodayStr();
  listEl.innerHTML = filteredHabits
    .map((h) => {
      const pk = getHabitPeriodKey(h);
      const isChecked = Boolean(h.completedPeriods && h.completedPeriods[pk]);
      const timed = habitHasDuration(h);
      const hrs = timed ? roundTwo((Number(h.durationMins) || 30) / 60) : 0;
      const proj = getProjectById(h.projectId);
      const cycleSummary = getHabitCycleSummary(h);
      const isDueToday = h.frequency === 'timeless' ? !isChecked : isHabitScheduledOnDate(h, todayStr);

      return `
        <div class="habit-item ${isChecked ? 'checked' : ''}" style="${!timed && isDueToday && !isChecked ? 'border-left: 3.5px solid var(--accent-primary);' : ''}">
          <label class="habit-left" style="cursor: pointer;">
            <input type="checkbox" class="habit-checkbox" data-action="toggle-habit-check" data-habit-id="${h.id}" ${isChecked ? 'checked' : ''} />
            <div>
              <div class="habit-title">${escapeHtml(h.title)}</div>
              <div style="font-size: 11.5px; color: var(--text-muted); display: flex; align-items: center; gap: 6px; flex-wrap: wrap;" class="mono">
                <span style="color: ${h.frequency === 'timeless' ? 'var(--text-secondary)' : 'var(--accent-primary)'}; font-weight: 600;">${escapeHtml(cycleSummary)}</span>
                ${timed ? `<span>• ⏱ ${h.durationMins}m (${hrs}h task)</span>` : `<span>• ☑ Side checklist only</span>`}
                <span>• <span class="project-dot" style="background: ${proj.color}; display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 3px; vertical-align: middle;"></span>${escapeHtml(proj.name)}</span>
              </div>
            </div>
          </label>
          <div class="habit-badges">
            <button
              type="button"
              class="capacity-reserve-toggle ${timed ? 'consumes' : ''}"
              data-action="toggle-habit-capacity"
              data-habit-id="${h.id}"
              title="1-click switch between No Time Duration (side checklist only) and Timed Habit (scheduled task sessions)"
            >
              ${timed ? `⏱ ${hrs}h Task` : '☑ No Time'}
            </button>
            <button type="button" class="btn btn-xs btn-ghost" data-action="edit-habit" data-habit-id="${h.id}" title="Edit">✎</button>
            <button type="button" class="btn btn-xs btn-danger-ghost" data-action="delete-habit" data-habit-id="${h.id}" title="Delete">✕</button>
          </div>
        </div>
      `;
    })
    .join('');
}

// -------------------- 2. RENDER WEEKLY SINGLE-ROW VISUALIZER (7 DAYS PER ROW) --------------------

function renderForecastView() {
  const todayStr = getTodayStr();
  const weeksCount = Number(state.forecastWeeks) || 2;

  document.getElementById('btn-horizon-14').classList.toggle('active', weeksCount === 2);
  document.getElementById('btn-horizon-28').classList.toggle('active', weeksCount === 4);
  document.getElementById('btn-strategy-asap').classList.toggle('active', state.distributionStrategy === 'asap');
  document.getElementById('btn-strategy-spread').classList.toggle('active', state.distributionStrategy === 'spread');
  document.getElementById('btn-strategy-buffer').classList.toggle('active', state.distributionStrategy === 'buffer_paced');

  const fp = state.focusPeriod || {
    startDate: todayStr,
    endDate: addDays(todayStr, 6),
    focusIntensityPct: 0,
  };
  const intensityPct = Math.max(0, Math.min(100, Number(fp.focusIntensityPct) || 0));
  const startInp = document.getElementById('focus-period-start');
  const endInp = document.getElementById('focus-period-end');
  const sliderInp = document.getElementById('focus-intensity-slider');
  const numInp = document.getElementById('focus-intensity-num');

  if (document.activeElement !== startInp) startInp.value = fp.startDate;
  if (document.activeElement !== endInp) endInp.value = fp.endDate;
  if (document.activeElement !== sliderInp) sliderInp.value = intensityPct;
  if (document.activeElement !== numInp) numInp.value = intensityPct;

  const keptBufferPct = 100 - intensityPct;
  const labelText =
    intensityPct === 0
      ? `0% Intensity (100% of Task % Buffer Kept — Max Hrs)`
      : intensityPct === 100
      ? `100% Intensity (0% Buffer Kept — Est. Hours Only)`
      : `${intensityPct}% Intensity (${keptBufferPct}% of Task % Buffer Kept)`;
  document.getElementById('focus-intensity-label').textContent = labelText;

  const periodDaysCount = Math.max(1, diffDays(fp.startDate, fp.endDate) + 1);
  let periodScheduledWork = 0;
  let periodNetWorkPool = 0;
  for (let i = 0; i < Math.min(60, periodDaysCount); i++) {
    const dStr = addDays(fp.startDate, i);
    const capInfo = getDailyCapacityInfo(dStr);
    const dChunks = state.chunks.filter((c) => c.date === dStr);
    const dWork = dChunks.reduce(
      (acc, c) => acc + (Number(c.status === 'completed' ? (c.loggedHours ?? c.durationHours) : c.durationHours) || 0),
      0
    );
    periodScheduledWork += dWork;
    periodNetWorkPool += capInfo.netWorkHours;
  }

  const avgDailyScheduled = roundTwo(periodScheduledWork / periodDaysCount);
  const actualPeriodFocusPct =
    periodNetWorkPool > 0 ? Math.round((periodScheduledWork / periodNetWorkPool) * 100) : 0;

  document.getElementById('focus-period-readout').textContent =
    `${avgDailyScheduled}h / day (${actualPeriodFocusPct}% focus)`;
  document.getElementById('focus-period-sub').textContent =
    `${roundTwo(periodScheduledWork)}h scheduled of ${roundTwo(periodNetWorkPool)}h pool (${periodDaysCount}d window)`;

  const mondayOfThisWeek = getMondayOfWeek(todayStr);
  const stackEl = document.getElementById('forecast-days-grid');
  const weekRowsHtml = [];

  for (let w = 0; w < weeksCount; w++) {
    const weekStartStr = addDays(mondayOfThisWeek, w * 7);
    const weekEndStr = addDays(weekStartStr, 6);
    const weekTitle =
      w === 0
        ? 'This Week'
        : w === 1
        ? 'Next Week'
        : `Week ${w + 1}`;

    const dayColumnsHtml = [];
    let weekWorkPlanned = 0;
    let weekWorkPool = 0;

    for (let d = 0; d < 7; d++) {
      const dStr = addDays(weekStartStr, d);
      const isToday = dStr === todayStr;
      const isPast = dStr < todayStr;
      const inFocusPeriod = isDateInFocusPeriod(dStr);
      const capInfo = getDailyCapacityInfo(dStr);

      const dayChunks = state.chunks
        .filter((c) => c.date === dStr)
        .sort((a, b) => {
          const tA = state.tasks.find((t) => t.id === a.taskId);
          const tB = state.tasks.find((t) => t.id === b.taskId);
          return (PRIORITY_RANK[tA?.priority] || 4) - (PRIORITY_RANK[tB?.priority] || 4);
        });

      const completedHrs = dayChunks
        .filter((c) => c.status === 'completed')
        .reduce((acc, c) => acc + (Number(c.loggedHours ?? c.durationHours) || 0), 0);
      const scheduledTaskHrs = dayChunks
        .filter((c) => c.status !== 'completed' && !isChunkHabit(c))
        .reduce((acc, c) => acc + (Number(c.durationHours) || 0), 0);
      const scheduledHabitHrs = dayChunks
        .filter((c) => c.status !== 'completed' && isChunkHabit(c))
        .reduce((acc, c) => acc + (Number(c.durationHours) || 0), 0);

      const usedWorkHrs = roundTwo(completedHrs + scheduledTaskHrs + scheduledHabitHrs);
      const effectivePool = capInfo.netWorkHours;
      const openWorkHrs = roundTwo(Math.max(0, effectivePool - usedWorkHrs));

      weekWorkPlanned = roundTwo(weekWorkPlanned + usedWorkHrs);
      weekWorkPool = roundTwo(weekWorkPool + effectivePool);

      const denom = Math.max(capInfo.totalHours, usedWorkHrs, 0.5);
      const dt = parseDateLocal(dStr);
      const dayNameShort = dt.toLocaleDateString('en-US', { weekday: 'short' });
      const monthDayShort = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      const miniItemsHtml = [];

      for (const ch of dayChunks) {
        const task = state.tasks.find((t) => t.id === ch.taskId);
        if (!task) continue;
        const proj = getProjectById(task.projectId);
        const isHab = isChunkHabit(ch);
        const isDone = ch.status === 'completed';
        const isUnrep = ch.status === 'unreported';
        const prereq = getPrerequisiteTask(task);
        const isLockedByPrereq = isTaskBlockedByPrerequisite(task);

        miniItemsHtml.push(`
          <div
            class="mini-chunk-item ${isHab ? 'habit-slot' : task.priority}"
            data-action="open-edit-chunk"
            data-chunk-id="${ch.id}"
            style="--task-type-color: ${proj.color}; ${isDone ? 'opacity: 0.65;' : ''}"
            title="Click to edit session or log progress"
          >
            <div class="mini-chunk-top">
              <span style="display:inline-flex; align-items:center; gap:4px;">
                <span class="project-dot" style="background: ${proj.color}; width:7px; height:7px;"></span>
                <span class="priority-badge ${task.priority}" style="font-size: 9.5px; padding: 1px 5px;">${isHab ? '🔁 ' : ''}${task.priority}</span>
              </span>
              <span class="mono" style="font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
                ${formatMinutesOrHours(ch.durationHours)} ${ch.manualLock ? '📌' : '✎'}
                ${
                  !isHab
                    ? `
                  <button
                    type="button"
                    data-action="add-dependent-task"
                    data-task-id="${task.id}"
                    title="Place a follow-up task that can only start once this task finishes"
                    style="border: none; background: var(--accent-primary-soft); color: var(--accent-primary); border-radius: 3px; cursor: pointer; font-size: 10px; font-weight: 700; padding: 1px 4px; line-height: 1;"
                  >+↳</button>
                  <button
                    type="button"
                    data-action="delete-task"
                    data-task-id="${task.id}"
                    title="Delete task"
                    style="border: none; background: transparent; color: var(--text-muted); cursor: pointer; font-size: 11px; padding: 0 2px; line-height: 1;"
                  >✕</button>
                `
                    : `
                  <button
                    type="button"
                    data-action="delete-chunk-only"
                    data-chunk-id="${ch.id}"
                    title="Delete only this habit session on ${dStr}"
                    style="border: none; background: transparent; color: var(--text-muted); cursor: pointer; font-size: 11px; padding: 0 2px; line-height: 1;"
                  >✕</button>
                `
                }
              </span>
            </div>
            <div class="mini-chunk-title" style="${isDone ? 'text-decoration: line-through;' : ''}">
              ${escapeHtml(task.title)}
            </div>
            ${prereq ? `<div style="font-size:10px; font-weight:600; color:${isLockedByPrereq ? 'var(--status-warning)' : 'var(--status-success)'};">${isLockedByPrereq ? '🔒 After:' : '✓ After:'} ${escapeHtml(prereq.title)}</div>` : ''}
            ${isUnrep ? `<div style="font-size:10px; font-weight:700; color:var(--status-warning);">Unresponded</div>` : ''}
          </div>
        `);
      }

      dayColumnsHtml.push(`
        <div class="day-column-card ${isToday ? 'is-today' : ''} ${isPast ? 'is-past' : ''} ${inFocusPeriod ? 'in-focus-period' : ''}">
          <div class="day-col-top">
            <div>
              <div class="day-col-name">
                ${dayNameShort}
                ${isToday ? '<span class="project-pill" style="font-size:10px; padding:1px 6px; background:var(--accent-primary); color:#fff;">Today</span>' : ''}
              </div>
              <div class="day-col-date">${monthDayShort}</div>
            </div>
            ${
              capInfo.isOverridden
                ? `<button type="button" class="reset-day-btn" data-action="reset-day-override" data-date="${dStr}" title="Reset day to weekly pattern">Reset</button>`
                : ''
            }
          </div>

          <div class="day-inline-editors">
            <div class="day-edit-field">
              <label>Available Hrs</label>
              <div class="day-edit-input-wrap">
                <input
                  type="number"
                  class="day-edit-input"
                  data-inline-cap-date="${dStr}"
                  min="0"
                  max="24"
                  step="0.5"
                  value="${capInfo.totalHours}"
                  title="Edit available hours for ${dStr}"
                />
                <span>h</span>
              </div>
            </div>
          </div>

          <div class="day-mini-meter">
            <div class="cap-segment cap-segment-completed" style="width: ${((completedHrs / denom) * 100).toFixed(1)}%"></div>
            ${state.projects
              .map((p) => {
                const pHrs = dayChunks
                  .filter((c) => {
                    if (c.status === 'completed' || isChunkHabit(c)) return false;
                    const t = state.tasks.find((task) => task.id === c.taskId);
                    return getProjectById(t?.projectId).id === p.id;
                  })
                  .reduce((acc, c) => acc + (Number(c.durationHours) || 0), 0);
                if (pHrs <= 0) return '';
                return `<div class="cap-segment" style="width: ${((pHrs / denom) * 100).toFixed(1)}%; background: ${p.color};"></div>`;
              })
              .join('')}
            <div class="cap-segment cap-segment-habits" style="width: ${((scheduledHabitHrs / denom) * 100).toFixed(1)}%"></div>
          </div>

          <div class="day-pool-summary">
            <span>Work: ${usedWorkHrs}/${effectivePool}h</span>
            <span>${openWorkHrs}h open</span>
          </div>

          <div class="day-chunks-stack">
            ${miniItemsHtml.join('')}
          </div>
        </div>
      `);
    }

    weekRowsHtml.push(`
      <div class="week-row-block">
        <div class="week-row-header">
          <div class="week-row-title">
            <span>${weekTitle}</span>
            <span class="mono" style="font-size: 12.5px; font-weight: 500; color: var(--text-muted);">
              ${formatHumanDate(weekStartStr)} – ${formatHumanDate(weekEndStr)}
            </span>
          </div>
          <div class="mono" style="font-size: 12.5px; color: var(--text-secondary);">
            <strong>${weekWorkPlanned}h</strong> planned work / <strong>${weekWorkPool}h</strong> focus-adjusted capacity
          </div>
        </div>
        <div class="week-row-grid">
          ${dayColumnsHtml.join('')}
        </div>
      </div>
    `);
  }

  stackEl.innerHTML = weekRowsHtml.join('');

  renderProjectFilterChips('backlog-project-filters');
  renderSectionsManagerList();

  const filteredTasks = state.tasks
    .filter((t) => state.selectedProjectFilter === 'ALL' || t.projectId === state.selectedProjectFilter)
    .sort((a, b) => {
      if (isHabitTask(a) !== isHabitTask(b)) return isHabitTask(a) ? 1 : -1;
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const targetA = getTargetCompletionDate(a);
      const targetB = getTargetCompletionDate(b);
      if (targetA !== targetB) return targetA.localeCompare(targetB);
      const pDiff = (PRIORITY_RANK[a.priority] || 4) - (PRIORITY_RANK[b.priority] || 4);
      if (pDiff !== 0) return pDiff;
      return a.deadline.localeCompare(b.deadline);
    });

  document.getElementById('all-tasks-count-pill').textContent = `${filteredTasks.length} tasks`;

  const tbody = document.getElementById('backlog-tasks-tbody');
  tbody.innerHTML = filteredTasks
    .map((t) => {
      const isHab = isHabitTask(t);
      const habit = isHab ? state.habits.find((h) => h.id === t.habitId) : null;
      const m = getTaskHoursMetrics(t);
      const proj = getProjectById(t.projectId);
      const targetDate = getTargetCompletionDate(t);
      const taskChunks = state.chunks.filter((c) => c.taskId === t.id && c.status === 'scheduled');
      const unreportedTaskChunks = state.chunks.filter((c) => c.taskId === t.id && c.status === 'unreported');

      let statusBadge = '';
      if (isHab) {
        statusBadge = `<span class="project-pill" style="background: var(--accent-primary-soft); color: var(--accent-primary);">🔁 ${taskChunks.length} Scheduled</span>`;
      } else if (t.completed || m.effectiveRemainingHours <= 0) {
        statusBadge = `<span class="project-pill" style="background: var(--status-success-bg); color: var(--status-success);">✓ Completed</span>`;
      } else if (t.deadline < todayStr) {
        statusBadge = `<span class="project-pill" style="background: var(--status-danger-bg); color: var(--status-danger);">Overdue</span>`;
      } else if (t.unscheduledDeficitHours > 0) {
        const reasonTip = t.deficitDiagnosis?.reasonText ? ` title="${escapeHtml(t.deficitDiagnosis.reasonText)}"` : '';
        statusBadge = `<span class="project-pill" style="background: var(--status-danger-bg); color: var(--status-danger); cursor: help;"${reasonTip}>${t.unscheduledDeficitHours}h Over Capacity ⓘ</span>`;
      } else if (t.usingBufferDays) {
        statusBadge = `<span class="project-pill" style="background: var(--status-warning-bg); color: var(--status-warning);">Using Buffer Window</span>`;
      } else if (unreportedTaskChunks.length > 0) {
        statusBadge = `<span class="project-pill" style="background: var(--status-warning-bg); color: var(--status-warning);">${unreportedTaskChunks.length} Unresponded</span>`;
      } else {
        statusBadge = `<span class="project-pill" style="background: var(--accent-primary-soft); color: var(--accent-primary);">${taskChunks.length} Sessions</span>`;
      }

      const prereq = getPrerequisiteTask(t);
      const isLockedByPrereq = isTaskBlockedByPrerequisite(t);
      const isFutureStart = isTaskBlockedByStartDate(t);

      let startColHtml = `<span style="color: var(--text-muted); font-size: 12.5px;">Anytime</span>`;
      if (isHab && habit) {
        startColHtml = `<span class="mono" style="font-size: 12px; color: var(--accent-secondary);">${escapeHtml(getHabitCycleSummary(habit))}</span>`;
      } else if (prereq) {
        startColHtml = `
          <span class="project-pill" style="background: ${isLockedByPrereq ? 'var(--status-warning-bg)' : 'var(--status-success-bg)'}; color: ${isLockedByPrereq ? 'var(--status-warning)' : 'var(--status-success)'};" title="Starts upon completion of '${escapeHtml(prereq.title)}'">
            ${isLockedByPrereq ? '🔒' : '✓'} After: ${escapeHtml(prereq.title)}
          </span>
        `;
      } else if (t.startDate) {
        startColHtml = `
          <span class="mono" style="font-size: 12.5px; font-weight: 600; color: ${isFutureStart ? 'var(--accent-primary)' : 'var(--text-secondary)'};">
            📅 ${formatHumanDate(t.startDate)}
          </span>
        `;
      }

      const bufBadgeStr =
        m.intensityPct > 0 && m.bufferPct > 0
          ? `+${m.bufferPct}% → <strong>+${m.effectiveBufferPct}% buf (${formatHours(m.effectiveMaxHours)})</strong>`
          : `<strong>+${m.bufferPct}% buf</strong>`;

      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <span class="priority-badge ${t.priority}">${t.priority}</span>
              <div>
                <div style="font-weight: 600; color: var(--text-primary); ${t.completed ? 'text-decoration: line-through; opacity: 0.7;' : ''}">
                  ${isHab ? '🔁 ' : ''}${escapeHtml(t.title)}
                </div>
                ${t.notes ? `<div style="font-size: 12.5px; color: var(--text-muted);">${escapeHtml(t.notes)}</div>` : ''}
                ${t.unscheduledDeficitHours > 0 && t.deficitDiagnosis?.reasonText ? `<div style="font-size: 11.5px; color: var(--status-danger); margin-top: 2px;">${escapeHtml(t.deficitDiagnosis.reasonText)}</div>` : ''}
              </div>
            </div>
          </td>
          <td>
            <span class="project-pill">
              <span class="project-dot" style="background: ${proj.color}"></span>
              ${escapeHtml(proj.name)}
            </span>
          </td>
          <td>${startColHtml}</td>
          <td class="mono">
            ${
              isHab
                ? `<span style="font-size: 12px; color: var(--text-muted);">Recurring</span>`
                : `<strong>${formatHumanDate(targetDate)}</strong>
                   <span style="font-size: 11.5px; color: var(--text-muted);">(${t.bufferDays || 0}d early)</span>`
            }
          </td>
          <td class="mono">${isHab ? '—' : formatHumanDate(t.deadline)}</td>
          <td class="mono">${formatHours(m.estimatedHours)} / ${formatHours(m.maxHours)} (${bufBadgeStr})</td>
          <td class="mono">
            <span style="color: var(--status-success); font-weight: 600;">${formatHours(t.loggedHours)}</span> /
            <strong>${formatHours(m.effectiveRemainingHours)} left</strong>
          </td>
          <td>${statusBadge}</td>
          <td style="text-align: right;">
            <div style="display: inline-flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end;">
              ${!isHab ? `<button type="button" class="btn btn-xs btn-secondary" data-action="add-dependent-task" data-task-id="${t.id}" title="Place a task that can only start once this task finishes">+ Follow-Up</button>` : ''}
              <button type="button" class="btn btn-xs btn-secondary" data-action="${isHab && habit ? 'edit-habit' : 'edit-task'}" ${isHab && habit ? `data-habit-id="${habit.id}"` : `data-task-id="${t.id}"`}>Edit</button>
              <button type="button" class="btn btn-xs btn-danger-ghost" data-action="${isHab && habit ? 'delete-habit' : 'delete-task'}" ${isHab && habit ? `data-habit-id="${habit.id}"` : `data-task-id="${t.id}"`}>Delete</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

function renderSectionsManagerList() {
  const container = document.getElementById('existing-sections-list');
  if (!container) return;
  container.innerHTML = state.projects
    .map(
      (p) => `
      <div style="display: flex; align-items: center; gap: 10px;">
        <input type="color" value="${p.color}" data-section-color-id="${p.id}" style="width: 34px; height: 32px; border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer;" />
        <input type="text" class="form-input" value="${escapeHtml(p.name)}" data-section-name-id="${p.id}" style="flex: 1; padding: 6px 10px;" />
        ${
          state.projects.length > 1
            ? `<button type="button" class="btn btn-xs btn-danger-ghost" data-action="delete-section" data-section-id="${p.id}">Delete</button>`
            : ''
        }
      </div>
    `
    )
    .join('');
}

function renderProjectFilterChips(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (state.projects.length <= 1) {
    const p = state.projects[0] || { name: 'Work / School', color: '#0F766E' };
    el.innerHTML = `
      <span class="project-pill">
        <span class="project-dot" style="background: ${p.color}"></span>
        ${escapeHtml(p.name)}
      </span>
    `;
    return;
  }
  const chips = [
    `<button type="button" class="filter-chip ${state.selectedProjectFilter === 'ALL' ? 'active' : ''}" data-action="filter-project" data-project-id="ALL">All Sections</button>`,
    ...state.projects.map(
      (p) => `
        <button type="button" class="filter-chip ${state.selectedProjectFilter === p.id ? 'active' : ''}" data-action="filter-project" data-project-id="${p.id}">
          <span class="project-dot" style="background: ${p.color}; display: inline-block; margin-right: 4px;"></span>
          ${escapeHtml(p.name)}
        </button>
      `
    ),
  ];
  el.innerHTML = chips.join('');
}

// -------------------- 3. RENDER STATS & ANALYTICS VIEW --------------------

function getHeatmapLevel(hours) {
  const h = Number(hours) || 0;
  if (h <= 0) return 0;
  if (h < 1.5) return 1;
  if (h < 3.0) return 2;
  if (h < 4.5) return 3;
  return 4;
}

function getDailyLoggedBreakdownMap() {
  const byDate = {};

  for (const ch of state.chunks) {
    if (ch.status !== 'completed') continue;
    const hrs = roundTwo(Number(ch.loggedHours ?? ch.durationHours) || 0);
    if (hrs <= 0) continue;
    if (!byDate[ch.date]) {
      byDate[ch.date] = { chunkHours: 0, logHours: 0, sessions: 0 };
    }
    byDate[ch.date].chunkHours = roundTwo(byDate[ch.date].chunkHours + hrs);
    byDate[ch.date].sessions += 1;
  }

  for (const log of state.logs || []) {
    const hrs = roundTwo(Number(log.loggedHours) || 0);
    if (hrs <= 0 || !log.date) continue;
    if (!byDate[log.date]) {
      byDate[log.date] = { chunkHours: 0, logHours: 0, sessions: 0 };
    }
    byDate[log.date].logHours = roundTwo(byDate[log.date].logHours + hrs);
    if (byDate[log.date].sessions === 0) {
      byDate[log.date].sessions += 1;
    }
  }

  const resolved = {};
  for (const [dStr, info] of Object.entries(byDate)) {
    resolved[dStr] = {
      hours: roundTwo(Math.max(info.chunkHours, info.logHours)),
      sessions: info.sessions,
    };
  }
  return resolved;
}

function renderActivityHeatmap() {
  const gridEl = document.getElementById('stats-activity-heatmap');
  const monthsEl = document.getElementById('stats-heatmap-months');
  const activeDaysPill = document.getElementById('heatmap-active-days-pill');
  const totalHoursPill = document.getElementById('heatmap-total-hours-pill');
  const readoutEl = document.getElementById('heatmap-hover-readout');
  if (!gridEl || !monthsEl) return;

  const todayStr = getTodayStr();
  const currentMonday = getMondayOfWeek(todayStr);
  const WEEKS_TO_SHOW = 26;
  const startMonday = addDays(currentMonday, -(WEEKS_TO_SHOW - 1) * 7);
  const dailyMap = getDailyLoggedBreakdownMap();

  let activeDaysCount = 0;
  let windowTotalHours = 0;
  const weekColsHtml = [];
  const monthLabelsHtml = [];
  let lastMonthSeen = -1;

  for (let w = 0; w < WEEKS_TO_SHOW; w++) {
    const weekMondayStr = addDays(startMonday, w * 7);
    const weekMondayDt = parseDateLocal(weekMondayStr);
    const monthIdx = weekMondayDt.getMonth();

    if (monthIdx !== lastMonthSeen) {
      const mShort = weekMondayDt.toLocaleDateString('en-US', { month: 'short' });
      monthLabelsHtml.push(`<span class="heatmap-month-label">${mShort}</span>`);
      lastMonthSeen = monthIdx;
    } else {
      monthLabelsHtml.push(`<span class="heatmap-month-label"></span>`);
    }

    const cellsHtml = [];
    for (let d = 0; d < 7; d++) {
      const dStr = addDays(weekMondayStr, d);
      const isFuture = dStr > todayStr;
      const isToday = dStr === todayStr;
      const entry = dailyMap[dStr];
      const hrs = !isFuture && entry ? entry.hours : 0;
      const sessions = !isFuture && entry ? entry.sessions : 0;

      if (!isFuture && hrs > 0) {
        activeDaysCount += 1;
        windowTotalHours = roundTwo(windowTotalHours + hrs);
      }

      const level = isFuture ? 0 : getHeatmapLevel(hrs);
      const humanDate = formatHumanDate(dStr, true);
      const tooltip = isFuture
        ? `${humanDate}: Upcoming`
        : hrs > 0
        ? `${humanDate}: ${formatHours(hrs)} logged (${sessions} session${sessions === 1 ? '' : 's'})`
        : `${humanDate}: 0.0h logged`;

      cellsHtml.push(`
        <span
          class="heatmap-cell level-${level} ${isFuture ? 'is-future' : ''} ${isToday ? 'is-today' : ''}"
          data-heatmap-date="${dStr}"
          data-heatmap-hours="${hrs}"
          data-heatmap-sessions="${sessions}"
          data-heatmap-future="${isFuture ? '1' : '0'}"
          title="${escapeHtml(tooltip)}"
          role="gridcell"
          aria-label="${escapeHtml(tooltip)}"
        ></span>
      `);
    }

    weekColsHtml.push(`<div class="heatmap-week-col">${cellsHtml.join('')}</div>`);
  }

  monthsEl.innerHTML = monthLabelsHtml.join('');
  gridEl.innerHTML = weekColsHtml.join('');

  if (activeDaysPill) {
    activeDaysPill.textContent = `${activeDaysCount} active day${activeDaysCount === 1 ? '' : 's'}`;
  }
  if (totalHoursPill) {
    totalHoursPill.textContent = `${formatHours(windowTotalHours)} logged (26w)`;
  }
  if (readoutEl) {
    const todayHours = dailyMap[todayStr]?.hours || 0;
    readoutEl.textContent = `Today (${formatHumanDate(todayStr)}): ${formatHours(todayHours)} logged • Hover any square for details`;
  }
}

function renderStatsView() {
  const todayStr = getTodayStr();

  const pastAndTodayChunks = state.chunks.filter((c) => c.date <= todayStr);
  const expectedHoursToDate = roundTwo(
    pastAndTodayChunks.reduce((acc, c) => acc + (Number(c.durationHours) || 0), 0)
  );
  const loggedHoursToDate = roundTwo(
    pastAndTodayChunks
      .filter((c) => c.status === 'completed')
      .reduce((acc, c) => acc + (Number(c.loggedHours ?? c.durationHours) || 0), 0)
  );

  const productivityPct =
    expectedHoursToDate > 0
      ? Math.round((loggedHoursToDate / expectedHoursToDate) * 100)
      : 100;

  document.getElementById('kpi-productivity-val').textContent = `${productivityPct}%`;
  document.getElementById('kpi-productivity-sub').textContent = `${formatHours(loggedHoursToDate)} logged of ${formatHours(expectedHoursToDate)} expected`;

  let totalPlannedWithBuf = 0;
  let totalProjectedActual = 0;

  for (const t of state.tasks) {
    if (isHabitTask(t)) continue;
    const m = getTaskHoursMetrics(t);
    const projAct = roundTwo((Number(t.loggedHours) || 0) + m.effectiveRemainingHours);
    totalPlannedWithBuf += m.maxHours;
    totalProjectedActual += projAct;
  }

  const accuracyPct =
    totalPlannedWithBuf > 0
      ? Math.max(0, Math.min(150, Math.round((1 - Math.abs(totalProjectedActual - totalPlannedWithBuf) / totalPlannedWithBuf) * 100)))
      : 100;

  document.getElementById('kpi-accuracy-val').textContent = `${accuracyPct}%`;
  document.getElementById('kpi-accuracy-sub').textContent =
    `${formatHours(totalProjectedActual)} actual+rem vs ${formatHours(totalPlannedWithBuf)} max hours`;

  let sevenDayNetWorkCap = 0;
  let sevenDayPlanned = 0;
  for (let i = 0; i < 7; i++) {
    const dStr = addDays(todayStr, i);
    const capInfo = getDailyCapacityInfo(dStr);
    const dayChunks = state.chunks.filter((c) => c.date === dStr);
    const dayLogged = dayChunks
      .filter((c) => c.status === 'completed')
      .reduce((acc, c) => acc + (Number(c.loggedHours ?? c.durationHours) || 0), 0);
    const daySched = dayChunks
      .filter((c) => c.status !== 'completed')
      .reduce((acc, c) => acc + (Number(c.durationHours) || 0), 0);

    sevenDayNetWorkCap += capInfo.netWorkHours;
    sevenDayPlanned += dayLogged + daySched;
  }

  const util7Pct = sevenDayNetWorkCap > 0 ? Math.round((sevenDayPlanned / sevenDayNetWorkCap) * 100) : 0;
  document.getElementById('kpi-utilization-val').textContent = `${util7Pct}%`;
  document.getElementById('kpi-utilization-sub').textContent = `${roundTwo(sevenDayPlanned)}h planned / ${roundTwo(sevenDayNetWorkCap)}h net work pool`;

  const totalLoggedHours = roundTwo(
    state.logs.reduce((acc, l) => acc + (Number(l.loggedHours) || 0), 0)
  );
  const loggedDatesSet = new Set(state.logs.map((l) => l.date));
  let streak = 0;
  for (let i = 0; i < 30; i++) {
    const checkDate = addDays(todayStr, -i);
    if (loggedDatesSet.has(checkDate)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  document.getElementById('kpi-streak-val').textContent = `${Math.max(1, streak)}d streak`;
  document.getElementById('kpi-streak-sub').textContent = `${totalLoggedHours}h total logged focus`;

  renderActivityHeatmap();

  const completedChunks = state.chunks.filter((c) => c.status === 'completed');
  document.getElementById('kpi-throughput-val').textContent = `${completedChunks.length} sessions done`;

  const pastChartEl = document.getElementById('stats-past-vertical-chart');
  const pastDaysData = [];
  let maxDailyVal = 2.0;

  for (let i = -5; i <= 0; i++) {
    const dStr = addDays(todayStr, i);
    const dayChunks = state.chunks.filter((c) => c.date === dStr);
    const expectedHrs = roundTwo(
      dayChunks.reduce((acc, c) => acc + (Number(c.durationHours) || 0), 0)
    );
    const loggedHrs = roundTwo(
      dayChunks
        .filter((c) => c.status === 'completed')
        .reduce((acc, c) => acc + (Number(c.loggedHours ?? c.durationHours) || 0), 0)
    );
    if (expectedHrs > maxDailyVal) maxDailyVal = expectedHrs;
    if (loggedHrs > maxDailyVal) maxDailyVal = loggedHrs;

    pastDaysData.push({
      date: dStr,
      label: i === 0 ? 'Today' : i === -1 ? 'Yest' : formatShortDayLabel(dStr),
      expectedHrs,
      loggedHrs,
    });
  }

  pastChartEl.innerHTML = `
    <div class="v-chart-stage">
      ${pastDaysData
        .map((d) => {
          const expPct = Math.max(4, Math.round((d.expectedHrs / maxDailyVal) * 100));
          const logPct = d.loggedHrs > 0 ? Math.max(6, Math.round((d.loggedHrs / maxDailyVal) * 100)) : 2;
          const dayProd = d.expectedHrs > 0 ? Math.round((d.loggedHrs / d.expectedHrs) * 100) : 100;
          return `
            <div class="v-col-group">
              <div class="v-col-value">${d.loggedHrs}h / ${d.expectedHrs}h</div>
              <div class="v-col-bars">
                <div class="v-bar expected" style="height: ${expPct}%;" title="${d.date} Expected: ${d.expectedHrs}h"></div>
                <div class="v-bar logged" style="height: ${logPct}%;" title="${d.date} Logged: ${d.loggedHrs}h (${dayProd}%)"></div>
              </div>
              <div class="v-col-label">${d.label}</div>
            </div>
          `;
        })
        .join('')}
    </div>
  `;

  const prioEl = document.getElementById('stats-priority-throughput');
  const bands = [
    { code: 'P1', label: 'P1 Critical', color: 'var(--p1-solid)' },
    { code: 'P2', label: 'P2 High', color: 'var(--p2-solid)' },
    { code: 'P3', label: 'P3 Medium', color: 'var(--p3-solid)' },
    { code: 'P4', label: 'P4 Low', color: 'var(--p4-solid)' },
  ];

  let maxBandHrs = 2.0;
  const bandStats = bands.map((b) => {
    const bandChunks = state.chunks.filter((c) => {
      const t = state.tasks.find((task) => task.id === c.taskId);
      return t && t.priority === b.code;
    });
    const doneChunks = bandChunks.filter((c) => c.status === 'completed');
    const loggedHrs = roundTwo(
      doneChunks.reduce((acc, c) => acc + (Number(c.loggedHours ?? c.durationHours) || 0), 0)
    );
    const totalHrs = roundTwo(
      bandChunks.reduce((acc, c) => acc + (Number(c.durationHours) || 0), 0)
    );
    if (totalHrs > maxBandHrs) maxBandHrs = totalHrs;
    if (loggedHrs > maxBandHrs) maxBandHrs = loggedHrs;
    return { ...b, loggedHrs, totalHrs };
  });

  prioEl.innerHTML = `
    <div class="v-chart-stage">
      ${bandStats
        .map((b) => {
          const totPct = Math.max(4, Math.round((b.totalHrs / maxBandHrs) * 100));
          const logPct = b.loggedHrs > 0 ? Math.max(6, Math.round((b.loggedHrs / maxBandHrs) * 100)) : 2;
          return `
            <div class="v-col-group">
              <div class="v-col-value">${b.loggedHrs}h / ${b.totalHrs}h</div>
              <div class="v-col-bars">
                <div class="v-bar expected" style="height: ${totPct}%;" title="${b.label} Expected: ${b.totalHrs}h"></div>
                <div class="v-bar" style="height: ${logPct}%; background: ${b.color};" title="${b.label} Logged: ${b.loggedHrs}h"></div>
              </div>
              <div class="v-col-label"><span class="priority-badge ${b.code}">${b.code}</span></div>
            </div>
          `;
        })
        .join('')}
    </div>
  `;

  const accEl = document.getElementById('stats-accuracy-breakdown');
  accEl.innerHTML = state.tasks
    .filter((t) => !isHabitTask(t))
    .map((t) => {
      const m = getTaskHoursMetrics(t);
      const actualPlusRem = roundTwo((Number(t.loggedHours) || 0) + m.effectiveRemainingHours);
      const maxBar = Math.max(m.maxHours, actualPlusRem, 1);
      const estPct = Math.min(100, Math.round((m.estimatedHours / maxBar) * 100));
      const bufPct = Math.min(100 - estPct, Math.round((m.effectiveBufferHours / maxBar) * 100));

      return `
        <div class="bar-row">
          <div class="bar-row-header">
            <span><span class="priority-badge ${t.priority}" style="font-size:10px; padding:1px 5px; margin-right:6px;">${t.priority}</span>${escapeHtml(t.title)}</span>
            <span class="mono" style="font-size: 12px; color: var(--text-secondary);">
              Est ${formatHours(m.estimatedHours)} / Max ${formatHours(m.maxHours)} (+${m.bufferPct}% buf) • Active <strong>${formatHours(actualPlusRem)}</strong>
            </span>
          </div>
          <div class="dual-bar-track">
            <div style="width: ${estPct}%; background: var(--accent-secondary); height: 100%;" title="Estimated Hours: ${m.estimatedHours}h"></div>
            <div style="width: ${bufPct}%; background: var(--accent-primary); height: 100%;" title="Active Buffer: ${m.effectiveBufferHours}h (+${m.effectiveBufferPct}%)"></div>
          </div>
        </div>
      `;
    })
    .join('');

  const historyEl = document.getElementById('stats-session-history');
  if (state.logs.length === 0) {
    historyEl.innerHTML = `<div class="empty-state">No completed sessions logged yet.</div>`;
  } else {
    const recentLogs = [...state.logs].reverse().slice(0, 6);
    historyEl.innerHTML = `
      <div class="tasks-table-wrap">
        <table class="tasks-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Task</th>
              <th style="text-align: right;">Logged vs. Expected</th>
            </tr>
          </thead>
          <tbody>
            ${recentLogs
              .map((l) => {
                const task = state.tasks.find((t) => t.id === l.taskId);
                return `
                  <tr>
                    <td class="mono">${formatHumanDate(l.date)}</td>
                    <td style="font-weight: 600;">${escapeHtml(task ? task.title : 'Completed Task')}</td>
                    <td class="mono" style="text-align: right;">
                      <strong style="color: var(--status-success);">${formatHours(l.loggedHours)}</strong>
                      <span style="color: var(--text-muted);"> / ${formatHours(l.plannedHours || l.loggedHours)}</span>
                    </td>
                  </tr>
                `;
              })
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }
}
