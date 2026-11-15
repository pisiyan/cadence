/**
 * Cadence — Auto-Chunking, Dynamic Reflow & Deficit Diagnostics Engine
 */

function getPrerequisiteTask(task) {
  if (!task || !task.dependsOnTaskId) return null;
  return state.tasks.find((t) => t.id === task.dependsOnTaskId) || null;
}

function isTaskBlockedByPrerequisite(task) {
  const prereq = getPrerequisiteTask(task);
  if (!prereq) return false;
  return !prereq.completed && (Number(prereq.remainingHours) || 0) > 0;
}

function isTaskBlockedByStartDate(task) {
  if (!task || !task.startDate) return false;
  return task.startDate > getTodayStr();
}

function getTaskDependencyDepth(task, visited = new Set()) {
  if (!task || !task.dependsOnTaskId || visited.has(task.id)) return 0;
  visited.add(task.id);
  const prereq = state.tasks.find((t) => t.id === task.dependsOnTaskId);
  if (!prereq || prereq.completed || (Number(prereq.remainingHours) || 0) <= 0) return 0;
  return 1 + getTaskDependencyDepth(prereq, visited);
}

/**
 * Calculates Estimated Hours, Max Hours, % Buffer, and the Intensity-adjusted hours for a task.
 */
function getTaskHoursMetrics(task) {
  const est = Math.max(0.25, Number(task.estimatedHours) || 1);
  const max = Math.max(
    est,
    Number(task.maxHours) !== undefined && !isNaN(Number(task.maxHours))
      ? Number(task.maxHours)
      : roundTwo(est + (Number(task.taskBufferHours) || 0))
  );
  const fullBufferHours = roundTwo(Math.max(0, max - est));
  const bufferPct = est > 0 ? Math.round((fullBufferHours / est) * 100) : 0;

  const todayStr = getTodayStr();
  const fp = state.focusPeriod || { startDate: todayStr, endDate: addDays(todayStr, 6), focusIntensityPct: 0 };
  const intensityPct = Math.max(0, Math.min(100, Number(fp.focusIntensityPct) || 0));

  const taskStartStr = task.startDate && task.startDate > todayStr ? task.startDate : todayStr;
  const taskEndStr = task.deadline >= taskStartStr ? task.deadline : taskStartStr;
  const overlapsFocusPeriod =
    !fp.startDate || !fp.endDate || (taskStartStr <= fp.endDate && taskEndStr >= fp.startDate);

  const reductionRatio = overlapsFocusPeriod ? intensityPct / 100 : 0;
  const effectiveBufferHours = roundTwo(fullBufferHours * (1 - reductionRatio));
  const effectiveBufferPct = Math.round(bufferPct * (1 - reductionRatio));
  const effectiveMaxHours = roundTwo(est + effectiveBufferHours);

  const rawRemaining = Math.max(0, Number(task.remainingHours) || 0);
  const remRatio = max > 0 ? Math.min(1, rawRemaining / max) : 0;
  const unloggedBuffer = roundTwo(fullBufferHours * remRatio);
  const reducedBufferFromRemaining = roundTwo(unloggedBuffer * reductionRatio);
  const effectiveRemainingHours = roundTwo(Math.max(0, rawRemaining - reducedBufferFromRemaining));

  return {
    estimatedHours: est,
    maxHours: max,
    fullBufferHours,
    bufferPct,
    effectiveBufferHours,
    effectiveBufferPct,
    effectiveMaxHours,
    rawRemainingHours: rawRemaining,
    effectiveRemainingHours,
    intensityPct: overlapsFocusPeriod ? intensityPct : 0,
    unloggedBufferHours: roundTwo(Math.max(0, unloggedBuffer - reducedBufferFromRemaining)),
  };
}

function breakIntoSessionChunks(totalHours, minHrs, maxHrs) {
  const result = [];
  let rem = totalHours;
  while (rem > 0.01) {
    let size = Math.min(maxHrs, rem);
    if (rem - size > 0 && rem - size < minHrs) {
      size = roundQuarter(rem / 2);
      if (size < 0.25) size = rem;
    }
    size = roundTwo(size);
    result.push(size);
    rem = roundTwo(rem - size);
  }
  return result;
}

