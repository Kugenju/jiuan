(() => {
window.GAME_RUNTIME = window.GAME_RUNTIME || {};

const {
  applyEffectBundleToRoot,
} = window.GAME_RUNTIME;

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

Object.assign(window.GAME_RUNTIME, {
  storyBeatMatchesState,
  triggerStoryBeatForActivity,
});
})();
