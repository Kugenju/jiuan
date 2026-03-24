window.GAME_RUNTIME = window.GAME_RUNTIME || {};

function clonePlayerValue(value) {
  return structuredClone(value);
}

function createBasePlayerState() {
  return {
    resources: { coins: 18, insight: 0, spirit: 1 },
    stats: {
      intelligence: 4,
      memory: 4,
      stamina: 4,
      inspiration: 4,
      willpower: 4,
      charisma: 3,
      cleanliness: 3,
      mood: 0,
      fatigue: 1,
      selfControl: 3,
      aura: 1,
    },
    skills: { math: 0, sigil: 0, dao: 0, craft: 0 },
    relationships: { roommate: 0, friend: 0, mentor: 0, counselor: 0 },
  };
}

function applyPlayerPack(target, patch) {
  Object.entries(patch || {}).forEach(([key, value]) => {
    target[key] += value;
  });
}

function resetPlayerStateOnRoot(rootState, basePlayerState = createBasePlayerState()) {
  rootState.resources = clonePlayerValue(basePlayerState.resources);
  rootState.stats = clonePlayerValue(basePlayerState.stats);
  rootState.skills = clonePlayerValue(basePlayerState.skills);
  rootState.relationships = clonePlayerValue(basePlayerState.relationships);
  return rootState;
}

function applyEffectBundleToRoot(rootState, bundle) {
  if (!bundle) {
    return rootState;
  }
  applyPlayerPack(rootState.stats, bundle.stats);
  applyPlayerPack(rootState.skills, bundle.skills);
  applyPlayerPack(rootState.resources, bundle.resources);
  applyPlayerPack(rootState.relationships, bundle.relationships);
  return rootState;
}

function applyArchetypeEffectToRoot(rootState, archetype) {
  if (!archetype?.effect) {
    return rootState;
  }
  return applyEffectBundleToRoot(rootState, archetype.effect);
}

function clampPlayerValue(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizePlayerState(rootState) {
  rootState.stats.intelligence = clampPlayerValue(rootState.stats.intelligence, 0, 12);
  rootState.stats.memory = clampPlayerValue(rootState.stats.memory, 0, 12);
  rootState.stats.stamina = clampPlayerValue(rootState.stats.stamina, 0, 12);
  rootState.stats.inspiration = clampPlayerValue(rootState.stats.inspiration, 0, 12);
  rootState.stats.willpower = clampPlayerValue(rootState.stats.willpower, 0, 12);
  rootState.stats.charisma = clampPlayerValue(rootState.stats.charisma, 0, 12);
  rootState.stats.cleanliness = clampPlayerValue(rootState.stats.cleanliness, 0, 12);
  rootState.stats.mood = clampPlayerValue(rootState.stats.mood, -5, 5);
  rootState.stats.fatigue = clampPlayerValue(rootState.stats.fatigue, 0, 10);
  rootState.stats.selfControl = clampPlayerValue(rootState.stats.selfControl, 0, 10);
  rootState.stats.aura = clampPlayerValue(rootState.stats.aura, 0, 10);

  Object.keys(rootState.skills).forEach((key) => {
    rootState.skills[key] = clampPlayerValue(rootState.skills[key], 0, 12);
  });
  Object.keys(rootState.relationships).forEach((key) => {
    rootState.relationships[key] = clampPlayerValue(rootState.relationships[key], -5, 8);
  });

  rootState.resources.coins = clampPlayerValue(rootState.resources.coins, 0, 99);
  rootState.resources.insight = clampPlayerValue(rootState.resources.insight, 0, 99);
  rootState.resources.spirit = clampPlayerValue(rootState.resources.spirit, 0, 20);

  return rootState;
}

Object.assign(window.GAME_RUNTIME, {
  createBasePlayerState,
  resetPlayerStateOnRoot,
  applyEffectBundleToRoot,
  applyArchetypeEffectToRoot,
  normalizePlayerState,
});
