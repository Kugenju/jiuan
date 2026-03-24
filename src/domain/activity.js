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
  context.addLog(`${context.slotNames[slotIndex]} · ${activity.name}`, notes.join(" "));
  return notes.join(" ");
}

Object.assign(window.GAME_RUNTIME, {
  findDayModifier,
  applyActivityToState,
});
})();
