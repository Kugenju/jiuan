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

  const DEFAULT_BASE_MATERIAL_TYPES = ["xuantie", "lingshi", "mujing"];

  function getRngValue(rng) {
    if (typeof rng === "function") {
      const value = rng();
      if (typeof value === "number" && Number.isFinite(value)) {
        if (value <= 0) return 0;
        if (value >= 1) return 0.9999999999999999;
        return value;
      }
    }
    return Math.random();
  }

  function shuffleDeck(deck, rng) {
    for (let i = deck.length - 1; i > 0; i -= 1) {
      const j = Math.floor(getRngValue(rng) * (i + 1));
      const temp = deck[i];
      deck[i] = deck[j];
      deck[j] = temp;
    }
    return deck;
  }

  function createRefiningAttemptState(taskDef, rng) {
    const deck = BASE_DECK.map((type, index) => ({
      id: `card-${index}`,
      type,
      revealed: false,
      used: false,
    }));
    shuffleDeck(deck, rng);

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
    if (
      !attempt ||
      !Array.isArray(attempt.deck) ||
      !Number.isInteger(attempt.revealsRemaining) ||
      attempt.revealsRemaining <= 0
    ) {
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
    if (
      !attempt ||
      !Array.isArray(attempt.deck) ||
      !Array.isArray(attempt.slots) ||
      !Number.isInteger(slotIndex) ||
      slotIndex < 0 ||
      slotIndex >= attempt.slots.length
    ) {
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

  function getBaseMaterialTypes() {
    const cardTypes = (window.GAME_DATA && window.GAME_DATA.REFINING_CARD_TYPES) || null;
    if (!cardTypes) {
      return DEFAULT_BASE_MATERIAL_TYPES.slice();
    }

    const materials = Object.values(cardTypes)
      .filter((cardType) => cardType && cardType.category === "material")
      .map((cardType) => cardType.id)
      .filter(Boolean);
    return materials.length > 0 ? materials : DEFAULT_BASE_MATERIAL_TYPES.slice();
  }

  function getTypeCounts(types) {
    return types.reduce((acc, type) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
  }

  function getResolvedRecipeScore(types) {
    const normalizedTypes = types.slice().sort();
    const recipeKey = normalizedTypes.join("|");
    const table = (window.GAME_DATA && window.GAME_DATA.REFINING_RECIPE_TABLE) || {};
    const score = table[recipeKey] || 0;
    return { normalizedTypes, recipeKey, score };
  }

  function hasRequiredMaterials(normalizedTypes, requirements) {
    const counts = getTypeCounts(normalizedTypes);
    if (!requirements || typeof requirements !== "object") {
      return true;
    }

    return Object.keys(requirements).every((materialType) => {
      const requiredCount = requirements[materialType];
      if (typeof requiredCount !== "number" || requiredCount <= 0) {
        return true;
      }
      return (counts[materialType] || 0) >= requiredCount;
    });
  }

  function buildTypeVariants(baseTypes, wildcardCount, baseMaterials) {
    if (wildcardCount <= 0) {
      return [baseTypes.slice()];
    }

    const variants = [];
    const path = [];
    function walk(depth) {
      if (depth === wildcardCount) {
        variants.push(baseTypes.concat(path));
        return;
      }
      baseMaterials.forEach((materialType) => {
        path.push(materialType);
        walk(depth + 1);
        path.pop();
      });
    }
    walk(0);
    return variants;
  }

  function selectBestResolution(types, taskDef) {
    const objective = (taskDef && taskDef.objective) || {};
    const requirements = objective.materialRequirements || {};
    const baseTypes = types.filter((type) => type !== "lingduan");
    const wildcardCount = types.length - baseTypes.length;
    const baseMaterials = getBaseMaterialTypes();
    const variants = buildTypeVariants(baseTypes, wildcardCount, baseMaterials);

    const scoredVariants = variants.map((variantTypes) => {
      const recipe = getResolvedRecipeScore(variantTypes);
      const requirementsMet = hasRequiredMaterials(recipe.normalizedTypes, requirements);
      return {
        ...recipe,
        requirementsMet,
      };
    });

    const requirementsMetVariants = scoredVariants.filter((variant) => variant.requirementsMet);
    const pool = requirementsMetVariants.length > 0 ? requirementsMetVariants : scoredVariants;
    return pool.reduce((best, current) => {
      if (!best) return current;
      if (current.score > best.score) return current;
      if (current.score === best.score && current.recipeKey < best.recipeKey) return current;
      return best;
    }, null);
  }

  function resolveRefiningAttempt(attempt, taskDef) {
    if (!attempt || !Array.isArray(attempt.deck) || !Array.isArray(attempt.slots)) {
      return null;
    }

    const placedCards = attempt.slots.map((cardId) => attempt.deck.find((card) => card.id === cardId));
    const complete = placedCards.every(Boolean);
    if (!complete) {
      const result = { score: 0, success: false, complete: false, recipeKey: null };
      attempt.result = result;
      return result;
    }

    const placedTypes = placedCards.map((card) => card.type);
    const best = selectBestResolution(placedTypes, taskDef);
    const normalizedTypes = (best && best.normalizedTypes) || [];
    const recipeKey = (best && best.recipeKey) || "";
    const score = (best && best.score) || 0;
    const objective = (taskDef && taskDef.objective) || {};
    const hasValidObjective = !!(
      taskDef &&
      typeof taskDef === "object" &&
      taskDef.objective &&
      typeof taskDef.objective === "object"
    );
    const success =
      hasValidObjective &&
      score >= (objective.scoreTarget || 0) &&
      hasRequiredMaterials(normalizedTypes, objective.materialRequirements || {});

    const result = { score, success, complete: true, recipeKey };
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
