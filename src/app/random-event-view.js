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

function renderRandomEventModalHtml(input = {}) {
  const runtime = input.runtime || input.randomEventRuntime || {};
  const uiText = input.uiText || {};
  const stage = runtime?.stage || "idle";
  if (!stage || stage === "idle") {
    return "";
  }

  const randomEventText = uiText.randomEvent || {};
  const pendingEvent = runtime?.pendingEvent || {};
  const title = escapeHtml(pendingEvent.title || "");
  const body = escapeHtml(pendingEvent.body || "");
  const badge = escapeHtml(randomEventText.badge || "");
  const promptLabel = escapeHtml(randomEventText.promptLabel || "");
  const resultLabel = escapeHtml(randomEventText.resultLabel || "");
  const chooseHint = escapeHtml(randomEventText.chooseHint || "");
  const continueBtn = escapeHtml(randomEventText.continueBtn || "");
  const rewardPrefix = escapeHtml(randomEventText.rewardPrefix || "");

  const badgeMarkup = badge ? `<span class="random-event-seal">${badge}</span>` : "";

  if (stage === "prompt") {
    const choices = Array.isArray(pendingEvent.choices) ? pendingEvent.choices : [];
    const choiceButtons = choices
      .map(
        (choice, index) => `
          <button
            class="choice-card ${index === runtime.focusedChoiceIndex ? "active" : ""}"
            ${choice?.id ? `data-random-event-choice="${escapeAttr(choice.id)}"` : ""}
            type="button"
          >
            <strong>${escapeHtml(choice.label || "")}</strong>
            <small class="random-event-choice-copy">${escapeHtml(randomEventText.choiceCopy || "")}</small>
          </button>
        `
      )
      .join("");

    return `
      <div class="random-event-modal">
        <div class="panel-title">
          ${badgeMarkup}
          <h2>${promptLabel || title}</h2>
        </div>
        <div class="story-card random-event-copy">
          <strong>${title}</strong>
          <small>${body}</small>
        </div>
        <div class="random-event-divider">
          <small>${chooseHint}</small>
        </div>
        <div class="choice-grid random-event-choice-grid">
          ${choiceButtons}
        </div>
      </div>
    `;
  }

  if (stage === "result") {
    const rawResultText = String(runtime.resultText || "");
    const rawRewardSummary = String(runtime.rewardSummary || "");
    const rewardPrefixRaw = String(randomEventText.rewardPrefix || "");
    let cleanedResultText = rawResultText;
    if (rawRewardSummary && rewardPrefixRaw) {
      cleanedResultText = cleanedResultText.replace(`${rewardPrefixRaw}${rawRewardSummary}`, "");
    }
    cleanedResultText = cleanedResultText.replace(/\s+/g, " ").trim();
    const resultText = cleanedResultText ? escapeHtml(cleanedResultText) : body;
    const rewardSummary = escapeHtml(rawRewardSummary || "");
    const rewardBlock = rewardSummary
      ? `
        <div class="story-card random-event-reward">
          <strong>${rewardPrefix}</strong>
          <small>${rewardSummary}</small>
        </div>
      `
      : "";

    return `
      <div class="random-event-modal">
        <div class="panel-title">
          ${badgeMarkup}
          <h2>${resultLabel || title}</h2>
        </div>
        <div class="story-card random-event-copy random-event-result">
          <strong>${title}</strong>
          <small>${resultText || body}</small>
        </div>
        ${rewardBlock}
        <div class="action-row">
          <button class="primary" id="random-event-continue-btn" type="button">${continueBtn}</button>
        </div>
      </div>
    `;
  }

  return "";
}

Object.assign(window.GAME_RUNTIME, {
  renderRandomEventModalHtml,
});
})();
