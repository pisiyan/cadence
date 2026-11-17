/**
 * Cadence — Habits, Customisable Cycles, Timeless Checklists & Habit-Task Sync
 */

const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function isHabitTimeless(habit) {
  return !habit || habit.frequency === 'timeless';
}

/**
 * Returns true if the habit has a time duration (becomes an actual scheduled task).
 * Returns false if the habit has NO time duration (lives in the side checklist only, never in tasks).
 */
function habitHasDuration(habit) {
  if (!habit) return false;
  if (typeof habit.hasDuration === 'boolean') return habit.hasDuration;
  return Boolean(habit.consumesCapacity && habit.frequency !== 'timeless');
}

function isHabitScheduled(habit) {
  return Boolean(habit && habitHasDuration(habit) && habit.frequency !== 'timeless');
}

function getHabitTaskId(habitId) {
  return `task_habit_${habitId}`;
}

function isHabitTask(task) {
  return Boolean(task && (task.isHabitTask || task.taskType === 'habit'));
}

function isHabitScheduledOnDate(habit, dateStr) {
  if (!habit || habit.frequency === 'timeless') return false;
  if (habit.skippedDates && habit.skippedDates[dateStr]) return false;
  const anchor = habit.anchorDate || getTodayStr();
  if (dateStr < anchor && dateStr !== getTodayStr()) {
    // Allow dates on or after today even if anchorDate was set to today
    // Only skip if anchorDate is intentionally in the future
    if (anchor > getTodayStr() && dateStr < anchor) return false;
  }

  const dt = parseDateLocal(dateStr);
  const dow = dt.getDay();
  const dom = dt.getDate();
  const interval = Math.max(1, Number(habit.intervalCount) || 1);

  if (habit.frequency === 'daily') {
    if (interval === 1) return true;
    const dDiff = diffDays(anchor, dateStr);
    return dDiff >= 0 ? dDiff % interval === 0 : Math.abs(dDiff) % interval === 0;
  }

  if (habit.frequency === 'custom') {
    const dDiff = diffDays(anchor, dateStr);
    return dDiff >= 0 ? dDiff % interval === 0 : Math.abs(dDiff) % interval === 0;
  }

  if (habit.frequency === 'weekly') {
    const days = Array.isArray(habit.daysOfWeek) && habit.daysOfWeek.length > 0
      ? habit.daysOfWeek
      : [parseDateLocal(anchor).getDay()];
    if (!days.includes(dow)) return false;
    if (interval === 1) return true;
    const anchorMon = getMondayOfWeek(anchor);
    const dateMon = getMondayOfWeek(dateStr);
    const weeksDiff = Math.round(diffDays(anchorMon, dateMon) / 7);
    return weeksDiff >= 0 ? weeksDiff % interval === 0 : Math.abs(weeksDiff) % interval === 0;
  }

  if (habit.frequency === 'monthly') {
    const targetDom = Math.max(1, Math.min(31, Number(habit.dayOfMonth) || 1));
    const lastDayOfMonth = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
    const effectiveDom = Math.min(targetDom, lastDayOfMonth);
    if (dom !== effectiveDom) return false;
    if (interval === 1) return true;
    const anchorDt = parseDateLocal(anchor);
    const monthsDiff = (dt.getFullYear() - anchorDt.getFullYear()) * 12 + (dt.getMonth() - anchorDt.getMonth());
    return monthsDiff >= 0 ? monthsDiff % interval === 0 : Math.abs(monthsDiff) % interval === 0;
  }

  return false;
}

function getHabitPeriodKey(habitOrFreq, dateStr = getTodayStr()) {
  if (!habitOrFreq) return dateStr;
  if (typeof habitOrFreq === 'string') {
    if (habitOrFreq === 'timeless') return 'timeless';
    if (habitOrFreq === 'daily' || habitOrFreq === 'custom') return dateStr;
    const dt = parseDateLocal(dateStr);
    if (habitOrFreq === 'weekly') {
      return `week_${getMondayOfWeek(dateStr)}`;
    }
    if (habitOrFreq === 'monthly') {
      return `month_${dt.getFullYear()}_${String(dt.getMonth() + 1).padStart(2, '0')}`;
    }
    return dateStr;
  }

  const h = habitOrFreq;
  if (h.frequency === 'timeless') return 'timeless';
  if (h.frequency === 'daily' || h.frequency === 'custom') return dateStr;
  if (h.frequency === 'weekly') {
    if (Array.isArray(h.daysOfWeek) && h.daysOfWeek.length > 1) {
      return dateStr;
    }
    return `week_${getMondayOfWeek(dateStr)}`;
  }
  if (h.frequency === 'monthly') {
    const dt = parseDateLocal(dateStr);
    return `month_${dt.getFullYear()}_${String(dt.getMonth() + 1).padStart(2, '0')}`;
  }
  return dateStr;
}

