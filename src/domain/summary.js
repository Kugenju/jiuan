(() => {
window.GAME_RUNTIME = window.GAME_RUNTIME || {};

function computeRankForState(rootState, rankThresholds) {
  const skillScore = Object.values(rootState.skills || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  const score =
    rootState.resources.spirit * 1.8 +
    rootState.resources.insight * 0.4 +
    rootState.stats.aura * 0.8 +
    skillScore;

  return rankThresholds.find((item) => score >= item.min).label;
}

function finishRunState(rootState, context) {
  const bestSkill = Object.entries(rootState.skills).sort((a, b) => b[1] - a[1])[0];
  const rank = computeRankForState(rootState, context.rankThresholds);
  const majorBeat = rootState.storyFlags.missingClue ? context.copy.summary.clueMajorBeat : context.copy.summary.defaultMajorBeat;
  const body = context.copy.summary.body(rank, context.skillLabels[bestSkill[0]]);

  rootState.summary = {
    rank,
    bestSkill,
    majorBeat,
  };
  rootState.mode = "summary";
  rootState.scene = "summary";
  rootState.currentStory = {
    title: context.copy.summary.title,
    body,
    speaker: context.copy.summary.speaker,
  };
  context.addLog(context.copy.summary.logTitle, `${body} ${majorBeat}`);
}

Object.assign(window.GAME_RUNTIME, {
  computeRankForState,
  finishRunState,
});
})();
