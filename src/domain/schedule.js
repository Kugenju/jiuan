(() => {
window.GAME_RUNTIME = window.GAME_RUNTIME || {};

function createEmptySchedule(slotCount) {
  return Array.from({ length: slotCount }, () => null);
}

function createEmptyWeeklyTimetable(totalDays, slotCount) {
  return Array.from({ length: totalDays }, () => createEmptySchedule(slotCount));
}

function createEmptyScheduleLocks(slotCount) {
  return Array.from({ length: slotCount }, () => false);
}

function normalizeDayTemplate(template, slotCount) {
  return Array.from({ length: slotCount }, (_, index) => template?.[index] || null);
}

function cloneCourseSelectionBlocks(courseSelectionBlocks, archetypeId, fallbackArchetypeId) {
  const commonBlocks = courseSelectionBlocks.commonRequired || [];
  const source = courseSelectionBlocks[archetypeId] || courseSelectionBlocks[fallbackArchetypeId] || [];
  return [...commonBlocks, ...source].map((block) => {
    const cloned = structuredClone(block);
    cloned.selectedCourseId =
      cloned.selectedCourseId ||
      cloned.defaultCourseId ||
      (cloned.selectionMode === "fixed" && cloned.options?.length === 1 ? cloned.options[0] : null);
    return cloned;
  });
}

function buildWeeklyTimetableFromCourseSelection(blocks, totalDays, slotCount) {
  const timetable = createEmptyWeeklyTimetable(totalDays, slotCount);
  (blocks || []).forEach((block) => {
    if (!block?.selectedCourseId) {
      return;
    }
    (block.days || []).forEach((day) => {
      const dayIndex = day - 1;
      if (dayIndex < 0 || dayIndex >= totalDays) {
        return;
      }
      if (block.slotIndex < 0 || block.slotIndex >= slotCount) {
        return;
      }
      timetable[dayIndex][block.slotIndex] = block.selectedCourseId;
    });
  });
  return timetable;
}

function isCourseSelectionComplete(blocks) {
  return Boolean(blocks?.length) && blocks.every((block) => Boolean(block.selectedCourseId));
}

function pickCourseForBlock(rootState, blockId, courseId, options) {
  if (rootState.mode !== "course_selection") {
    return false;
  }
  const block = rootState.courseSelection.blocks.find((item) => item.id === blockId);
  const activity = options.getActivity(courseId);
  if (
    !block ||
    block.selectionMode === "fixed" ||
    !activity ||
    activity.kind !== "course" ||
    !(block.options || []).includes(courseId)
  ) {
    return false;
  }
  block.selectedCourseId = courseId;
  rootState.weeklyTimetable = buildWeeklyTimetableFromCourseSelection(
    rootState.courseSelection.blocks,
    rootState.totalDays,
    options.slotCount
  );
  return true;
}

function buildDailyScheduleFromWeeklyTimetable(weeklyTimetable, day, slotCount) {
  return normalizeDayTemplate(weeklyTimetable?.[day - 1], slotCount);
}

function buildScheduleLocksFromWeeklyTimetable(weeklyTimetable, day, slotCount) {
  return buildDailyScheduleFromWeeklyTimetable(weeklyTimetable, day, slotCount).map((activityId) => Boolean(activityId));
}

function findSchedulePreset(schedulePresets, presetId) {
  return schedulePresets.find((item) => item.id === presetId) || null;
}

function clampScheduleIndex(index, slotCount) {
  return Math.max(0, Math.min(index, slotCount - 1));
}

function findNextEditableSlot(scheduleLocks, startIndex = 0, delta = 1) {
  if (!scheduleLocks.some((locked) => !locked)) {
    return clampScheduleIndex(startIndex, scheduleLocks.length);
  }

  const count = scheduleLocks.length;
  let index = clampScheduleIndex(startIndex, count);
  for (let step = 0; step < count; step += 1) {
    if (!scheduleLocks[index]) {
      return index;
    }
    index = (index + delta + count) % count;
  }
  return clampScheduleIndex(startIndex, count);
}

function countEditableSlots(scheduleLocks) {
  return scheduleLocks.filter((locked) => !locked).length;
}

function countFilledEditableSlots(schedule, scheduleLocks) {
  return schedule.reduce((count, activityId, index) => count + (!scheduleLocks[index] && activityId ? 1 : 0), 0);
}

function setSelectedPlanningSlot(rootState, index, options) {
  if (rootState.mode !== "planning") {
    return false;
  }
  rootState.selectedSlot = clampScheduleIndex(index, options.slotCount);
  if (!rootState.scheduleLocks[rootState.selectedSlot] && rootState.schedule[rootState.selectedSlot]) {
    rootState.selectedActivity = rootState.schedule[rootState.selectedSlot];
  }
  return true;
}

function assignPlanningActivity(rootState, activityId, options) {
  if (rootState.mode !== "planning" || rootState.scheduleLocks[rootState.selectedSlot]) {
    return false;
  }
  const activity = options.getActivity(activityId);
  if (!activity || activity.kind === "course") {
    return false;
  }
  if (typeof options.isActivityAssignable === "function" && !options.isActivityAssignable(rootState, activity)) {
    return false;
  }
  rootState.selectedActivity = activityId;
  rootState.schedule[rootState.selectedSlot] = activityId;
  return true;
}

function applySchedulePreset(rootState, preset, options) {
  if (rootState.mode !== "planning" || !preset) {
    return false;
  }

  let changed = false;
  preset.schedule.forEach((activityId, index) => {
    if (rootState.scheduleLocks[index]) {
      return;
    }
    if (!activityId) {
      rootState.schedule[index] = null;
      changed = true;
      return;
    }
    const activity = options.getActivity(activityId);
    if (!activity || activity.kind === "course") {
      return;
    }
    if (typeof options.isActivityAssignable === "function" && !options.isActivityAssignable(rootState, activity)) {
      return;
    }
    rootState.schedule[index] = activityId;
    changed = true;
  });

  return changed;
}

function clearPlanningSchedule(rootState, slotCount) {
  if (rootState.mode !== "planning") {
    return false;
  }
  for (let index = 0; index < slotCount; index += 1) {
    if (!rootState.scheduleLocks[index]) {
      rootState.schedule[index] = null;
    }
  }
  rootState.selectedSlot = findNextEditableSlot(rootState.scheduleLocks, 0, 1);
  return true;
}

function areAllScheduleSlotsFilled(schedule) {
  return schedule.every(Boolean);
}

Object.assign(window.GAME_RUNTIME, {
  createEmptySchedule,
  createEmptyWeeklyTimetable,
  createEmptyScheduleLocks,
  cloneCourseSelectionBlocks,
  buildWeeklyTimetableFromCourseSelection,
  isCourseSelectionComplete,
  pickCourseForBlock,
  buildDailyScheduleFromWeeklyTimetable,
  buildScheduleLocksFromWeeklyTimetable,
  findSchedulePreset,
  clampScheduleIndex,
  findNextEditableSlot,
  countEditableSlots,
  countFilledEditableSlots,
  setSelectedPlanningSlot,
  assignPlanningActivity,
  applySchedulePreset,
  clearPlanningSchedule,
  areAllScheduleSlotsFilled,
});
})();
