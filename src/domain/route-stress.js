(() => {
window.GAME_RUNTIME = window.GAME_RUNTIME || {};

const ROUTE_ACTIVITY_MAP = {
  homework: "study",
  part_time: "work",
  training: "training",
};

const ROUTE_KEYS = ["study", "work", "training"];

function clampStress(value) {
  return Math.max(0, Math.min(6, value));
}

function createRouteStressState() {
  return { study: 0, work: 0, training: 0 };
}

function detectDominantRoute(freeActions) {
  const counts = { study: 0, work: 0, training: 0 };
  (freeActions || []).forEach((activityId) => {
    const route = ROUTE_ACTIVITY_MAP[activityId];
    if (route) {
      counts[route] += 1;
    }
  });

  const totalTracked = ROUTE_KEYS.reduce((sum, route) => sum + counts[route], 0);
  if (totalTracked === 0) {
    return "balanced";
  }

  const entries = Object.entries(counts).sort(([, a], [, b]) => b - a);
  const [topRoute, topCount] = entries[0];
  const [, secondCount] = entries[1];

  if (topCount - secondCount < 2) {
    return "balanced";
  }
  if (topCount / totalTracked < 0.5) {
    return "balanced";
  }

  return topRoute;
}

function updateRouteStress(current = createRouteStressState(), { dominantRoute = "balanced", previousDominantRoute = null } = {}) {
  const next = {
    study: clampStress(current.study || 0),
    work: clampStress(current.work || 0),
    training: clampStress(current.training || 0),
  };

  const isTrackedRoute = ROUTE_KEYS.includes(dominantRoute);
  if (!isTrackedRoute) {
    dominantRoute = "balanced";
  }

  if (dominantRoute === "balanced") {
    ROUTE_KEYS.forEach((route) => {
      next[route] = clampStress(next[route] - 1);
    });
    return next;
  }

  ROUTE_KEYS.forEach((route) => {
    next[route] = clampStress(next[route] + (route === dominantRoute ? 2 : -1));
  });

  if (dominantRoute === previousDominantRoute) {
    next[dominantRoute] = clampStress(next[dominantRoute] + 1);
  }

  return next;
}

function getRouteStressPenaltyProfile(route, stress = 0) {
  if (stress <= 1) {
    return {
      resourcePenalty: 0,
      fatigueDelta: 0,
      auraPenalty: 0,
      moodPenalty: 0,
      selfControlPenalty: 0,
      assignmentBonusPenalty: 0,
    };
  }

  if (route === "study") {
    if (stress <= 3) {
      return {
        resourcePenalty: 1,
        fatigueDelta: 0,
        auraPenalty: 0,
        moodPenalty: 0,
        selfControlPenalty: 0,
        assignmentBonusPenalty: 1,
      };
    }
    return {
      resourcePenalty: 2,
      fatigueDelta: 0,
      auraPenalty: 0,
      moodPenalty: 0,
      selfControlPenalty: 0,
      assignmentBonusPenalty: 999,
    };
  }

  if (route === "work") {
    if (stress <= 3) {
      return {
        resourcePenalty: 2,
        fatigueDelta: 1,
        auraPenalty: 0,
        moodPenalty: 0,
        selfControlPenalty: 0,
        assignmentBonusPenalty: 0,
      };
    }
    return {
      resourcePenalty: 4,
      fatigueDelta: 2,
      auraPenalty: 0,
      moodPenalty: 0,
      selfControlPenalty: 0,
      assignmentBonusPenalty: 0,
    };
  }

  if (route === "training") {
    if (stress <= 3) {
      return {
        resourcePenalty: 0,
        fatigueDelta: 0,
        auraPenalty: 1,
        moodPenalty: 1,
        selfControlPenalty: 0,
        assignmentBonusPenalty: 0,
      };
    }
    return {
      resourcePenalty: 0,
      fatigueDelta: 0,
      auraPenalty: 2,
      moodPenalty: 999,
      selfControlPenalty: 1,
      assignmentBonusPenalty: 0,
    };
  }

  return {
    resourcePenalty: 0,
    fatigueDelta: 0,
    auraPenalty: 0,
    moodPenalty: 0,
    selfControlPenalty: 0,
    assignmentBonusPenalty: 0,
  };
}

Object.assign(window.GAME_RUNTIME, {
  ROUTE_ACTIVITY_MAP,
  createRouteStressState,
  detectDominantRoute,
  updateRouteStress,
  getRouteStressPenaltyProfile,
});
})();
