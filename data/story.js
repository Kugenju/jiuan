window.GAME_DATA = window.GAME_DATA || {};

const DAY_MODIFIERS = [
  {
    id: "fatigue",
    title: "困顿",
    body: "昨夜消耗过大，今天第一个时段的收益会下降。",
    consumeOn: "any",
    condition: { stat: "fatigue", min: 6 },
    effect: { stats: { mood: -1 } },
  },
  {
    id: "cleanliness",
    title: "邋遢警告",
    body: "舍友和辅导员都对你的状态有意见，今天魅力与关系更容易波动。",
    consumeOn: "any",
    condition: { stat: "cleanliness", max: 1 },
    effect: {
      stats: { charisma: -1 },
      relationships: { counselor: -1 },
    },
  },
  {
    id: "momentum",
    title: "心流",
    body: "你今天状态很顺，第一次学习类行动会额外获得灵感。",
    consumeOn: "study",
    condition: { stat: "mood", min: 3 },
    effect: { stats: { inspiration: 1 } },
  },
];

const STORY_BEATS = [
  {
    id: "mentorMet",
    condition: {
      combinedSkillsAtLeast: { keys: ["sigil", "math"], value: 5 },
    },
    effect: {
      relationships: { mentor: 2 },
    },
    note: "导师林岚注意到了你的天赋，导师关系 +2。",
  },
  {
    id: "workshopArtifact",
    condition: {
      activityId: "workshop",
      minSkill: { key: "craft", value: 4 },
    },
    effect: {
      resources: { spirit: 2 },
    },
    note: "你把健身房顺来的铁片炼成了法宝雏形，灵力 +2。",
  },
  {
    id: "missingClue",
    condition: {
      activityId: "walk_city",
      minDay: 3,
    },
    effect: {
      relationships: { friend: 2 },
    },
    note: "你在久安城南集听到关于失踪舍友的传闻，朋友线索 +2。",
  },
  {
    id: "counselorWarned",
    condition: {
      activityId: "game_hall",
      maxStat: { key: "selfControl", value: 2 },
    },
    effect: {
      relationships: { counselor: -1 },
    },
    note: "辅导员点名提醒你别把第一周玩废了，辅导员关系 -1。",
  },
  {
    id: "roommateBonded",
    condition: {
      activityId: "training",
      minRelationship: { key: "roommate", value: 2 },
    },
    effect: {
      relationships: { roommate: 1 },
    },
    note: "你和舍友在操场上搭上线，他愿意帮你补齐缺的器材。",
  },
];

const RANK_THRESHOLDS = [
  { min: 28, label: "上上品" },
  { min: 24, label: "上中品" },
  { min: 20, label: "上下品" },
  { min: 17, label: "中上品" },
  { min: 14, label: "中中品" },
  { min: 11, label: "中下品" },
  { min: 8, label: "下上品" },
  { min: -Infinity, label: "下中品" },
];

Object.assign(window.GAME_DATA, {
  DAY_MODIFIERS,
  STORY_BEATS,
  RANK_THRESHOLDS,
});
