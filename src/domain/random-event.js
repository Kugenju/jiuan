(() => {
window.GAME_RUNTIME = window.GAME_RUNTIME || {};

const {
  applyEffectBundleToRoot,
  normalizePlayerState,
} = window.GAME_RUNTIME;

function checkThresholdGroup(values, thresholds, comparator) {
  return Object.entries(thresholds || {}).every(([key, value]) => comparator(values[key], value));
}

function resolveRandomEventSkill(rootState, activity, event, context) {
  const bonus = event.skillBonus;
  if (!bonus) {
    return null;
  }

  if (bonus.source === "activitySkill" && activity.skill) {
    return activity.skill;
  }
  if (bonus.source === "latestCourseSkill" && rootState.today.latestCourseSkill) {
    return rootState.today.latestCourseSkill;
  }
  if (bonus.source === "mainFocusSkill") {
    const focus = context.getMainFocusSkill();
    if (focus) {
      return focus;
    }
  }

  if (bonus.fallbackSource === "activitySkill" && activity.skill) {
    return activity.skill;
  }
  if (bonus.fallbackSource === "latestCourseSkill" && rootState.today.latestCourseSkill) {
    return rootState.today.latestCourseSkill;
  }
  if (bonus.fallbackSource === "mainFocusSkill") {
    return context.getMainFocusSkill();
  }

  return null;
}

function randomEventMatchesState(rootState, event, activity, slotIndex) {
  const condition = event.condition || {};

  if (condition.activityIds?.length && !condition.activityIds.includes(activity.id)) {
    return false;
  }
  if (condition.activityKinds?.length && !condition.activityKinds.includes(activity.kind)) {
    return false;
  }
  if (condition.slotIndexes?.length && !condition.slotIndexes.includes(slotIndex)) {
    return false;
  }
  if (typeof condition.minDay === "number" && rootState.day < condition.minDay) {
    return false;
  }
  if (typeof condition.maxDay === "number" && rootState.day > condition.maxDay) {
    return false;
  }
  if (!checkThresholdGroup(rootState.stats, condition.minStats, (left, right) => left >= right)) {
    return false;
  }
  if (!checkThresholdGroup(rootState.stats, condition.maxStats, (left, right) => left <= right)) {
    return false;
  }
  if (!checkThresholdGroup(rootState.skills, condition.minSkills, (left, right) => left >= right)) {
    return false;
  }
  if (!checkThresholdGroup(rootState.skills, condition.maxSkills, (left, right) => left <= right)) {
    return false;
  }
  if (!checkThresholdGroup(rootState.relationships, condition.minRelationships, (left, right) => left >= right)) {
    return false;
  }
  if (!checkThresholdGroup(rootState.relationships, condition.maxRelationships, (left, right) => left <= right)) {
    return false;
  }
  if (!checkThresholdGroup(rootState.today.kinds || {}, condition.minKinds, (left = 0, right) => left >= right)) {
    return false;
  }

  if (event.oncePerDay && rootState.today.randomEvents.some((entry) => entry.id === event.id)) {
    return false;
  }

  return true;
}

function applyRandomEventToState(rootState, event, activity, slotIndex, context) {
  const notes = [];
  applyEffectBundleToRoot(rootState, event.effect);

  if (event.note) {
    notes.push(event.note);
  }

  if (event.skillBonus) {
    const skill = resolveRandomEventSkill(rootState, activity, event, context);
    if (skill) {
      rootState.skills[skill] += event.skillBonus.amount;
      notes.push(
        event.skillBonus.noteTemplate
          .replace("{skill}", context.skillLabels[skill])
          .replace("{amount}", String(event.skillBonus.amount))
      );
    } else if (event.skillBonus.fallbackNote) {
      notes.push(event.skillBonus.fallbackNote);
    }
  }

  rootState.today.randomEvents.push({
    id: event.id,
    slotIndex,
    activityId: activity.id,
  });

  normalizePlayerState(rootState);

  const story = event.story
    ? {
        title: event.story.title,
        body: event.story.body,
        speaker:
          context.uiText.speakers[event.story.speakerKey] ||
          context.uiText.speakers.assignment ||
          context.uiText.speakers.course ||
          context.uiText.speakers.routine,
      }
    : null;

  context.addLog(`随机事件 · ${event.title}`, event.logBody || notes.join(" "));
  return {
    event,
    notesText: notes.join(" "),
    story,
  };
}

function triggerRandomEventForTiming(rootState, slotIndex, activity, timing, context) {
  const events = context.randomEvents || [];
  const matching = events.filter(
    (event) => (event.timing || "after") === timing && randomEventMatchesState(rootState, event, activity, slotIndex)
  );

  for (const event of matching) {
    const chance = typeof event.chance === "number" ? event.chance : 1;
    if (rootState.rng() > chance) {
      continue;
    }
    return applyRandomEventToState(rootState, event, activity, slotIndex, context);
  }

  return null;
}

Object.assign(window.GAME_RUNTIME, {
  randomEventMatchesState,
  triggerRandomEventForTiming,
});
})();