function buildDeficitDiagnosis(task, metrics, windowDates, dayBuckets, allChunksSoFar, minHrs) {
  const windowSet = new Set(windowDates);
  let totalCapInWindow = 0;
  let freeBeforeThisTask = 0;
  let minSessionBlockedHours = 0;

  for (const dStr of windowDates) {
    const b = dayBuckets[dStr];
    if (!b) continue;
    totalCapInWindow += b.effectiveWorkLimit;
    freeBeforeThisTask += b.freeHours;
    if (b.freeHours > 0.05 && b.freeHours < minHrs) {
      minSessionBlockedHours += b.freeHours;
    }
  }

  const blockerMap = {};
  for (const ch of allChunksSoFar) {
    if (!windowSet.has(ch.date)) continue;
    if (ch.taskId === task.id) continue;
    const owner = state.tasks.find((t) => t.id === ch.taskId);
    const label = owner ? owner.title : 'Other session';
    const key = ch.isHabitChunk ? `habit:${label}` : `task:${label}`;
    if (!blockerMap[key]) {
      blockerMap[key] = { title: label, hours: 0, isHabit: Boolean(ch.isHabitChunk || (owner && isHabitTask(owner))) };
    }
    blockerMap[key].hours = roundTwo(blockerMap[key].hours + (Number(ch.durationHours) || 0));
  }

  const topBlockers = Object.values(blockerMap)
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 3);

  const reasons = [];
  if (windowDates.length === 0) {
    reasons.push('No available days between start date/prerequisite and deadline.');
  } else {
    reasons.push(
      `Needs ${formatHours(metrics.effectiveRemainingHours)} across ${windowDates.length} day${windowDates.length === 1 ? '' : 's'} (${formatHumanDate(windowDates[0])} – ${formatHumanDate(task.deadline)}), but only ${formatHours(roundTwo(freeBeforeThisTask))} was open out of ${formatHours(roundTwo(totalCapInWindow))} total capacity.`
    );
  }

  if (topBlockers.length > 0) {
    const blockerStr = topBlockers
      .map((b) => `${b.isHabit ? 'Habit: ' : ''}"${b.title}" (${formatHours(b.hours)})`)
      .join(', ');
    reasons.push(`Capacity taken by: ${blockerStr}.`);
  }

  if (metrics.unloggedBufferHours > 0.05) {
    reasons.push(
      `Includes +${formatHours(metrics.unloggedBufferHours)} of buffer time (Focus Intensity is at ${metrics.intensityPct}%).`
    );
  }

  if (minSessionBlockedHours > 0.05) {
    reasons.push(
      `${formatHours(roundTwo(minSessionBlockedHours))} of small free gaps couldn't be used because Min Session is ${task.minSessionMins || 30}m.`
    );
  }

  if ((Number(task.bufferDays) || 0) > 0) {
    reasons.push(`Target completion is set ${task.bufferDays}d before deadline.`);
  }

  return {
    deficitHours: task.unscheduledDeficitHours,
    neededHours: metrics.effectiveRemainingHours,
    freeHoursBeforeTask: roundTwo(freeBeforeThisTask),
    totalCapInWindow: roundTwo(totalCapInWindow),
    minSessionBlockedHours: roundTwo(minSessionBlockedHours),
    unloggedBufferHours: metrics.unloggedBufferHours,
    topBlockers,
    reasonText: reasons.join(' '),
  };
}

