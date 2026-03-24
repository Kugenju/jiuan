(() => {
window.GAME_RUNTIME = window.GAME_RUNTIME || {};

function createEmptySchedule(slotCount) {
  return Array.from({ length: slotCount }, () => null);
}

function cloneDefaultSchedule(defaultSchedules, archetypeId, fallbackArchetypeId) {
  return [...(defaultSchedules[archetypeId] || defaultSchedules[fallbackArchetypeId] || [])];
}

function findSchedulePreset(schedulePresets, presetId) {
  return schedulePresets.find((item) => item.id === presetId) || null;
}

function clampScheduleIndex(index, slotCount) {
  return Math.max(0, Math.min(index, slotCount - 1));
}

function setSelectedPlanningSlot(rootState, index, options) {
  if (rootState.mode !== "planning") {
    return false;
  }
  rootState.selectedSlot = clampScheduleIndex(index, options.slotCount);
  rootState.selectedActivity =
    rootState.schedule[rootState.selectedSlot] || rootState.selectedActivity || options.fallbackActivityId;
  return true;
}

function assignPlanningActivity(rootState, activityId, options) {
  if (rootState.mode !== "planning" || !options.activityExists(activityId)) {
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
  rootState.schedule = [...preset.schedule];
  rootState.selectedActivity = rootState.schedule[rootState.selectedSlot] || options.fallbackActivityId;
  return true;
}

function clearPlanningSchedule(rootState, slotCount) {
  if (rootState.mode !== "planning") {
    return false;
  }
  rootState.schedule = createEmptySchedule(slotCount);
  return true;
}

function areAllScheduleSlotsFilled(schedule) {
  return schedule.every(Boolean);
}

Object.assign(window.GAME_RUNTIME, {
  createEmptySchedule,
  cloneDefaultSchedule,
  findSchedulePreset,
  setSelectedPlanningSlot,
  assignPlanningActivity,
  applySchedulePreset,
  clearPlanningSchedule,
  areAllScheduleSlotsFilled,
});
})();
