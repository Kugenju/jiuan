(() => {
window.GAME_RUNTIME = window.GAME_RUNTIME || {};

function buildTextStateExport(rootState, context) {
  const selectedPiece =
    rootState.memory.pieces.find((piece) => piece.id === rootState.memory.selectedPiece) || null;
  const cursor = context.normalizeMemoryCursor(rootState.memory.cursor);
  const validNodes =
    selectedPiece && selectedPiece.type !== "link"
      ? context.layout.nodes
          .filter((node) => context.isValidPlacement(selectedPiece, { kind: "node", id: node.index }))
          .map((node) => ({ id: node.index, q: node.q, r: node.r }))
      : [];
  const validEdges =
    selectedPiece?.type === "link"
      ? context.layout.edges
          .filter((edge) => context.isValidPlacement(selectedPiece, { kind: "edge", id: edge.index }))
          .map((edge) => ({ id: edge.index, from: edge.a, to: edge.b }))
      : [];

  return {
    coordinate_system: context.uiText.stateExport.coordinateSystem,
    mode: rootState.mode,
    day: rootState.day,
    selected_archetype: rootState.selectedArchetype,
    current_story: rootState.currentStory.title,
    schedule: context.slotNames.map((slot, index) => ({
      slot,
      action: context.getActivity(rootState.schedule[index])?.name || context.uiText.common.unassigned,
      selected: rootState.selectedSlot === index,
    })),
    stats: rootState.stats,
    skills: rootState.skills,
    resources: rootState.resources,
    relationships: rootState.relationships,
    ui: rootState.ui,
    resolving: {
      current_slot_index: rootState.resolvingFlow.slotIndex,
      phase: rootState.resolvingFlow.phase,
      autoplay: rootState.resolvingFlow.autoplay,
      progress: Number(rootState.progress.toFixed(2)),
      segment_index: rootState.resolvingFlow.segmentIndex,
      segment_total: context.getResolvingSegments(
        Math.min(rootState.resolvingFlow.slotIndex, context.slotNames.length - 1)
      ).length,
      story_lines: rootState.resolvingFlow.storyTrail.map((item) => ({
        title: item.title,
        body: item.body,
      })),
    },
    memory: {
      selected_piece: selectedPiece
        ? {
            type: selectedPiece.type,
            skill: selectedPiece.skill,
          }
        : null,
      cursor:
        cursor.kind === "node"
          ? {
              kind: "node",
              id: cursor.id,
              q: context.layout.nodes[cursor.id].q,
              r: context.layout.nodes[cursor.id].r,
              zone: context.layout.nodes[cursor.id].zone,
            }
          : {
              kind: "edge",
              id: cursor.id,
              from: context.layout.edges[cursor.id].a,
              to: context.layout.edges[cursor.id].b,
            },
      valid_nodes: validNodes,
      valid_edges: validEdges,
      pieces_left: rootState.memory.pieces
        .filter((piece) => !piece.used)
        .map((piece) => ({ type: piece.type, skill: piece.skill || null })),
      board: rootState.memory.board.map((nodeState, index) => ({
        index,
        q: context.layout.nodes[index].q,
        r: context.layout.nodes[index].r,
        zone: nodeState.zone,
        unlocked: nodeState.unlocked,
        unlocked_day: nodeState.unlockedDay,
        structure: nodeState.structure,
        structure_skill: nodeState.structureSkill ?? null,
        structure_day: nodeState.day,
        fragments: (nodeState.fragments || []).map((fragment) => ({
          type: fragment.type,
          skill: fragment.skill || null,
        })),
      })),
      bridges: rootState.memory.bridges.map((bridge, edgeId) => ({
        edge_id: edgeId,
        from: context.layout.edges[edgeId].a,
        to: context.layout.edges[edgeId].b,
        built: Boolean(bridge),
        day: bridge?.day ?? null,
      })),
    },
    summary: rootState.summary,
  };
}

Object.assign(window.GAME_RUNTIME, {
  buildTextStateExport,
});
})();
