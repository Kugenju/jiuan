(() => {
window.GAME_RUNTIME = window.GAME_RUNTIME || {};

function computeRankForState(rootState, rankThresholds) {
  // Week rank should reflect different "routes" without letting a single metric dominate.
  // Use diminishing returns + a "third-best dimension" bonus to reward balanced growth.
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const sqrt01 = (v) => Math.sqrt(clamp01(v));

  const resources = rootState.resources || {};
  const stats = rootState.stats || {};

  const coins = Number(resources.coins || 0);
  const insight = Number(resources.insight || 0);
  const spirit = Number(resources.spirit || 0);
  const aura = Number(stats.aura || 0);

  const skillEntries = Object.entries(rootState.skills || {});
  const skillScore = skillEntries.reduce((sum, [, value]) => sum + Number(value || 0), 0);
  const skillMax = Math.max(1, skillEntries.length) * 12;

  // Normalize to the known clamp ranges (see domain/player.js). Avoid hard domination by any one axis.
  const coinsN = clamp01(coins / 99);
  const insightN = clamp01(insight / 99);
  const spiritN = clamp01(spirit / 20);
  const auraN = clamp01(aura / 10);
  const skillN = clamp01(skillScore / skillMax);

  const coinScore = 7 * sqrt01(coinsN);
  const insightScore = 7 * sqrt01(insightN);
  const spiritScore = 6 * sqrt01(spiritN);
  const auraScore = 4 * sqrt01(auraN);
  const skillBaseScore = 5 * sqrt01(skillN);

  // Reward having at least 3 dimensions not-too-low (balanced / mixed schedules).
  const sortedCore = [coinsN, insightN, spiritN, auraN].sort((a, b) => b - a);
  const thirdBest = sortedCore[2] || 0;
  const balanceScore = 8 * sqrt01(thirdBest);

  const score = coinScore + insightScore + spiritScore + auraScore + skillBaseScore + balanceScore;

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
