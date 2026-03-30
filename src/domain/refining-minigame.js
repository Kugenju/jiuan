(() => {
  window.GAME_RUNTIME = window.GAME_RUNTIME || {};

  const BASE_DECK = [
    "xuantie",
    "xuantie",
    "lingshi",
    "lingshi",
    "mujing",
    "mujing",
    "guanxing",
    "lingduan",
    "xuantie",
  ];

  function createRefiningAttemptState(taskDef, rng) {
    void rng;
    const deck = BASE_DECK.map((type, index) => ({
      id: `card-${index}`,
      type,
      revealed: false,
      used: false,
    }));

    return {
      taskType: taskDef ? taskDef.id : null,
      deck,
      slots: [null, null, null],
      revealsRemaining: 3,
      selectedCardId: null,
      result: null,
    };
  }

  function revealNeighborCards(attempt, index) {
    const row = Math.floor(index / 3);
    const col = index % 3;
    const neighbors = [];
    if (row > 0) neighbors.push(index - 3);
    if (row < 2) neighbors.push(index + 3);
    if (col > 0) neighbors.push(index - 1);
    if (col < 2) neighbors.push(index + 1);

    neighbors.forEach((neighborIndex) => {
      const card = attempt.deck[neighborIndex];
      if (card) {
        card.revealed = true;
      }
    });
  }

  function revealRefiningCard(attempt, cardId) {
    if (!attempt || !Array.isArray(attempt.deck) || attempt.revealsRemaining <= 0) {
      return false;
    }

    const cardIndex = attempt.deck.findIndex((card) => card.id === cardId);
    if (cardIndex < 0) {
      return false;
    }

    const card = attempt.deck[cardIndex];
    if (card.revealed) {
      return false;
    }

    card.revealed = true;
    attempt.revealsRemaining -= 1;

    if (card.type === "guanxing") {
      revealNeighborCards(attempt, cardIndex);
    }

    return true;
  }

  function placeRefiningCardInSlot(attempt, cardId, slotIndex) {
    if (!attempt || !Array.isArray(attempt.slots) || slotIndex < 0 || slotIndex >= attempt.slots.length) {
      return false;
    }
    if (attempt.slots[slotIndex]) {
      return false;
    }

    const card = attempt.deck.find((item) => item.id === cardId);
    if (!card || !card.revealed || card.used) {
      return false;
    }

    card.used = true;
    attempt.slots[slotIndex] = cardId;
    return true;
  }

  function getResolvedRecipeScore(placedCards) {
    const normalizedTypes = placedCards
      .filter(Boolean)
      .map((card) => (card.type === "lingduan" ? "lingshi" : card.type))
      .sort();
    const recipeKey = normalizedTypes.join("|");
    const table = (window.GAME_DATA && window.GAME_DATA.REFINING_RECIPE_TABLE) || {};
    const score = table[recipeKey] || 0;
    return { normalizedTypes, recipeKey, score };
  }

  function hasRequiredMaterials(normalizedTypes, requirements) {
    const counts = normalizedTypes.reduce((acc, type) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
    const needXuantie = (requirements && requirements.xuantie) || 0;
    const needLingshi = (requirements && requirements.lingshi) || 0;
    return (counts.xuantie || 0) >= needXuantie && (counts.lingshi || 0) >= needLingshi;
  }

  function resolveRefiningAttempt(attempt, taskDef) {
    if (!attempt || !Array.isArray(attempt.deck) || !Array.isArray(attempt.slots)) {
      return null;
    }

    const placedCards = attempt.slots.map((cardId) => attempt.deck.find((card) => card.id === cardId));
    const { normalizedTypes, recipeKey, score } = getResolvedRecipeScore(placedCards);
    const objective = (taskDef && taskDef.objective) || {};
    const success =
      score >= (objective.scoreTarget || 0) &&
      hasRequiredMaterials(normalizedTypes, objective.materialRequirements || {});

    const result = { score, success, recipeKey };
    attempt.result = result;
    return result;
  }

  Object.assign(window.GAME_RUNTIME, {
    createRefiningAttemptState,
    revealRefiningCard,
    placeRefiningCardInSlot,
    resolveRefiningAttempt,
  });
})();
