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

function getBestSkill(rootState) {
  const entries = Object.entries(rootState.skills || {}).sort((a, b) => b[1] - a[1]);
  return entries[0] || ["dao", 0];
}

function cloneRouteStress(stress, fallback = { study: 0, work: 0, training: 0 }) {
  if (!stress || typeof stress !== "object") {
    return structuredClone(fallback);
  }
  return {
    study: Number(stress.study || 0),
    work: Number(stress.work || 0),
    training: Number(stress.training || 0),
  };
}

function buildWeekSummaryPayload(rootState) {
  const tracker = rootState.weekTracker && typeof rootState.weekTracker === "object" ? rootState.weekTracker : {};
  const week = Number(tracker.week || rootState.week || 1);
  const totalWeeks = Number(tracker.totalWeeks || rootState.totalWeeks || 1);
  const canContinue = typeof tracker.canContinue === "boolean" ? tracker.canContinue : week < totalWeeks;
  const routeStressFallback = cloneRouteStress(rootState.routeStress);

  return {
    week,
    totalWeeks,
    canContinue,
    dominantRoute: tracker.dominantRoute || "balanced",
    routeStressBefore: cloneRouteStress(tracker.routeStressBefore, routeStressFallback),
    routeStressAfter: cloneRouteStress(tracker.routeStressAfter, routeStressFallback),
  };
}

function resolveCopyValue(value, ...args) {
  return typeof value === "function" ? value(...args) : value;
}

function finishWeekState(rootState, context) {
  const bestSkill = getBestSkill(rootState);
  const rank = computeRankForState(rootState, context.rankThresholds);
  const majorBeat = rootState.storyFlags.missingClue ? context.copy.summary.clueMajorBeat : context.copy.summary.defaultMajorBeat;
  const weeklyPayload = buildWeekSummaryPayload(rootState);
  const body = resolveCopyValue(context.copy.summary.body, rank, context.skillLabels[bestSkill[0]], weeklyPayload);

  rootState.summary = {
    ...weeklyPayload,
    rank,
    bestSkill,
    majorBeat,
  };
  if (!Array.isArray(rootState.weeklyReports)) {
    rootState.weeklyReports = [];
  }
  rootState.weeklyReports.push(structuredClone(rootState.summary));
  rootState.mode = "summary";
  rootState.scene = "summary";
  rootState.currentStory = {
    title: resolveCopyValue(context.copy.summary.title, weeklyPayload.week, weeklyPayload.totalWeeks),
    body,
    speaker: context.copy.summary.speaker,
  };
  context.addLog(resolveCopyValue(context.copy.summary.logTitle, weeklyPayload.week, weeklyPayload.totalWeeks), `${body} ${majorBeat}`);
}

function finishRunState(rootState, context) {
  finishWeekState(rootState, context);
}

Object.assign(window.GAME_RUNTIME, {
  computeRankForState,
  buildWeekSummaryPayload,
  finishWeekState,
  finishRunState,
});
})();