function runChunkingEngine() {
  const todayStr = getTodayStr();

  // Keep scheduled habit backing tasks in sync
  syncHabitTasksWithState();

  const preservedChunks = [];
  for (const ch of state.chunks) {
    const ownerTask = state.tasks.find((t) => t.id === ch.taskId);
    const isHabitCh = Boolean(ch.isHabitChunk || (ownerTask && isHabitTask(ownerTask)));

    if (ch.status === 'completed') {
      preservedChunks.push(ch);
    } else if (ch.date < todayStr || ch.status === 'unreported') {
      if (isHabitCh) {
        // Past uncompleted habit chunks are not carried as overdue backlog
        continue;
      }
      ch.status = 'unreported';
      preservedChunks.push(ch);
    } else if (ch.manualLock && ch.status === 'scheduled') {
      preservedChunks.push(ch);
    }
  }

  const MAX_DAYS = 60;
  const dayBuckets = {};

  for (let i = 0; i <= MAX_DAYS; i++) {
    const dStr = addDays(todayStr, i);
    const capInfo = getDailyCapacityInfo(dStr);
    const inPeriod = isDateInFocusPeriod(dStr);

    const lockedOrCompletedOnDay = preservedChunks
      .filter((c) => c.date === dStr && (c.status === 'completed' || c.manualLock))
      .reduce((acc, c) => acc + (Number(c.status === 'completed' ? (c.loggedHours ?? c.durationHours) : c.durationHours) || 0), 0);

    const lockedHabitOnDay = preservedChunks
      .filter((c) => {
        if (c.date !== dStr) return false;
        const owner = state.tasks.find((t) => t.id === c.taskId);
        return Boolean(c.isHabitChunk || (owner && isHabitTask(owner)));
      })
      .reduce((acc, c) => acc + (Number(c.status === 'completed' ? (c.loggedHours ?? c.durationHours) : c.durationHours) || 0), 0);

    const effectiveWorkLimit = capInfo.netWorkHours;
    const netAvailable = Math.max(0, roundTwo(effectiveWorkLimit - lockedOrCompletedOnDay));

    dayBuckets[dStr] = {
      date: dStr,
      totalHours: capInfo.totalHours,
      netWorkHours: capInfo.netWorkHours,
      effectiveWorkLimit,
      inFocusPeriod: inPeriod,
      habitReservedHours: roundTwo(lockedHabitOnDay),
      completedHours: roundTwo(lockedOrCompletedOnDay),
      scheduledHours: 0,
      freeHours: netAvailable,
    };
  }

  for (const t of state.tasks) {
    t.unscheduledDeficitHours = 0;
    t.usingBufferDays = false;
    t.deficitDiagnosis = null;
  }

  const newlyScheduledChunks = [];

  // 1. Materialize scheduled habit chunks on their customisable cycle dates
  for (const h of state.habits) {
    if (!isHabitScheduled(h)) continue;
    const habitTask = state.tasks.find((t) => t.id === getHabitTaskId(h.id));
    if (!habitTask) continue;
    const hrs = Math.max(0.25, roundTwo((Number(h.durationMins) || 30) / 60));

    const habitChunksForTask = [];
    for (let i = 0; i <= MAX_DAYS; i++) {
      const dStr = addDays(todayStr, i);
      if (!isHabitScheduledOnDate(h, dStr)) continue;

      const existingOnDay = preservedChunks.some(
        (c) => c.taskId === habitTask.id && c.date === dStr
      );
      if (existingOnDay) continue;

      const periodKey = getHabitPeriodKey(h, dStr);
      const isCheckedInHabit = Boolean(h.completedPeriods && h.completedPeriods[periodKey]);

      if (isCheckedInHabit && dStr === todayStr) {
        // Already checked off for today's period; reflect as completed without consuming free hours
        newlyScheduledChunks.push({
          id: uid('chk_hab'),
          taskId: habitTask.id,
          date: dStr,
          durationHours: hrs,
          loggedHours: hrs,
          status: 'completed',
          isHabitChunk: true,
          habitId: h.id,
          completedAt: new Date().toISOString(),
        });
        continue;
      }

      const bucket = dayBuckets[dStr];
      if (bucket) {
        bucket.freeHours = Math.max(0, roundTwo(bucket.freeHours - hrs));
        bucket.scheduledHours = roundTwo(bucket.scheduledHours + hrs);
        bucket.habitReservedHours = roundTwo(bucket.habitReservedHours + hrs);
      }

      habitChunksForTask.push({
        id: uid('chk_hab'),
        taskId: habitTask.id,
        date: dStr,
        durationHours: hrs,
        loggedHours: 0,
        status: 'scheduled',
        isHabitChunk: true,
        habitId: h.id,
      });
    }

    const totalHabitChunks =
      preservedChunks.filter((c) => c.taskId === habitTask.id).length + habitChunksForTask.length;
    let idxCounter = 1;
    preservedChunks
      .filter((c) => c.taskId === habitTask.id)
      .forEach((c) => {
        c.chunkIndex = idxCounter++;
        c.totalChunks = totalHabitChunks;
      });
    for (const c of habitChunksForTask) {
      c.chunkIndex = idxCounter++;
      c.totalChunks = totalHabitChunks;
      newlyScheduledChunks.push(c);
    }
  }

  // 2. Sort normal active tasks topologically by Earliest Target Date -> Hard Deadline -> Priority.
  //    Only a task's own prerequisite blocks it; unrelated tasks due weeks later will never jump ahead of urgent follow-ups.
  const rawActiveTasks = state.tasks.filter(
    (t) => !isHabitTask(t) && !t.completed && t.remainingHours > 0
  );
  const activeTaskMap = new Map(rawActiveTasks.map((t) => [t.id, t]));
  const dependentsMap = new Map();
  const inDegree = new Map();

  for (const t of rawActiveTasks) {
    inDegree.set(t.id, 0);
    dependentsMap.set(t.id, []);
  }
  for (const t of rawActiveTasks) {
    if (t.dependsOnTaskId && activeTaskMap.has(t.dependsOnTaskId)) {
      inDegree.set(t.id, 1);
      dependentsMap.get(t.dependsOnTaskId).push(t);
    }
  }

  const compareReadyTasks = (a, b) => {
    const targetA = getTargetCompletionDate(a);
    const targetB = getTargetCompletionDate(b);
    if (targetA !== targetB) return targetA.localeCompare(targetB);
    if (a.deadline !== b.deadline) return a.deadline.localeCompare(b.deadline);
    const pDiff = (PRIORITY_RANK[a.priority] || 4) - (PRIORITY_RANK[b.priority] || 4);
    if (pDiff !== 0) return pDiff;
    const depthDiff = getTaskDependencyDepth(a) - getTaskDependencyDepth(b);
    if (depthDiff !== 0) return depthDiff;
    return (a.createdAt || '').localeCompare(b.createdAt || '');
  };

  const ready = rawActiveTasks.filter((t) => inDegree.get(t.id) === 0);
  const activeTasks = [];
  const visitedIds = new Set();

  while (ready.length > 0) {
    ready.sort(compareReadyTasks);
    const nextTask = ready.shift();
    if (visitedIds.has(nextTask.id)) continue;
    visitedIds.add(nextTask.id);
    activeTasks.push(nextTask);

    for (const dep of dependentsMap.get(nextTask.id) || []) {
      const remDeg = (inDegree.get(dep.id) || 0) - 1;
      inDegree.set(dep.id, remDeg);
      if (remDeg <= 0 && !visitedIds.has(dep.id)) {
        ready.push(dep);
      }
    }
  }

  // Fallback for any cycle in dependencies
  if (activeTasks.length < rawActiveTasks.length) {
    const remaining = rawActiveTasks
      .filter((t) => !visitedIds.has(t.id))
      .sort(compareReadyTasks);
    activeTasks.push(...remaining);
  }

  const taskLastScheduledDate = {};

  for (const task of activeTasks) {
    const metrics = getTaskHoursMetrics(task);
    if (task.deadline < todayStr) {
      const hasUnreported = preservedChunks.some(
        (c) => c.taskId === task.id && c.status === 'unreported'
      );
      if (!hasUnreported && metrics.effectiveRemainingHours > 0) {
        preservedChunks.push({
          id: uid('chk_overdue'),
          taskId: task.id,
          date: task.deadline,
          durationHours: roundTwo(Math.min(metrics.effectiveRemainingHours, (task.maxSessionMins || 60) / 60)),
          loggedHours: 0,
          status: 'unreported',
          chunkIndex: 1,
          totalChunks: 1,
        });
      }
      taskLastScheduledDate[task.id] = todayStr;
      continue;
    }

    const alreadyAllocatedHours = preservedChunks
      .filter((c) => c.taskId === task.id && (c.status === 'unreported' || c.manualLock))
      .reduce((acc, c) => acc + (Number(c.durationHours) || 0), 0);

    let toSchedule = roundTwo(Math.max(0, metrics.effectiveRemainingHours - alreadyAllocatedHours));
    if (toSchedule <= 0.01) continue;

    const minHrs = Math.max(0.25, roundTwo((Number(task.minSessionMins) || 30) / 60));
    const maxHrs = Math.max(minHrs, roundTwo((Number(task.maxSessionMins) || 60) / 60));

    let startOffsetDays = 0;
    if (task.startDate && task.startDate > todayStr) {
      startOffsetDays = Math.max(startOffsetDays, Math.min(MAX_DAYS, diffDays(todayStr, task.startDate)));
    }
    if (isTaskBlockedByPrerequisite(task)) {
      const prereq = getPrerequisiteTask(task);
      const prereqFinishStr =
        taskLastScheduledDate[prereq.id] ||
        (prereq.deadline >= todayStr ? getTargetCompletionDate(prereq) : todayStr);
      startOffsetDays = Math.max(startOffsetDays, Math.min(MAX_DAYS, diffDays(todayStr, prereqFinishStr)));
    }

    const targetDateStr = getTargetCompletionDate(task);
    const rawTargetDays = Math.max(0, Math.min(MAX_DAYS, diffDays(todayStr, targetDateStr)));
    const rawHardDeadlineDays = Math.max(0, Math.min(MAX_DAYS, diffDays(todayStr, task.deadline)));

    const targetDaysCount = Math.max(startOffsetDays, rawTargetDays);
    const hardDeadlineDaysCount = Math.max(targetDaysCount, rawHardDeadlineDays);

    const preferredDates = [];
    for (let d = startOffsetDays; d <= targetDaysCount; d++) {
      preferredDates.push(addDays(todayStr, d));
    }

    const bufferWindowDates = [];
    for (let d = targetDaysCount + 1; d <= hardDeadlineDaysCount; d++) {
      bufferWindowDates.push(addDays(todayStr, d));
    }

    const fullWindowDates = [...preferredDates, ...bufferWindowDates];
    // Snapshot availability before allocating this task for accurate diagnostics
    const snapshotBuckets = {};
    for (const dStr of fullWindowDates) {
      if (dayBuckets[dStr]) {
        snapshotBuckets[dStr] = { ...dayBuckets[dStr] };
      }
    }
    const allChunksBeforeTask = [...preservedChunks, ...newlyScheduledChunks];

    const taskGeneratedChunks = [];

    const allocateAcrossDates = (datesList, isBufferWindow = false) => {
      if (toSchedule <= 0.01 || datesList.length === 0) return;

      if (
        (state.distributionStrategy === 'spread' || state.distributionStrategy === 'buffer_paced') &&
        datesList.length > 1
      ) {
        const nominalChunks = breakIntoSessionChunks(toSchedule, minHrs, maxHrs);
        let dayCursor = 0;
        for (const desiredSize of nominalChunks) {
          let remPiece = desiredSize;
          let attempts = 0;
          while (remPiece > 0.01 && attempts < datesList.length * 2) {
            const dStr = datesList[dayCursor % datesList.length];
            dayCursor++;
            attempts++;
            const bucket = dayBuckets[dStr];
            if (!bucket || bucket.freeHours <= 0.05) continue;

            const alloc = roundTwo(Math.min(remPiece, maxHrs, bucket.freeHours));
            if (alloc >= 0.1) {
              bucket.freeHours = roundTwo(bucket.freeHours - alloc);
              bucket.scheduledHours = roundTwo(bucket.scheduledHours + alloc);
              if (isBufferWindow) task.usingBufferDays = true;
              taskGeneratedChunks.push({
                id: uid('chk'),
                taskId: task.id,
                date: dStr,
                durationHours: alloc,
                loggedHours: 0,
                status: 'scheduled',
              });
              remPiece = roundTwo(remPiece - alloc);
              toSchedule = roundTwo(toSchedule - alloc);
            }
          }
        }
      }

      if (toSchedule > 0.01) {
        for (const dStr of datesList) {
          if (toSchedule <= 0.01) break;
          const bucket = dayBuckets[dStr];
          if (!bucket || bucket.freeHours <= 0.05) continue;

          while (toSchedule > 0.01 && bucket.freeHours >= Math.min(minHrs, toSchedule)) {
            let chunkLen = Math.min(maxHrs, toSchedule, bucket.freeHours);
            chunkLen = roundQuarter(chunkLen);
            if (chunkLen <= 0) chunkLen = roundTwo(Math.min(toSchedule, bucket.freeHours));
            if (chunkLen <= 0.01) break;

            const leftover = roundTwo(toSchedule - chunkLen);
            if (leftover > 0 && leftover < minHrs) {
              if (chunkLen + leftover <= maxHrs && chunkLen + leftover <= bucket.freeHours) {
                chunkLen = roundTwo(chunkLen + leftover);
              } else if (toSchedule >= minHrs * 2) {
                chunkLen = roundQuarter(toSchedule - minHrs);
                if (chunkLen < minHrs) break;
              }
            }

            bucket.freeHours = roundTwo(bucket.freeHours - chunkLen);
            bucket.scheduledHours = roundTwo(bucket.scheduledHours + chunkLen);
            toSchedule = roundTwo(toSchedule - chunkLen);
            if (isBufferWindow) task.usingBufferDays = true;

            taskGeneratedChunks.push({
              id: uid('chk'),
              taskId: task.id,
              date: dStr,
              durationHours: chunkLen,
              loggedHours: 0,
              status: 'scheduled',
            });
          }
        }
      }
    };

    allocateAcrossDates(preferredDates, false);

    if (toSchedule > 0.01 && bufferWindowDates.length > 0) {
      allocateAcrossDates(bufferWindowDates, true);
    }

    if (toSchedule > 0.05) {
      task.unscheduledDeficitHours = roundTwo(toSchedule);
      task.deficitDiagnosis = buildDeficitDiagnosis(
        task,
        metrics,
        fullWindowDates,
        snapshotBuckets,
        allChunksBeforeTask,
        minHrs
      );
    }

    taskGeneratedChunks.sort((a, b) => a.date.localeCompare(b.date));
    if (taskGeneratedChunks.length > 0) {
      taskLastScheduledDate[task.id] = taskGeneratedChunks[taskGeneratedChunks.length - 1].date;
    } else {
      const lockedDates = preservedChunks
        .filter((c) => c.taskId === task.id)
        .map((c) => c.date)
        .sort();
      taskLastScheduledDate[task.id] = lockedDates[lockedDates.length - 1] || todayStr;
    }

    const existingTaskChunksCount = preservedChunks.filter((c) => c.taskId === task.id).length;
    const totalCount = existingTaskChunksCount + taskGeneratedChunks.length;

    preservedChunks
      .filter((c) => c.taskId === task.id)
      .forEach((c, idx) => {
        c.chunkIndex = idx + 1;
        c.totalChunks = totalCount;
      });

    taskGeneratedChunks.forEach((c, idx) => {
      c.chunkIndex = existingTaskChunksCount + idx + 1;
      c.totalChunks = totalCount;
      newlyScheduledChunks.push(c);
    });
  }

  state.chunks = [...preservedChunks, ...newlyScheduledChunks];
  saveState();
}
