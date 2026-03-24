window.GAME_DATA = window.GAME_DATA || {};

const DEFAULT_SCHEDULES = {
  scholar: ["wash", "dao_seminar", "cafeteria", "math_class", "walk_city", "homework"],
  mechanist: ["wash", "sigil_class", "cafeteria", "workshop", "part_time", "homework"],
  blade: ["training", "math_class", "cafeteria", "training", "walk_city", "wash"],
};

const SCHEDULE_PRESETS = [
  {
    id: "balanced",
    label: "稳扎稳打",
    schedule: ["wash", "math_class", "cafeteria", "sigil_class", "walk_city", "homework"],
  },
  {
    id: "craft_rush",
    label: "炼器冲刺",
    schedule: ["wash", "sigil_class", "cafeteria", "workshop", "part_time", "homework"],
  },
  {
    id: "body_expand",
    label: "修身拓展",
    schedule: ["training", "dao_seminar", "cafeteria", "training", "walk_city", "wash"],
  },
];

Object.assign(window.GAME_DATA, {
  DEFAULT_SCHEDULES,
  SCHEDULE_PRESETS,
});
