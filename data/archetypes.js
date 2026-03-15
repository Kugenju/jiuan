window.GAME_DATA = window.GAME_DATA || {};

const ARCHETYPES = [
  {
    id: "scholar",
    name: "寒门求道者",
    title: "记忆与自控见长",
    summary: "从乱世中辗转而来，靠抄书和旁听打下底子，擅长把零散知识稳稳记住。",
    effect: {
      stats: { memory: 2, selfControl: 1, mood: -1 },
      skills: { dao: 1 },
      resources: { coins: -4, insight: 1 },
      relationships: { counselor: 1 },
    },
  },
  {
    id: "mechanist",
    name: "机关痴",
    title: "智力与炼器起步更高",
    summary: "最熟悉的是拆东西再装回去，擅长在工坊和课堂里做出超规格成果。",
    effect: {
      stats: { intelligence: 2, inspiration: 1, cleanliness: -1 },
      skills: { craft: 2, sigil: 1 },
      resources: { coins: 2 },
      relationships: { roommate: -1 },
    },
  },
  {
    id: "blade",
    name: "剑体兼修生",
    title: "体力、魅力和灵力更稳",
    summary: "靠一身好体魄和擂台名气挤进久安，练功、社交和突发事件都更从容。",
    effect: {
      stats: { stamina: 2, charisma: 2, aura: 1 },
      skills: { dao: 1 },
      resources: { spirit: 1 },
      relationships: { friend: 1, mentor: 1 },
    },
  },
];

Object.assign(window.GAME_DATA, {
  ARCHETYPES,
});
