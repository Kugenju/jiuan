(() => {
window.GAME_RUNTIME = window.GAME_RUNTIME || {};

const {
  applyEffectBundleToRoot,
  normalizePlayerState,
  triggerStoryBeatForActivity,
} = window.GAME_RUNTIME;

function findDayModifier(dayModifiers, rootState) {
  const template = dayModifiers.find((modifier) => {
    const value = rootState.stats[modifier.condition.stat];
    if (typeof modifier.condition.min === "number" && value < modifier.condition.min) {
      return false;
    }
    if (typeof modifier.condition.max === "number" && value > modifier.condition.max) {
      return false;
    }
    return true;
  });

  return template ? { ...structuredClone(template), used: false } : null;
}

function consumeDayModifierForActivity(rootState, activity, copy) {
  if (!rootState.dayModifier || rootState.dayModifier.used) {
    return "";
  }
  if (rootState.dayModifier.consumeOn === "study" && activity.tone !== "study") {
    return "";
  }
  applyEffectBundleToRoot(rootState, rootState.dayModifier.effect);
  rootState.dayModifier.used = true;
  return copy.dayModifierApplied(rootState.dayModifier.title);
}

function ensureTodayCollections(rootState) {
  rootState.today.kinds = rootState.today.kinds || { course: 0, assignment: 0, routine: 0 };
  rootState.today.focus = rootState.today.focus || {};
  rootState.today.courseSkills = rootState.today.courseSkills || {};
  rootState.today.courses = rootState.today.courses || [];
  rootState.today.assignments = rootState.today.assignments || [];
  rootState.today.randomEvents = rootState.today.randomEvents || [];
  rootState.today.actions = rootState.today.actions || [];
  if (!Object.prototype.hasOwnProperty.call(rootState.today, "latestCourseSkill")) {
    rootState.today.latestCourseSkill = null;
  }
}

function trackActivityOnTodayState(rootState, activity, slotIndex) {
  ensureTodayCollections(rootState);
  rootState.today.actions.push(activity.id);
  rootState.today.tones[activity.tone] += 1;
  rootState.today.kinds[activity.kind] += 1;

  if (activity.skill) {
    rootState.today.focus[activity.skill] = (rootState.today.focus[activity.skill] || 0) + 1;
  }

  if (activity.kind === "course") {
    rootState.today.latestCourseSkill = activity.skill || rootState.today.latestCourseSkill;
    rootState.today.courses.push({
      id: activity.id,
      skill: activity.skill || null,
      slotIndex,
    });
    if (activity.skill) {
      rootState.today.courseSkills[activity.skill] = (rootState.today.courseSkills[activity.skill] || 0) + 1;
    }
  }

  if (activity.kind === "assignment") {
    rootState.today.assignments.push({
      id: activity.id,
      slotIndex,
      linkedSkill: rootState.today.latestCourseSkill,
    });
  }
}

function resolveAssignmentSkill(rootState, activity, context) {
  const protocol = activity.assignment;
  if (!protocol) {
    return null;
  }

  if (protocol.skillSource === "latestCourseSkill" && rootState.today.latestCourseSkill) {
    return rootState.today.latestCourseSkill;
  }

  if (protocol.skillSource === "mainFocusSkill") {
    const focusSkill = context.getMainFocusSkill();
    if (focusSkill) {
      return focusSkill;
    }
  }

  if (protocol.fallbackSkillSource === "latestCourseSkill" && rootState.today.latestCourseSkill) {
    return rootState.today.latestCourseSkill;
  }

  if (protocol.fallbackSkillSource === "mainFocusSkill") {
    return context.getMainFocusSkill();
  }

  return null;
}

function getActivitySpeaker(activity, uiText) {
  if (activity.kind === "course") {
    return uiText.speakers.course;
  }
  if (activity.kind === "assignment") {
    return uiText.speakers.assignment || uiText.speakers.course || uiText.speakers.routine;
  }
  return uiText.speakers.routine;
}

function applyAssignmentProtocol(rootState, activity, context, notes) {
  if (activity.kind !== "assignment" || !activity.assignment) {
    return;
  }

  const skill = resolveAssignmentSkill(rootState, activity, context);
  if (skill) {
    rootState.skills[skill] += activity.assignment.amount;
    notes.push(
      activity.assignment.noteTemplate
        .replace("{skill}", context.skillLabels[skill])
        .replace("{amount}", String(activity.assignment.amount))
    );
    return;
  }

  if (activity.assignment.fallbackNote) {
    notes.push(activity.assignment.fallbackNote);
  }
}

function applyActivityToState(rootState, activity, slotIndex, context) {
  const preferredSlots = Array.isArray(activity.preferred) ? activity.preferred : [];
  const isPreferred = preferredSlots.includes(slotIndex);
  const modifierNote = consumeDayModifierForActivity(rootState, activity, context.copy);

  trackActivityOnTodayState(rootState, activity, slotIndex);

  const notes = [];
  if (modifierNote) {
    notes.push(modifierNote);
  }

  applyEffectBundleToRoot(rootState, activity.effects);
  if (activity.notes?.base) {
    notes.push(activity.notes.base);
  }

  if (isPreferred && activity.preferredEffects) {
    applyEffectBundleToRoot(rootState, activity.preferredEffects);
    if (activity.notes?.preferred) {
      notes.push(activity.notes.preferred);
    }
  }

  applyAssignmentProtocol(rootState, activity, context, notes);

  triggerStoryBeatForActivity(rootState, activity, notes, context.storyBeats);
  normalizePlayerState(rootState);
  context.addLog(`${context.slotNames[slotIndex]} · ${activity.name}`, notes.join(" "));
  return notes.join(" ");
}

Object.assign(window.GAME_RUNTIME, {
  findDayModifier,
  getActivitySpeaker,
  resolveAssignmentSkill,
  applyActivityToState,
});
})();
