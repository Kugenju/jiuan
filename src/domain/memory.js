window.GAME_RUNTIME = window.GAME_RUNTIME || {};

function buildMemoryPiecesForState(rootState, getMainFocusSkill) {
  const pieces = [];
  const pushPiece = (type) => {
    pieces.push({
      id: `day-${rootState.day}-${type}-${pieces.length}`,
      type,
      used: false,
    });
  };

  pushPiece("base");

  if (getMainFocusSkill() || rootState.today.tones.study > 0) {
    pushPiece("ability");
  }

  if (rootState.today.tones.study >= 2 || rootState.today.actions.includes("homework")) {
    pushPiece("reasoning");
  }

  if (rootState.today.tones.life > 0 || rootState.today.tones.body > 0) {
    pushPiece("boost");
  }

  if (
    rootState.today.tones.social > 0 ||
    Object.values(rootState.today.tones).filter((count) => count > 0).length >= 3
  ) {
    pushPiece("bridge");
  }

  if (pieces.length === 1) {
    pushPiece("boost");
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

function isValidNodePlacementForState(rootState, memoryTypes, type, nodeId) {
  const node = rootState.memory.board[nodeId];
  if (!type || !node || !memoryTypes[type]) {
    return false;
  }

  if (type === "base") {
    return !node.unlocked && !node.structure;
  }

  if (type === "bridge") {
    return false;
  }

  return node.unlocked && !node.structure;
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

function isValidMemoryPlacement(rootState, layout, memoryTypes, type, target) {
  const resolved = resolveMemoryTargetOnLayout(layout, target);
  if (!type || !resolved || !memoryTypes[type]) {
    return false;
  }
  if (type === "bridge") {
    return resolved.kind === "edge" && isValidBridgePlacementForState(rootState, layout, resolved.id);
  }
  return resolved.kind === "node" && isValidNodePlacementForState(rootState, memoryTypes, type, resolved.id);
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
  if (!piece || piece.used || !resolvedTarget) {
    return { ok: false, reason: "invalid_piece_or_target" };
  }
  if (!isValidMemoryPlacement(rootState, context.layout, context.memoryTypes, piece.type, resolvedTarget)) {
    return { ok: false, reason: "invalid_placement", invalidLabel: context.memoryTypes[piece.type].label };
  }

  if (piece.type === "base") {
    const node = rootState.memory.board[resolvedTarget.id];
    node.unlocked = true;
    node.unlockedDay = rootState.day;
    rootState.memory.placementsToday.push({
      kind: "node",
      nodeId: resolvedTarget.id,
      type: piece.type,
    });
  } else if (piece.type === "bridge") {
    rootState.memory.bridges[resolvedTarget.id] = { type: "bridge", day: rootState.day };
    rootState.memory.placementsToday.push({
      kind: "edge",
      edgeId: resolvedTarget.id,
      type: piece.type,
    });
  } else {
    const node = rootState.memory.board[resolvedTarget.id];
    node.structure = piece.type;
    node.day = rootState.day;
    rootState.memory.placementsToday.push({
      kind: "node",
      nodeId: resolvedTarget.id,
      type: piece.type,
    });
  }

  piece.used = true;
  rootState.memory.dragPieceId = null;
  rootState.memory.selectedPiece = rootState.memory.pieces.find((item) => !item.used)?.id || null;
  rootState.memory.cursor = resolvedTarget;
  return {
    ok: true,
    target: resolvedTarget,
  };
}

Object.assign(window.GAME_RUNTIME, {
  buildMemoryPiecesForState,
  normalizeMemoryCursorOnLayout,
  resolveMemoryTargetOnLayout,
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
