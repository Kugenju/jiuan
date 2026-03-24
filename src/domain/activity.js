(() => {
window.GAME_RUNTIME = window.GAME_RUNTIME || {};

const {
  applyEffectBundleToRoot,
  normalizePlayerState,
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

function storyBeatMatchesState(rootState, beat, activity) {
  const condition = beat.condition || {};

  if (condition.activityId && activity.id !== condition.activityId) {
    return false;
  }

  if (typeof condition.minDay === "number" && rootState.day < condition.minDay) {
    return false;
  }

  if (condition.minSkill && rootState.skills[condition.minSkill.key] < condition.minSkill.value) {
    return false;
  }

  if (condition.maxStat && rootState.stats[condition.maxStat.key] > condition.maxStat.value) {
    return false;
  }

  if (condition.minRelationship && rootState.relationships[condition.minRelationship.key] < condition.minRelationship.value) {
    return false;
  }

  if (condition.combinedSkillsAtLeast) {
    const total = condition.combinedSkillsAtLeast.keys.reduce((sum, key) => sum + rootState.skills[key], 0);
    if (total < condition.combinedSkillsAtLeast.value) {
      return false;
    }
  }

  return true;
}

function triggerStoryBeatForActivity(rootState, activity, notes, storyBeats) {
  const beat = storyBeats.find((item) => !rootState.storyFlags[item.id] && storyBeatMatchesState(rootState, item, activity));
  if (!beat) {
    return null;
  }

  rootState.storyFlags[beat.id] = true;
  applyEffectBundleToRoot(rootState, beat.effect);
  if (beat.note) {
    notes.push(beat.note);
  }
  return beat;
}

function applyActivityToState(rootState, activity, slotIndex, context) {
  const isPreferred = activity.preferred.includes(slotIndex);
  const modifierNote = consumeDayModifierForActivity(rootState, activity, context.copy);

  rootState.today.actions.push(activity.id);
  rootState.today.tones[activity.tone] += 1;
  if (activity.skill) {
    rootState.today.focus[activity.skill] += 1;
  }

  const notes = [];
  if (modifierNote) {
    notes.push(modifierNote);
  }

  applyEffectBundleToRoot(rootState, activity.effects);
  if (activity.notes?.base) {
    notes.push(activity.notes.base);
  }

  if (isPreferred) {
    applyEffectBundleToRoot(rootState, activity.preferredEffects);
    if (activity.notes?.preferred) {
      notes.push(activity.notes.preferred);
    }
  }

  if (activity.special?.type === "focusSkillBonus") {
    const focus = context.getMainFocusSkill();
    if (focus) {
      rootState.skills[focus] += activity.special.amount;
      notes.push(activity.special.noteTemplate.replace("{skill}", context.skillLabels[focus]));
    } else if (activity.special.fallbackNote) {
      notes.push(activity.special.fallbackNote);
    }
  }

  triggerStoryBeatForActivity(rootState, activity, notes, context.storyBeats);
  normalizePlayerState(rootState);
  context.addLog(`${context.slotNames[slotIndex]} 路 ${activity.name}`, notes.join(" "));
  return notes.join(" ");
}

Object.assign(window.GAME_RUNTIME, {
  findDayModifier,
  storyBeatMatchesState,
  triggerStoryBeatForActivity,
  applyActivityToState,
});
})();
