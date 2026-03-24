window.GAME_RUNTIME = window.GAME_RUNTIME || {};

const {
  normalizePlayerState,
  cloneDefaultSchedule,
} = window.GAME_RUNTIME;
const {
  buildMemoryPiecesForState,
  placeMemoryPieceOnState,
} = window.GAME_RUNTIME;

function enterMemoryPhaseState(rootState, context) {
  rootState.mode = "memory";
  rootState.scene = "memory";
  rootState.memory.pieces = buildMemoryPiecesForState(rootState, context.getMainFocusSkill);
  rootState.memory.selectedPiece = rootState.memory.pieces.find((piece) => !piece.used)?.id || null;
  rootState.memory.dragPieceId = null;
  rootState.memory.placementsToday = [];
  rootState.memory.cursor = { kind: "node", id: context.layout.centerNodeId };
  const story = context.copy.memoryStart(rootState.memory.pieces.length);
  rootState.currentStory = {
    title: story.title,
    body: story.body,
    speaker: story.speaker,
  };
  rootState.memory.lastSummary = story.summary;
}

function placeMemoryPieceInFlow(rootState, target, context) {
  const result = placeMemoryPieceOnState(rootState, target, {
    pieceId: context.pieceId || rootState.memory.selectedPiece,
    layout: context.layout,
    memoryTypes: context.memoryTypes,
  });
  if (!result.ok) {
    if (result.reason === "invalid_placement") {
      rootState.currentStory = context.copy.invalidPlacement(result.invalidLabel);
    }
    return result;
  }
  rootState.memory.lastSummary = context.uiText.memory.placedSummary(
    rootState.memory.placementsToday.length,
    rootState.memory.pieces.length
  );
  return result;
}

function finishNightFlow(rootState, context) {
  const placed = rootState.memory.placementsToday;
  if (!placed.length) {
    rootState.currentStory = structuredClone(context.copy.emptyNightFinish);
    return { ok: false, reason: "empty_night" };
  }

  const summary = [];
  let spiritGain = 0;
  placed.forEach((item) => {
    if (item.type === "base") {
      rootState.resources.insight += 1;
      summary.push(context.copy.nightEffects.baseUnlock);
    }
    if (item.type === "ability") {
      const focus = context.getMainFocusSkill() || "dao";
      rootState.skills[focus] += 1;
      spiritGain += 1;
      summary.push(context.copy.nightEffects.abilityBoost(context.skillLabels[focus]));
    }
    if (item.type === "boost") {
      rootState.stats.fatigue -= 1;
      rootState.stats.mood += 1;
      summary.push(context.copy.nightEffects.boostRecover);
    }
    if (item.type === "reasoning") {
      rootState.stats.intelligence += 1;
      rootState.stats.inspiration += 1;
      summary.push(context.copy.nightEffects.reasoningBreakthrough);
    }
    if (item.type === "bridge") {
      rootState.stats.memory += 1;
      summary.push(context.copy.nightEffects.bridgeLink);
    }
  });

  let resonanceBonus = 0;
  rootState.memory.bridges.forEach((bridge, edgeId) => {
    if (!bridge) {
      return;
    }
    const edge = context.layout.edges[edgeId];
    const left = rootState.memory.board[edge.a]?.structure;
    const right = rootState.memory.board[edge.b]?.structure;
    if (
      (left === "ability" && right === "reasoning") ||
      (left === "reasoning" && right === "ability")
    ) {
      resonanceBonus += 1;
    }
  });
  if (resonanceBonus > 0) {
    spiritGain += resonanceBonus;
    summary.push(context.copy.nightEffects.resonance(resonanceBonus));
  }

  rootState.resources.spirit += spiritGain;
  normalizePlayerState(rootState);

  const summaryText = summary.join(" ");
  const nightLog = context.copy.nightLog(rootState.day, summaryText);
  context.addLog(nightLog.title, nightLog.body);
  rootState.currentStory = context.copy.nightSummary(rootState.day, summaryText);

  if (rootState.day >= rootState.totalDays) {
    context.finishRun();
    return { ok: true, finishedRun: true };
  }

  rootState.day += 1;
  rootState.mode = "planning";
  rootState.scene = "campus";
  rootState.schedule = cloneDefaultSchedule(
    context.defaultSchedules,
    rootState.selectedArchetype,
    context.defaultArchetypeId
  );
  rootState.selectedSlot = 0;
  rootState.selectedActivity = rootState.schedule[0];
  rootState.dayModifier = null;
  return { ok: true, finishedRun: false };
}

Object.assign(window.GAME_RUNTIME, {
  enterMemoryPhaseState,
  placeMemoryPieceInFlow,
  finishNightFlow,
});
