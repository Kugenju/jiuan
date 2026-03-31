(() => {
window.GAME_RUNTIME = window.GAME_RUNTIME || {};

function buildRefiningStageView(attempt, layout) {
  const boardOrigin = layout?.boardOrigin || { x: 0, y: 0 };
  const cardSize = layout?.cardSize || { width: 0, height: 0 };
  const cardGap = layout?.cardGap || { x: 0, y: 0 };
  const cards = (attempt?.deck || []).map((card, index) => {
    const row = Math.floor(index / 3);
    const col = index % 3;
    return {
      ...card,
      x: boardOrigin.x + col * (cardSize.width + cardGap.x),
      y: boardOrigin.y + row * (cardSize.height + cardGap.y),
      width: cardSize.width,
      height: cardSize.height,
      isSelected: attempt?.selectedCardId === card.id,
      isUsed: Boolean(card.used),
    };
  });

  const slots = (layout?.triangleSlots || []).map((slot, index) => ({
    index,
    x: slot.x,
    y: slot.y,
    width: slot.width,
    height: slot.height,
    cardId: attempt?.slots?.[index] || null,
  }));

  return {
    cards,
    slots,
  };
}

function hitTestRect(rect, x, y) {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

function hitTestRefiningStage(view, x, y) {
  const card = (view?.cards || []).find((item) => hitTestRect(item, x, y));
  if (card) {
    return { kind: "card", id: card.id };
  }
  const slot = (view?.slots || []).find((item) => hitTestRect(item, x, y));
  if (slot) {
    return { kind: "slot", index: slot.index };
  }
  return null;
}

function createRefiningPresetDecks() {
  return {
    success_basic: ["xuantie", "xuantie", "lingshi", "mujing", "mujing", "guanxing", "lingduan", "xuantie", "mujing"],
    failure_basic: ["xuantie", "xuantie", "xuantie", "mujing", "mujing", "guanxing", "lingshi", "lingduan", "mujing"],
    guanxing_demo: ["guanxing", "xuantie", "lingshi", "mujing", "xuantie", "mujing", "lingduan", "mujing", "xuantie"],
    lingduan_demo: ["lingduan", "xuantie", "xuantie", "mujing", "lingshi", "mujing", "guanxing", "mujing", "xuantie"],
  };
}

function findAttemptCard(attempt, cardId) {
  if (!cardId || !Array.isArray(attempt?.deck)) {
    return null;
  }
  return attempt.deck.find((card) => card.id === cardId) || null;
}

function buildRefiningTaskPanelState(input) {
  const taskText = input?.taskText || {};
  const attempt = input?.attempt || {};
  const slotCardLabels = input?.slotCardLabels || [];
  const refiningSession = input?.refiningSession || {};
  const roundIndex = Math.max(1, Number(refiningSession.roundIndex || 1));
  const maxRounds = Math.max(roundIndex, Number(refiningSession.maxRounds || 1));
  const getCardLabel =
    typeof input?.getCardLabel === "function"
      ? input.getCardLabel
      : (cardOrType) => (typeof cardOrType === "string" ? cardOrType : cardOrType?.type || "");
  return {
    activityName: input?.activity?.name || "",
    activitySummary: input?.activity?.summary || "",
    objectiveName: input?.taskDef?.objective?.name || input?.activity?.name || "",
    targetScoreText:
      typeof taskText.scoreTarget === "function" ? taskText.scoreTarget(input?.taskDef?.objective?.scoreTarget || 0) : "",
    remainingDaysText:
      typeof taskText.remainingDays === "function" ? taskText.remainingDays(input?.remainingDays || 0) : String(input?.remainingDays || 0),
    requirementText:
      typeof taskText.requirements === "function" ? taskText.requirements(input?.requirementText || "") : input?.requirementText || "",
    selectedCardText: input?.selectedCardLabel || taskText.noSelection || "",
    statusText: input?.statusText || "",
    attemptCountText:
      typeof taskText.attemptCount === "function" ? taskText.attemptCount(input?.task?.attemptCount || 0) : "",
    roundProgressText:
      typeof taskText.roundProgress === "function" ? taskText.roundProgress(roundIndex, maxRounds) : `${roundIndex}/${maxRounds}`,
    totalScoreText:
      typeof taskText.totalScore === "function"
        ? taskText.totalScore(refiningSession.totalScore || 0)
        : String(refiningSession.totalScore || 0),
    roundHistory: (refiningSession.roundResults || []).map((entry, index) => ({
      label:
        typeof taskText.roundLabel === "function"
          ? taskText.roundLabel(entry?.roundIndex || index + 1, entry?.score || 0)
          : `R${entry?.roundIndex || index + 1}`,
      score: entry?.score || 0,
    })),
    canConfirm: Boolean((attempt.slots || []).length && (attempt.slots || []).every(Boolean)),
    slotSummaries: (attempt.slots || [null, null, null]).map((cardId, index) => ({
      index,
      label: typeof taskText.slot === "function" ? taskText.slot(index) : String(index + 1),
      cardLabel:
        slotCardLabels[index] ||
        (cardId ? getCardLabel(findAttemptCard(attempt, cardId) || cardId) : null),
    })),
  };
}

function renderRefiningTaskPanelHtml(panelState, taskText = {}) {
  const slotSummaries = (panelState?.slotSummaries || [])
    .map(
      (slot) => `
        <div class="task-slot-summary ${slot.cardLabel ? "filled" : ""}">
          <strong>${slot.label}</strong>
          <small>${slot.cardLabel || taskText.emptySlot || ""}</small>
        </div>
      `
    )
    .join("");
  const roundHistory = (panelState?.roundHistory || [])
    .map(
      (entry) => `
        <div class="task-round-pill">
          <strong>${entry.label}</strong>
          <small>${typeof taskText.totalScore === "function" ? taskText.totalScore(entry.score || 0) : entry.score || 0}</small>
        </div>
      `
    )
    .join("");

  return `
    <div class="planning-shell task-summary-shell">
      <div class="panel-title">
        <h2>${taskText.title || ""}</h2>
        <span class="badge">${panelState?.remainingDaysText || ""}</span>
      </div>
      <div class="story-card focus-callout">
        <strong>${panelState?.activityName || ""}</strong>
        <small>${panelState?.activitySummary || ""}</small>
        <small>${panelState?.attemptCountText || ""}</small>
      </div>
      <div class="planning-meta-grid">
        <div class="story-card">
          <strong>${taskText.objective || ""}</strong>
          <small>${panelState?.objectiveName || ""}</small>
          <small>${panelState?.targetScoreText || ""}</small>
        </div>
        <div class="story-card">
          <strong>${taskText.requirement || ""}</strong>
          <small>${panelState?.requirementText || ""}</small>
          <small>${panelState?.statusText || ""}</small>
        </div>
      </div>
      <div class="planning-meta-grid">
        <div class="story-card">
          <strong>${taskText.roundTitle || "轮次"}</strong>
          <small>${panelState?.roundProgressText || ""}</small>
        </div>
        <div class="story-card">
          <strong>${taskText.totalScoreTitle || "累计积分"}</strong>
          <small>${panelState?.totalScoreText || ""}</small>
        </div>
      </div>
      ${roundHistory ? `<div class="task-round-history">${roundHistory}</div>` : ""}
      <div class="task-slot-summary-grid">${slotSummaries}</div>
      <div class="story-card">
        <strong>${taskText.selected || ""}</strong>
        <small>${panelState?.selectedCardText || ""}</small>
        <small>${panelState?.statusText || ""}</small>
      </div>
      <div class="action-row planning-actions">
        <button class="primary" id="task-confirm-btn" data-task-control="confirm" ${panelState?.canConfirm ? "" : "disabled"}>${
          taskText.confirm || ""
        }</button>
      </div>
    </div>
  `;
}

Object.assign(window.GAME_RUNTIME, {
  buildRefiningStageView,
  hitTestRefiningStage,
  createRefiningPresetDecks,
  buildRefiningTaskPanelState,
  renderRefiningTaskPanelHtml,
});
})();
