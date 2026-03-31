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

Object.assign(window.GAME_RUNTIME, {
  buildRefiningStageView,
  hitTestRefiningStage,
  createRefiningPresetDecks,
});
})();
