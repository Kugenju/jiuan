(() => {
window.GAME_RUNTIME = window.GAME_RUNTIME || {};

const {
  normalizePlayerState,
  buildDailyScheduleFromWeeklyTimetable,
  buildScheduleLocksFromWeeklyTimetable,
  findNextEditableSlot,
} = window.GAME_RUNTIME;
const {
  buildMemoryPiecesForState,
  placeMemoryPieceOnState,
} = window.GAME_RUNTIME;

function countBuiltStructuresToday(placements) {
  return placements.filter((item) => Boolean(item.builtStructure)).length;
}

function getMemoryPieceLabel(piece, memoryFragmentTypes, skillLabels) {
  const meta = memoryFragmentTypes[piece.type];
  if (!meta) {
    return piece.type;
  }
  if (piece.type === "focus" && piece.skill) {
    return `${meta.label} · ${skillLabels[piece.skill]}`;
  }
  return meta.label;
}

function enterMemoryPhaseState(rootState, context) {
  rootState.mode = "memory";
  rootState.scene = "memory";
  rootState.memory.pieces = buildMemoryPiecesForState(rootState, context);
  rootState.memory.selectedPiece = rootState.memory.pieces.find((piece) => !piece.used)?.id || null;
  rootState.memory.dragPieceId = null;
  rootState.memory.placementsToday = [];
  rootState.memory.cursor = { kind: "node", id: context.layout.centerNodeId };
  rootState.currentStory = {
    title: "夜间记忆沉淀",
    body: `白天经历被析成 ${rootState.memory.pieces.length} 枚碎片。先用灵台锚片点亮节点，再把两枚碎片拼成建筑，最后用衔接纹片把建筑串起来。`,
    speaker: context.copy.memoryStart(0).speaker,
  };
  rootState.memory.lastSummary = `今夜析出 ${rootState.memory.pieces.length} 枚记忆碎片。`;
}

function placeMemoryPieceInFlow(rootState, target, context) {
  const piece = rootState.memory.pieces.find((item) => item.id === (context.pieceId || rootState.memory.selectedPiece));
  const result = placeMemoryPieceOnState(rootState, target, {
    pieceId: context.pieceId || rootState.memory.selectedPiece,
    layout: context.layout,
    memoryFragmentTypes: context.memoryFragmentTypes,
    memoryBuildRules: context.memoryBuildRules,
    getMainFocusSkill: context.getMainFocusSkill,
  });
  if (!result.ok) {
    if (result.reason === "invalid_placement") {
      rootState.currentStory = context.copy.invalidPlacement(result.invalidLabel);
    }
    return result;
  }

  const placement = result.placement;
  if (placement.type === "anchor") {
    rootState.currentStory = {
      title: "节点点亮",
      body: "灰域节点被灵台锚片点亮了，接下来可以在这里拼装真正的长期建筑。",
      speaker: context.copy.memoryStart(0).speaker,
    };
  } else if (placement.type === "link") {
    rootState.currentStory = {
      title: "脉络接通",
      body: "衔接纹片把两端建筑连了起来，这条知识路径已经能在夜里流动。",
      speaker: context.copy.memoryStart(0).speaker,
    };
  } else if (placement.builtStructure) {
    const buildingLabel = context.memoryTypes[placement.builtStructure].label;
    const pieceLabel = piece ? getMemoryPieceLabel(piece, context.memoryFragmentTypes, context.skillLabels) : "碎片";
    const skillTail =
      placement.structureSkill && (placement.builtStructure === "ability" || placement.builtStructure === "reasoning")
        ? `，方向指向 ${context.skillLabels[placement.structureSkill]}`
        : "";
    rootState.currentStory = {
      title: "建筑定型",
      body: `${pieceLabel} 与节点中的另一枚碎片完成拼装，这里已经定型为 ${buildingLabel}${skillTail}。`,
      speaker: context.copy.memoryStart(0).speaker,
    };
  } else {
    const label = piece ? getMemoryPieceLabel(piece, context.memoryFragmentTypes, context.skillLabels) : "碎片";
    rootState.currentStory = {
      title: "碎片嵌入",
      body: `${label} 已嵌入节点，再放入一枚碎片，这里就会沉成真正的建筑。`,
      speaker: context.copy.memoryStart(0).speaker,
    };
  }

  rootState.memory.lastSummary = `已安放 ${rootState.memory.placementsToday.length} / ${rootState.memory.pieces.length} 枚碎片，定型 ${countBuiltStructuresToday(rootState.memory.placementsToday)} 座建筑。`;
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
    if (item.type === "anchor") {
      rootState.resources.insight += 1;
      summary.push(context.copy.nightEffects.baseUnlock);
    }
    if (item.builtStructure === "ability") {
      const focus = item.structureSkill || context.getMainFocusSkill() || "dao";
      rootState.skills[focus] += 1;
      spiritGain += 1;
      summary.push(context.copy.nightEffects.abilityBoost(context.skillLabels[focus]));
    }
    if (item.builtStructure === "boost") {
      rootState.stats.fatigue -= 1;
      rootState.stats.mood += 1;
      summary.push(context.copy.nightEffects.boostRecover);
    }
    if (item.builtStructure === "reasoning") {
      rootState.stats.intelligence += 1;
      rootState.stats.inspiration += 1;
      if (item.structureSkill) {
        rootState.skills[item.structureSkill] += 1;
      }
      summary.push(context.copy.nightEffects.reasoningBreakthrough);
    }
    if (item.type === "link") {
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
    if ((left === "ability" && right === "reasoning") || (left === "reasoning" && right === "ability")) {
      resonanceBonus += 1;
    }
  });
  if (resonanceBonus > 0) {
    spiritGain += resonanceBonus;
    summary.push(context.copy.nightEffects.resonance(resonanceBonus));
  }

  rootState.resources.spirit += spiritGain;
  normalizePlayerState(rootState);

  const builtCount = countBuiltStructuresToday(placed);
  const summaryText = `今夜共点亮 ${placed.filter((item) => item.type === "anchor").length} 个节点，定型 ${builtCount} 座建筑。 ${summary.join(" ")}`.trim();
  const nightLog = context.copy.nightLog(rootState.day, summaryText);
  context.addLog(nightLog.title, nightLog.body);
  rootState.currentStory = {
    title: `第 ${rootState.day} 夜结算`,
    body: summaryText,
    speaker: context.copy.memoryStart(0).speaker,
  };

  if (rootState.day >= rootState.totalDays) {
    context.finishRun();
    return { ok: true, finishedRun: true };
  }

  rootState.day += 1;
  rootState.mode = "planning";
  rootState.scene = "campus";
  rootState.schedule = buildDailyScheduleFromWeeklyTimetable(rootState.weeklyTimetable, rootState.day, context.slotCount);
  rootState.scheduleLocks = buildScheduleLocksFromWeeklyTimetable(rootState.weeklyTimetable, rootState.day, context.slotCount);
  rootState.selectedSlot = findNextEditableSlot(rootState.scheduleLocks, 0, 1);
  rootState.selectedActivity = context.defaultFreeActivityId;
  rootState.dayModifier = null;
  return { ok: true, finishedRun: false };
}

Object.assign(window.GAME_RUNTIME, {
  enterMemoryPhaseState,
  placeMemoryPieceInFlow,
  finishNightFlow,
});
})();
