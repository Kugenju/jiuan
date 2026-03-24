(() => {
window.GAME_RUNTIME = window.GAME_RUNTIME || {};

function getZoneSkillKey(zone) {
  if (zone === "math") return "math";
  if (zone === "sigil") return "sigil";
  if (zone === "dao") return "dao";
  if (zone === "craft") return "craft";
  return null;
}

function resolvePlacementZoneForPiece(piece, fragmentTypes, getMainFocusSkill) {
  if (!piece || !fragmentTypes[piece.type]) {
    return null;
  }
  const meta = fragmentTypes[piece.type];
  if (meta.zoneFromSkill) {
    return piece.skill || getMainFocusSkill?.() || meta.fallbackZone || null;
  }
  return meta.zone || null;
}

function buildMemoryPieceId(rootState, type, index) {
  return `day-${rootState.day}-${type}-${index}`;
}

function createMemoryPiece(rootState, type, index, extra = {}) {
  return {
    id: buildMemoryPieceId(rootState, type, index),
    type,
    skill: extra.skill || null,
    source: extra.source || null,
    used: false,
  };
}

function pushMemoryPiece(pieces, rootState, type, extra = {}) {
  pieces.push(createMemoryPiece(rootState, type, pieces.length, extra));
}

function sumValues(values) {
  return Object.values(values || {}).reduce((sum, value) => sum + Number(value || 0), 0);
}

function pickWeightedKey(weights, rng) {
  const entries = Object.entries(weights).filter(([, value]) => value > 0);
  if (!entries.length) {
    return null;
  }
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  let roll = rng() * total;
  for (const [key, value] of entries) {
    roll -= value;
    if (roll <= 0) {
      return key;
    }
  }
  return entries[entries.length - 1][0];
}

function buildFocusSkillWeights(rootState, fallbackSkill) {
  const weights = {};
  Object.entries(rootState.today.courseSkills || {}).forEach(([skill, value]) => {
    if (value > 0) {
      weights[skill] = value * 2;
    }
  });

  Object.entries(rootState.today.focus || {}).forEach(([skill, value]) => {
    if (value > 0) {
      weights[skill] = (weights[skill] || 0) + value;
    }
  });

  if (rootState.today.latestCourseSkill) {
    weights[rootState.today.latestCourseSkill] = (weights[rootState.today.latestCourseSkill] || 0) + 2;
  }

  if (fallbackSkill) {
    weights[fallbackSkill] = (weights[fallbackSkill] || 0) + 1;
  }

  return weights;
}

function buildRandomFragmentWeights(rootState) {
  const weights = {
    anchor: 0.08,
    schema: 1,
    focus: 1,
    echo: 1,
    calm: 1,
    link: 0.35,
  };

  weights.schema += (rootState.today.kinds?.course || 0) + rootState.today.tones.study;
  weights.focus += Math.max(0, sumValues(rootState.today.courseSkills) - 1);
  weights.echo += (rootState.today.kinds?.assignment || 0) * 2 + Math.max(0, rootState.today.randomEvents.length - 1);
  weights.calm += rootState.today.tones.life + rootState.today.tones.body;
  weights.link += rootState.today.tones.social + rootState.today.randomEvents.length * 0.8;

  if (rootState.stats.fatigue >= 5) {
    weights.calm += 2;
  }
  if (Object.values(rootState.today.tones).filter((count) => count > 0).length >= 3) {
    weights.link += 1.2;
  }
  if (rootState.day <= 3) {
    weights.anchor += 0.95;
    weights.link += 1.15;
  } else if (rootState.day <= 5) {
    weights.anchor += 0.35;
    weights.link += 0.45;
  }

  return weights;
}

function buildMemoryPiecesForState(rootState, context) {
  const pieces = [];
  const fallbackSkill = context.getMainFocusSkill?.() || rootState.today.latestCourseSkill || "dao";
  const focusSkillWeights = buildFocusSkillWeights(rootState, fallbackSkill);
  const drawFocusSkill = () => pickWeightedKey(focusSkillWeights, rootState.rng) || fallbackSkill;

  pushMemoryPiece(pieces, rootState, "anchor", { source: "base_unlock" });

  if ((rootState.today.kinds?.course || 0) > 0) {
    pushMemoryPiece(pieces, rootState, "schema", { source: "course_frame" });
    pushMemoryPiece(pieces, rootState, "focus", {
      skill: rootState.today.latestCourseSkill || drawFocusSkill(),
      source: "course_focus",
    });
  }

  if ((rootState.today.kinds?.assignment || 0) > 0) {
    pushMemoryPiece(pieces, rootState, "echo", { source: "assignment_review" });
  }

  if (rootState.today.tones.life > 0 || rootState.today.tones.body > 0 || rootState.stats.fatigue >= 5) {
    pushMemoryPiece(pieces, rootState, "calm", { source: "recovery_loop" });
  }

  if (rootState.today.tones.social > 0 || rootState.today.randomEvents.length > 0) {
    pushMemoryPiece(pieces, rootState, "link", { source: "social_threads" });
  }

  let randomDraws =
    context.memoryBuildRules.randomDrawsBase +
    (rootState.today.randomEvents.length > 0 ? 1 : 0) +
    (Object.values(rootState.today.tones).filter((count) => count > 0).length >= 3 ? 1 : 0);
  randomDraws = Math.max(1, Math.min(context.memoryBuildRules.randomDrawsMax, randomDraws));

  const randomWeights = buildRandomFragmentWeights(rootState);
  for (let index = 0; index < randomDraws; index += 1) {
    const type = pickWeightedKey(randomWeights, rootState.rng) || "echo";
    pushMemoryPiece(pieces, rootState, type, {
      skill: type === "focus" ? drawFocusSkill() : null,
      source: "random_draw",
    });
  }

  if (pieces.filter((piece) => piece.type !== "anchor").length < 2) {
    pushMemoryPiece(pieces, rootState, "echo", { source: "minimum_density" });
    pushMemoryPiece(pieces, rootState, "calm", { source: "minimum_density" });
  }

  return pieces;
}

function normalizeMemoryCursorOnLayout(layout, cursor) {
  if (
    cursor &&
    cursor.kind === "node" &&
    Number.isInteger(cursor.id) &&
    cursor.id >= 0 &&
    cursor.id < layout.nodes.length
  ) {
    return { kind: "node", id: cursor.id };
  }
  if (
    cursor &&
    cursor.kind === "edge" &&
    Number.isInteger(cursor.id) &&
    cursor.id >= 0 &&
    cursor.id < layout.edges.length
  ) {
    return { kind: "edge", id: cursor.id };
  }
  return { kind: "node", id: layout.centerNodeId };
}

function resolveMemoryTargetOnLayout(layout, target) {
  if (Number.isInteger(target)) {
    if (target >= 0 && target < layout.nodes.length) {
      return { kind: "node", id: target };
    }
    return null;
  }
  if (!target || typeof target !== "object") {
    return null;
  }
  if (target.kind === "node" && Number.isInteger(target.id) && target.id >= 0 && target.id < layout.nodes.length) {
    return { kind: "node", id: target.id };
  }
  if (target.kind === "edge" && Number.isInteger(target.id) && target.id >= 0 && target.id < layout.edges.length) {
    return { kind: "edge", id: target.id };
  }
  return null;
}

function normalizeFragmentTypes(fragments) {
  return fragments.map((fragment) => fragment.type).sort().join("|");
}

function scoreFragmentsForBuildings(fragments, fragmentTypes, buildRules) {
  const scores = Object.fromEntries((buildRules.buildingPriority || []).map((type) => [type, 0]));
  fragments.forEach((fragment) => {
    const affinity = fragmentTypes[fragment.type]?.affinity || {};
    Object.entries(affinity).forEach(([building, value]) => {
      scores[building] = (scores[building] || 0) + value;
    });
  });
  return scores;
}

function resolveMemoryStructureFromFragments(fragments, fragmentTypes, buildRules) {
  if (!fragments.length) {
    return null;
  }

  const typeKey = normalizeFragmentTypes(fragments);
  const recipe = (buildRules.recipes || []).find((item) => item.fragments.slice().sort().join("|") === typeKey);
  if (recipe) {
    return {
      building: recipe.building,
      recipeId: recipe.id,
      hint: recipe.hint,
      exact: true,
    };
  }

  const scores = scoreFragmentsForBuildings(fragments, fragmentTypes, buildRules);
  const priority = buildRules.buildingPriority || ["ability", "reasoning", "boost"];
  const winner =
    priority
      .slice()
      .sort((left, right) => (scores[right] || 0) - (scores[left] || 0) || priority.indexOf(left) - priority.indexOf(right))[0] ||
    "reasoning";

  return {
    building: winner,
    recipeId: null,
    hint: null,
    exact: false,
  };
}

function resolveStructureSkillForNode(nodeState, getMainFocusSkill) {
  const skillFragment = (nodeState.fragments || []).find((fragment) => fragment.skill);
  if (skillFragment?.skill) {
    return skillFragment.skill;
  }
  return getZoneSkillKey(nodeState.zone) || getMainFocusSkill?.() || null;
}

function isValidNodePlacementForState(rootState, fragmentTypes, buildRules, piece, nodeId, getMainFocusSkill) {
  const node = rootState.memory.board[nodeId];
  const type = typeof piece === "string" ? piece : piece?.type;
  const meta = fragmentTypes[type];
  if (!type || !node || !meta) {
    return false;
  }

  if (meta.slot === "locked-node") {
    return !node.unlocked && !node.structure;
  }

  if (meta.slot === "edge") {
    return false;
  }

  const requiredZone = resolvePlacementZoneForPiece(
    typeof piece === "string" ? { type } : piece,
    fragmentTypes,
    getMainFocusSkill
  );

  if (requiredZone && node.zone !== "core" && node.zone !== requiredZone) {
    return false;
  }

  return node.unlocked && !node.structure && (node.fragments?.length || 0) < buildRules.nodeCapacity;
}

function isValidBridgePlacementForState(rootState, layout, edgeId) {
  const edge = layout.edges[edgeId];
  if (!edge || rootState.memory.bridges[edgeId]) {
    return false;
  }
  const left = rootState.memory.board[edge.a];
  const right = rootState.memory.board[edge.b];
  return Boolean(left?.structure && right?.structure);
}

function isValidMemoryPlacement(rootState, layout, fragmentTypes, buildRules, piece, target, getMainFocusSkill) {
  const resolved = resolveMemoryTargetOnLayout(layout, target);
  const type = typeof piece === "string" ? piece : piece?.type;
  const meta = fragmentTypes[type];
  if (!type || !resolved || !meta) {
    return false;
  }
  if (meta.slot === "edge") {
    return resolved.kind === "edge" && isValidBridgePlacementForState(rootState, layout, resolved.id);
  }
  return (
    resolved.kind === "node" &&
    isValidNodePlacementForState(rootState, fragmentTypes, buildRules, piece, resolved.id, getMainFocusSkill)
  );
}

function selectMemoryPieceOnState(rootState, pieceId) {
  if (rootState.mode !== "memory") {
    return false;
  }
  const piece = rootState.memory.pieces.find((item) => item.id === pieceId && !item.used);
  if (!piece) {
    return false;
  }
  rootState.memory.selectedPiece = piece.id;
  rootState.memory.dragPieceId = null;
  return true;
}

function startMemoryDragOnState(rootState, pieceId) {
  if (rootState.mode !== "memory") {
    return false;
  }
  const piece = rootState.memory.pieces.find((item) => item.id === pieceId && !item.used);
  if (!piece) {
    return false;
  }
  rootState.memory.selectedPiece = piece.id;
  rootState.memory.dragPieceId = piece.id;
  return true;
}

function endMemoryDragOnState(rootState) {
  if (rootState.mode !== "memory" || !rootState.memory.dragPieceId) {
    return false;
  }
  rootState.memory.dragPieceId = null;
  return true;
}

function moveMemoryCursorOnState(rootState, layout, dx, dy) {
  if (rootState.mode !== "memory") {
    return false;
  }
  const cursor = normalizeMemoryCursorOnLayout(layout, rootState.memory.cursor);
  const currentNodeId = cursor.kind === "node" ? cursor.id : (layout.edges[cursor.id]?.a ?? layout.centerNodeId);
  const current = layout.nodes[currentNodeId];
  let bestNodeId = currentNodeId;
  let bestScore = -Infinity;

  current.neighbors.forEach((neighborId) => {
    const neighbor = layout.nodes[neighborId];
    const vx = neighbor.ux - current.ux;
    const vy = neighbor.uy - current.uy;
    const score = vx * dx + vy * dy;
    if (score > bestScore) {
      bestScore = score;
      bestNodeId = neighborId;
    }
  });

  rootState.memory.cursor = {
    kind: "node",
    id: bestScore > 0 ? bestNodeId : currentNodeId,
  };
  return true;
}

function cycleMemoryPieceOnState(rootState, delta) {
  if (rootState.mode !== "memory") {
    return false;
  }
  const available = rootState.memory.pieces.filter((piece) => !piece.used);
  if (!available.length) {
    rootState.memory.selectedPiece = null;
    return true;
  }
  const currentIndex = Math.max(
    0,
    available.findIndex((piece) => piece.id === rootState.memory.selectedPiece)
  );
  const nextIndex = (currentIndex + delta + available.length) % available.length;
  rootState.memory.selectedPiece = available[nextIndex].id;
  rootState.memory.dragPieceId = null;
  return true;
}

function placeMemoryPieceOnState(rootState, target, context) {
  const resolvedTarget = resolveMemoryTargetOnLayout(context.layout, target ?? rootState.memory.cursor);
  const piece = rootState.memory.pieces.find((item) => item.id === context.pieceId);
  const pieceMeta = piece ? context.memoryFragmentTypes[piece.type] : null;
  if (!piece || piece.used || !resolvedTarget || !pieceMeta) {
    return { ok: false, reason: "invalid_piece_or_target" };
  }
  if (
    !isValidMemoryPlacement(
      rootState,
      context.layout,
      context.memoryFragmentTypes,
      context.memoryBuildRules,
      piece,
      resolvedTarget,
      context.getMainFocusSkill
    )
  ) {
    return { ok: false, reason: "invalid_placement", invalidLabel: pieceMeta.label };
  }

  const placement = {
    kind: resolvedTarget.kind,
    type: piece.type,
    pieceId: piece.id,
    pieceSkill: piece.skill || null,
  };

  if (pieceMeta.slot === "locked-node") {
    const node = rootState.memory.board[resolvedTarget.id];
    node.unlocked = true;
    node.unlockedDay = rootState.day;
    placement.nodeId = resolvedTarget.id;
  } else if (pieceMeta.slot === "edge") {
    rootState.memory.bridges[resolvedTarget.id] = { type: "bridge", day: rootState.day };
    placement.edgeId = resolvedTarget.id;
  } else {
    const node = rootState.memory.board[resolvedTarget.id];
    node.fragments = node.fragments || [];
    node.fragments.push({
      type: piece.type,
      skill: piece.skill || null,
      source: piece.source || null,
    });
    placement.nodeId = resolvedTarget.id;
    placement.fragmentCount = node.fragments.length;

    if (node.fragments.length >= context.memoryBuildRules.nodeCapacity) {
      const resolvedStructure = resolveMemoryStructureFromFragments(
        node.fragments,
        context.memoryFragmentTypes,
        context.memoryBuildRules
      );
      node.structure = resolvedStructure?.building || "reasoning";
      node.structureSkill = resolveStructureSkillForNode(node, context.getMainFocusSkill);
      node.day = rootState.day;
      placement.builtStructure = node.structure;
      placement.structureSkill = node.structureSkill;
      placement.recipeId = resolvedStructure?.recipeId || null;
      placement.fragments = structuredClone(node.fragments);
      node.fragments = [];
    }
  }

  rootState.memory.placementsToday.push(placement);
  piece.used = true;
  rootState.memory.dragPieceId = null;
  rootState.memory.selectedPiece = rootState.memory.pieces.find((item) => !item.used)?.id || null;
  rootState.memory.cursor = resolvedTarget;
  return {
    ok: true,
    target: resolvedTarget,
    placement,
  };
}

Object.assign(window.GAME_RUNTIME, {
  buildMemoryPiecesForState,
  normalizeMemoryCursorOnLayout,
  resolveMemoryTargetOnLayout,
  resolveMemoryStructureFromFragments,
  getZoneSkillKey,
  resolvePlacementZoneForPiece,
  isValidNodePlacementForState,
  isValidBridgePlacementForState,
  isValidMemoryPlacement,
  selectMemoryPieceOnState,
  startMemoryDragOnState,
  endMemoryDragOnState,
  moveMemoryCursorOnState,
  cycleMemoryPieceOnState,
  placeMemoryPieceOnState,
});
})();
