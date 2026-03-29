(() => {
window.GAME_RUNTIME = window.GAME_RUNTIME || {};

function getRuntimeHelper(name) {
  const candidate = window.GAME_RUNTIME?.[name];
  return typeof candidate === "function" ? candidate : null;
}

function resolveRouteStressHelper(override, name, fallback) {
  if (typeof override === "function") {
    return override;
  }
  return getRuntimeHelper(name) || fallback;
}

function getSafeWeekActions(rootState) {
  return Array.isArray(rootState.weekActions) ? rootState.weekActions : [];
}

function getPreviousDominantRoute(rootState) {
  const history = Array.isArray(rootState.strategyHistory) ? rootState.strategyHistory : [];
  if (!history.length) {
    return null;
  }
  return history[history.length - 1].dominantRoute || null;
}

function getSafeRouteStress(rootState, options = {}) {
  if (rootState.routeStress) {
    return rootState.routeStress;
  }
  const createRouteStressState = resolveRouteStressHelper(
    options.createRouteStressState,
    "createRouteStressState",
    () => ({ study: 0, work: 0, training: 0 })
  );
  return createRouteStressState();
}

function createWeeklyReport(rootState, options = {}) {
  const weekActions = Array.isArray(options.weekActions) ? options.weekActions : getSafeWeekActions(rootState);
  const detectDominantRoute = resolveRouteStressHelper(options.detectDominantRoute, "detectDominantRoute", () => "balanced");
  const dominantRoute = detectDominantRoute(weekActions);
  return {
    week: Number(rootState.week || 1),
    dominantRoute,
    actions: weekActions.slice(),
  };
}

function buildWeekTransitionState(rootState, options = {}) {
  const weekActions = Array.isArray(options.weekActions) ? options.weekActions : getSafeWeekActions(rootState);
  const weeklyReport = createWeeklyReport(rootState, {
    weekActions,
    detectDominantRoute: options.detectDominantRoute,
  });
  const previousDominantRoute =
    options.previousDominantRoute === undefined ? getPreviousDominantRoute(rootState) : options.previousDominantRoute;
  const dominantRoute = weeklyReport.dominantRoute;
  const updateRouteStress = resolveRouteStressHelper(options.updateRouteStress, "updateRouteStress", (current) => current);
  const routeStressInput = structuredClone(getSafeRouteStress(rootState, options));
  const routeStress = updateRouteStress(routeStressInput, {
    dominantRoute,
    previousDominantRoute,
  });

  const week = Number(rootState.week || 1);
  const totalWeeks = Number(rootState.totalWeeks || 1);
  const canContinue = week < totalWeeks;

  return {
    kind: canContinue ? "continue" : "final",
    canContinue,
    week,
    totalWeeks,
    dominantRoute,
    weekActions: weekActions.slice(),
    routeStress: structuredClone(routeStress ?? routeStressInput),
    weeklyReport,
  };
}

Object.assign(window.GAME_RUNTIME, {
  createWeeklyReport,
  buildWeekTransitionState,
});
})();