function getHabitCycleSummary(habit) {
  if (!habit) return '';
  const interval = Math.max(1, Number(habit.intervalCount) || 1);
  if (habit.frequency === 'timeless') {
    return 'No cycle (One-off / Timeless)';
  }
  if (habit.frequency === 'daily') {
    return interval === 1 ? 'Daily cycle' : `Every ${interval} days`;
  }
  if (habit.frequency === 'custom') {
    return `Every ${interval} day${interval === 1 ? '' : 's'}`;
  }
  if (habit.frequency === 'weekly') {
    const days = Array.isArray(habit.daysOfWeek) && habit.daysOfWeek.length > 0
      ? habit.daysOfWeek.slice().sort((a, b) => a - b).map((d) => DAY_NAMES_SHORT[d]).join(', ')
      : 'Weekly';
    return interval === 1 ? `Weekly (${days})` : `Every ${interval}w (${days})`;
  }
  if (habit.frequency === 'monthly') {
    const dom = Math.max(1, Math.min(31, Number(habit.dayOfMonth) || 1));
    return interval === 1 ? `Monthly (Day ${dom})` : `Every ${interval}mo (Day ${dom})`;
  }
  return habit.frequency || 'Daily cycle';
}

function ensureHabitBackingTask(habit) {
  const taskId = getHabitTaskId(habit.id);
  const hrs = Math.max(0.25, roundTwo((Number(habit.durationMins) || 30) / 60));
  const todayStr = getTodayStr();
  let task = state.tasks.find((t) => t.id === taskId);

  if (!task) {
    task = {
      id: taskId,
      title: habit.title,
      projectId: habit.projectId || state.projects[0]?.id || 'proj_work_school',
      priority: habit.priority || 'P2',
      estimatedHours: hrs,
      maxHours: hrs,
      remainingHours: hrs,
      loggedHours: 0,
      deadline: addDays(todayStr, 60),
      bufferDays: 0,
      minSessionMins: Number(habit.durationMins) || 30,
      maxSessionMins: Number(habit.durationMins) || 30,
      notes: `${getHabitCycleSummary(habit)} • Timed Habit`,
      completed: false,
      isHabitTask: true,
      taskType: 'habit',
      habitId: habit.id,
      createdAt: todayStr,
    };
    state.tasks.push(task);
  } else {
    task.title = habit.title;
    task.projectId = habit.projectId || task.projectId || state.projects[0]?.id || 'proj_work_school';
    task.priority = habit.priority || task.priority || 'P2';
    task.estimatedHours = hrs;
    task.maxHours = hrs;
    task.remainingHours = hrs;
    task.minSessionMins = Number(habit.durationMins) || 30;
    task.maxSessionMins = Number(habit.durationMins) || 30;
    task.deadline = addDays(todayStr, 60);
    task.bufferDays = 0;
    task.completed = false;
    task.isHabitTask = true;
    task.taskType = 'habit';
    task.habitId = habit.id;
    if (!task.notes || task.notes.includes('Habit')) {
      task.notes = `${getHabitCycleSummary(habit)} • Timed Habit`;
    }
  }
  return task;
}

function syncHabitTasksWithState() {
  const activeScheduledHabitIds = new Set(
    state.habits.filter((h) => isHabitScheduled(h)).map((h) => h.id)
  );

  // Remove backing tasks for any habit without a time duration or that was deleted
  state.tasks = state.tasks.filter((t) => {
    if (!isHabitTask(t)) return true;
    return activeScheduledHabitIds.has(t.habitId);
  });

  for (const h of state.habits) {
    if (isHabitScheduled(h)) {
      ensureHabitBackingTask(h);
    }
  }
}

function getHabitReservationForDate(dateStr) {
  let reservedHours = 0;
  const activeHabits = [];

  for (const h of state.habits) {
    if (!isHabitScheduled(h)) continue;
    if (isHabitScheduledOnDate(h, dateStr)) {
      const hrs = roundTwo((Number(h.durationMins) || 0) / 60);
      reservedHours += hrs;
      activeHabits.push({ ...h, reservedHours: hrs });
    }
  }

  return {
    reservedHours: roundTwo(reservedHours),
    activeHabits,
  };
}
