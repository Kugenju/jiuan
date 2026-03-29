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
