(() => {
window.GAME_RUNTIME = window.GAME_RUNTIME || {};

const {
  applyEffectBundleToRoot,
  normalizePlayerState,
} = window.GAME_RUNTIME;

function checkThresholdGroup(values, thresholds, comparator) {
  return Object.entries(thresholds || {}).every(([key, value]) => comparator(values[key], value));
}

const REWARD_TEMPLATES = {
  insight_small: {
    effect: { resources: { insight: 1 } },
    summary: "悟道点+1",
  },
  insight_friend: {
    effect: { resources: { insight: 1 }, relationships: { friend: 1 } },
    summary: "悟道点+1，朋友关系+1",
  },
  memory_small: {
    effect: { stats: { memory: 1 } },
    summary: "记忆+1",
  },
};

function resolveRandomEventSkill(rootState, activity, bonus, context) {
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

function resolveRandomEventSpeaker(prompt, context) {
  if (!prompt) {
    return null;
  }
  return (
    context.uiText?.speakers?.[prompt.speakerKey] ||
    context.uiText?.speakers?.assignment ||
    context.uiText?.speakers?.course ||
    context.uiText?.speakers?.routine ||
    null
  );
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

function buildPendingRandomEvent(rootState, event, activity, slotIndex, context) {
  const prompt = event.prompt || event.story || null;
  const speaker = resolveRandomEventSpeaker(prompt, context);
  const choices = Array.isArray(event.choices)
    ? event.choices.map((choice) => ({ id: choice.id, label: choice.label }))
    : [];

  return {
    id: event.id,
    title: prompt?.title || event.title,
    body: prompt?.body || "",
    speaker,
    slotIndex,
    activityId: activity?.id || null,
    activityKind: activity?.kind || null,
    activityName: activity?.name || null,
    choices,
    sourceEvent: event,
  };
}

function resolveRandomEventChoice(rootState, pendingEvent, choiceId, activity, context) {
  const event =
    pendingEvent?.sourceEvent ||
    (context.randomEvents || []).find((entry) => entry.id === pendingEvent?.id);
  if (!event) {
    return { ok: false, error: "unknown_event" };
  }

  const choices = Array.isArray(event.choices) ? event.choices : [];
  const choice = choices.find((entry) => entry.id === choiceId);
  if (!choice) {
    return { ok: false, error: "unknown_choice" };
  }

  const notes = [];
  const rewardSummaries = [];

  if (choice.note) {
    notes.push(choice.note);
  }

  if (choice.rewardTemplate) {
    const template = REWARD_TEMPLATES[choice.rewardTemplate];
    if (!template) {
      return { ok: false, error: "unknown_reward_template" };
    }
    applyEffectBundleToRoot(rootState, template.effect);
    if (template.summary) {
      rewardSummaries.push(template.summary);
    }
  }

  if (choice.effect) {
    applyEffectBundleToRoot(rootState, choice.effect);
  }

  if (choice.effectSummary) {
    rewardSummaries.push(choice.effectSummary);
  }

  if (choice.skillBonus) {
    const skill = resolveRandomEventSkill(rootState, activity, choice.skillBonus, context);
    if (skill) {
      rootState.skills[skill] += choice.skillBonus.amount;
      notes.push(
        choice.skillBonus.noteTemplate
          .replace("{skill}", context.skillLabels[skill])
          .replace("{amount}", String(choice.skillBonus.amount))
      );
    } else if (choice.skillBonus.fallbackNote) {
      notes.push(choice.skillBonus.fallbackNote);
    }
  }

  if (rewardSummaries.length) {
    notes.push(`奖励：${rewardSummaries.join("，")}`);
  }

  if (!Array.isArray(rootState.today.randomEvents)) {
    rootState.today.randomEvents = [];
  }
  rootState.today.randomEvents.push({
    id: event.id,
    slotIndex: pendingEvent?.slotIndex ?? null,
    activityId: pendingEvent?.activityId || activity?.id || null,
    choiceId,
  });

  normalizePlayerState(rootState);

  const logBody = choice.logBody || event.logBody || notes.join(" ");
  if (typeof context.addLog === "function") {
    context.addLog(`随机事件 · ${event.title}`, logBody);
  }

  return {
    ok: true,
    eventId: event.id,
    choiceId,
    notesText: notes.join(" "),
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
    return buildPendingRandomEvent(rootState, event, activity, slotIndex, context);
  }

  return null;
}

Object.assign(window.GAME_RUNTIME, {
  randomEventMatchesState,
  triggerRandomEventForTiming,
  resolveRandomEventChoice,
});
})();
