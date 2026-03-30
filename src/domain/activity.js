(() => {
window.GAME_RUNTIME = window.GAME_RUNTIME || {};

const {
  applyEffectBundleToRoot,
  normalizePlayerState,
  triggerStoryBeatForActivity,
  getRouteStressPenaltyProfile,
  ROUTE_ACTIVITY_MAP,
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

function cloneEffectBundle(bundle = {}) {
  return {
    stats: { ...(bundle.stats || {}) },
    skills: { ...(bundle.skills || {}) },
    resources: { ...(bundle.resources || {}) },
    relationships: { ...(bundle.relationships || {}) },
  };
}

function getRoutePenaltyForActivity(rootState, activity) {
  const route = ROUTE_ACTIVITY_MAP?.[activity.id] || null;
  if (!route) {
    return getRouteStressPenaltyProfile?.("balanced", 0) || {
      resourcePenalty: 0,
      fatigueDelta: 0,
      auraPenalty: 0,
      moodPenalty: 0,
      selfControlPenalty: 0,
      assignmentBonusPenalty: 0,
    };
  }
  return getRouteStressPenaltyProfile?.(route, rootState.routeStress?.[route] || 0) || {
    resourcePenalty: 0,
    fatigueDelta: 0,
    auraPenalty: 0,
    moodPenalty: 0,
    selfControlPenalty: 0,
    assignmentBonusPenalty: 0,
  };
}

function getFatiguePenaltyStep(rootState, activity) {
  if (activity.tone === "life") {
    return 0;
  }
  if (rootState.stats.fatigue >= 8) {
    return 2;
  }
  if (rootState.stats.fatigue >= 6) {
    return 1;
  }
  return 0;
}

function reducePositivePackByPenalty(pack, penaltyStep) {
  if (!pack) {
    return null;
  }
  const adjustedEntries = Object.entries(pack)
    .map(([key, value]) => {
      if (typeof value !== "number" || value <= 0) {
        return [key, value];
      }
      return [key, Math.max(0, value - penaltyStep)];
    })
    .filter(([, value]) => value !== 0);

  return adjustedEntries.length > 0 ? Object.fromEntries(adjustedEntries) : null;
}

function applyActivityEffectsWithFatiguePenalty(rootState, bundle, penaltyStep) {
  if (!bundle) {
    return;
  }
  if (penaltyStep <= 0) {
    applyEffectBundleToRoot(rootState, bundle);
    return;
  }

  applyEffectBundleToRoot(rootState, {
    stats: reducePositivePackByPenalty(bundle.stats, penaltyStep),
    skills: reducePositivePackByPenalty(bundle.skills, penaltyStep),
    resources: reducePositivePackByPenalty(bundle.resources, penaltyStep),
    relationships: reducePositivePackByPenalty(bundle.relationships, penaltyStep),
  });
}

function applyRoutePenaltyToEffects(activity, effects, routePenalty) {
  const adjusted = cloneEffectBundle(effects);

  if (activity.id === "homework") {
    adjusted.resources.insight = Math.max(0, Number(adjusted.resources.insight || 0) - Number(routePenalty.resourcePenalty || 0));
  }

  if (activity.id === "part_time") {
    adjusted.resources.coins = Math.max(0, Number(adjusted.resources.coins || 0) - Number(routePenalty.resourcePenalty || 0));
    adjusted.stats.fatigue = Number(adjusted.stats.fatigue || 0) + Number(routePenalty.fatigueDelta || 0);
  }

  if (activity.id === "training") {
    adjusted.stats.aura = Math.max(0, Number(adjusted.stats.aura || 0) - Number(routePenalty.auraPenalty || 0));
    adjusted.stats.mood = Math.max(0, Number(adjusted.stats.mood || 0) - Number(routePenalty.moodPenalty || 0));
    adjusted.stats.selfControl = Number(adjusted.stats.selfControl || 0) - Number(routePenalty.selfControlPenalty || 0);
  }

  return adjusted;
}

function recordWeekAction(rootState, activity, slotIndex) {
  if (rootState.scheduleLocks?.[slotIndex]) {
    return;
  }
  if (!ROUTE_ACTIVITY_MAP?.[activity.id]) {
    return;
  }
  if (!Array.isArray(rootState.weekActions)) {
    rootState.weekActions = [];
  }
  rootState.weekActions.push(activity.id);
}

function countTrailingActivityStreak(actions, activityId) {
  let streak = 0;
  for (let index = actions.length - 1; index >= 0; index -= 1) {
    if (actions[index] !== activityId) {
      break;
    }
    streak += 1;
  }
  return streak;
}

function getAssignmentBonusAmount(rootState, activity, fatiguePenaltyStep, routePenalty) {
  const baseAmount = Number(activity.assignment.amount || 0);
  if (baseAmount <= 0) {
    return 0;
  }
  const streakPenalty = countTrailingActivityStreak(rootState.today.actions || [], activity.id) >= 2 ? 1 : 0;
  const fatiguePenalty = fatiguePenaltyStep > 0 ? 1 : 0;
  const routePenaltyAmount =
    Number(routePenalty?.assignmentBonusPenalty || 0) >= 999
      ? baseAmount
      : Number(routePenalty?.assignmentBonusPenalty || 0);
  return Math.max(0, baseAmount - streakPenalty - fatiguePenalty - routePenaltyAmount);
}

function applyAssignmentProtocol(rootState, activity, context, notes, fatiguePenaltyStep, routePenalty) {
  if (activity.kind !== "assignment" || !activity.assignment) {
    return;
  }

  const skill = resolveAssignmentSkill(rootState, activity, context);
  const amount = getAssignmentBonusAmount(rootState, activity, fatiguePenaltyStep, routePenalty);
  if (skill) {
    if (amount > 0) {
      rootState.skills[skill] += amount;
      notes.push(
        activity.assignment.noteTemplate
          .replace("{skill}", context.skillLabels[skill])
          .replace("{amount}", String(amount))
      );
    }
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
  const routePenalty = getRoutePenaltyForActivity(rootState, activity);
  const fatiguePenaltyStep = getFatiguePenaltyStep(rootState, activity);

  trackActivityOnTodayState(rootState, activity, slotIndex);
  recordWeekAction(rootState, activity, slotIndex);

  const notes = [];
  if (modifierNote) {
    notes.push(modifierNote);
  }

  applyActivityEffectsWithFatiguePenalty(
    rootState,
    applyRoutePenaltyToEffects(activity, activity.effects, routePenalty),
    fatiguePenaltyStep
  );
  if (activity.notes?.base) {
    notes.push(activity.notes.base);
  }

  if (isPreferred && activity.preferredEffects) {
    applyActivityEffectsWithFatiguePenalty(rootState, activity.preferredEffects, fatiguePenaltyStep);
    if (activity.notes?.preferred) {
      notes.push(activity.notes.preferred);
    }
  }

  applyAssignmentProtocol(rootState, activity, context, notes, fatiguePenaltyStep, routePenalty);

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
