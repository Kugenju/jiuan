window.GAME_DATA = window.GAME_DATA || {};

const DEFAULT_SCHEDULES = {
  scholar: ["dao_seminar", "cafeteria", "math_class", "homework"],
  mechanist: ["sigil_class", "cafeteria", "workshop", "wash"],
  blade: ["math_class", "cafeteria", "training", "walk_city"],
};

const SCHEDULE_PRESETS = [
  {
    id: "balanced",
    label: "稳扎稳打",
    schedule: ["math_class", "cafeteria", "sigil_class", "homework"],
  },
  {
    id: "craft_rush",
    label: "炼器冲刺",
    schedule: ["sigil_class", "wash", "workshop", "homework"],
  },
  {
    id: "body_expand",
    label: "修身拓展",
    schedule: ["dao_seminar", "walk_city", "training", "wash"],
  },
];

Object.assign(window.GAME_DATA, {
  DEFAULT_SCHEDULES,
  SCHEDULE_PRESETS,
});
