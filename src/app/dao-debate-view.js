(() => {
  window.GAME_RUNTIME = window.GAME_RUNTIME || {};

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  function buildDaoDebateTaskPanelState(input) {
    const taskText = input?.taskText || {};
    const session = input?.session || {};
    const roundIndex = Math.max(1, Number(session.roundIndex || 1));
    const maxRounds = Math.max(roundIndex, Number(session.maxRounds || 1));
    return {
      activityName: input?.activity?.name || "",
      activitySummary: input?.activity?.summary || "",
      promptTitle: session.currentPrompt?.title || "",
      promptBody: session.currentPrompt?.body || "",
      roundText:
        typeof taskText.daoDebateRound === "function" ? taskText.daoDebateRound(roundIndex, maxRounds) : `${roundIndex}/${maxRounds}`,
      convictionText:
        typeof taskText.daoConviction === "function" ? taskText.daoConviction(session.conviction || 0) : String(session.conviction || 0),
      exposureText:
        typeof taskText.daoExposure === "function" ? taskText.daoExposure(session.exposure || 0) : String(session.exposure || 0),
      attemptCountText:
        typeof taskText.attemptCount === "function" ? taskText.attemptCount(input?.task?.attemptCount || 0) : "",
      cards: (session.hand || []).map((card) => ({
        id: card.id,
        label: card.label,
        tagText: typeof taskText.daoDebateTag === "function" ? taskText.daoDebateTag(card.tag) : "",
      })),
      history: session.history || [],
    };
  }

  function renderDaoDebateTaskPanelHtml(panelState) {
    const cardsHtml = (panelState?.cards || [])
      .map(
        (card) => `
          <button class="activity-card" type="button" data-task-control="debate-card" data-debate-card="${escapeAttr(card.id)}">
            <strong>${escapeHtml(card.label || "")}</strong>
            ${card.tagText ? `<small>${escapeHtml(card.tagText)}</small>` : ""}
          </button>
        `
      )
      .join("");
    return `
      <div class="planning-shell task-summary-shell dao-debate-shell">
        <div class="panel-title">
          <h2>${escapeHtml(panelState?.activityName || "")}</h2>
          <span class="badge">${escapeHtml(panelState?.roundText || "")}</span>
        </div>
        <div class="story-card focus-callout">
          <strong>${escapeHtml(panelState?.promptTitle || "")}</strong>
          <small>${escapeHtml(panelState?.promptBody || "")}</small>
          <small>${escapeHtml(panelState?.attemptCountText || "")}</small>
        </div>
        <div class="planning-meta-grid">
          <div class="story-card"><strong>${escapeHtml(panelState?.convictionText || "")}</strong></div>
          <div class="story-card"><strong>${escapeHtml(panelState?.exposureText || "")}</strong></div>
        </div>
        <div class="activity-grid planning-activity-grid">
          ${cardsHtml}
        </div>
      </div>
    `;
  }

  Object.assign(window.GAME_RUNTIME, {
    buildDaoDebateTaskPanelState,
    renderDaoDebateTaskPanelHtml,
  });
})();
