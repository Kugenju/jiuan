window.GAME_DATA = window.GAME_DATA || {};

const WEEKDAY_LABELS = ["初一", "初二", "初三", "初四", "初五", "初六", "初七"];

const COURSE_SELECTION_BLOCKS = {
  scholar: [
    {
      id: "scholar_morning_core",
      label: "晨课主修",
      slotIndex: 1,
      days: [1, 3, 5],
      options: ["dao_seminar", "math_class", "sigil_class"],
      recommended: "dao_seminar",
    },
    {
      id: "scholar_afternoon_core",
      label: "午后专修",
      slotIndex: 3,
      days: [1, 2, 4, 6],
      options: ["math_class", "dao_seminar", "sigil_class"],
      recommended: "math_class",
    },
    {
      id: "scholar_weekend_seminar",
      label: "周末研修",
      slotIndex: 1,
      days: [6, 7],
      options: ["dao_seminar", "sigil_class", "math_class"],
      recommended: "dao_seminar",
    },
  ],
  mechanist: [
    {
      id: "mechanist_morning_symbols",
      label: "晨课符构",
      slotIndex: 1,
      days: [1, 3, 5],
      options: ["sigil_class", "math_class"],
      recommended: "sigil_class",
    },
    {
      id: "mechanist_afternoon_workshop",
      label: "午后工坊",
      slotIndex: 3,
      days: [1, 2, 4, 6],
      options: ["workshop", "math_class", "sigil_class"],
      recommended: "workshop",
    },
    {
      id: "mechanist_weekend_lab",
      label: "周末加修",
      slotIndex: 1,
      days: [6, 7],
      options: ["workshop", "sigil_class"],
      recommended: "workshop",
    },
  ],
  blade: [
    {
      id: "blade_morning_foundation",
      label: "晨课基础",
      slotIndex: 1,
      days: [1, 3, 5],
      options: ["math_class", "dao_seminar"],
      recommended: "math_class",
    },
    {
      id: "blade_afternoon_theory",
      label: "午后术理",
      slotIndex: 3,
      days: [1, 2, 4, 6],
      options: ["dao_seminar", "math_class", "sigil_class"],
      recommended: "dao_seminar",
    },
    {
      id: "blade_weekend_focus",
      label: "周末专练",
      slotIndex: 1,
      days: [6, 7],
      options: ["dao_seminar", "math_class"],
      recommended: "dao_seminar",
    },
  ],
};

const SCHEDULE_PRESETS = [
  {
    id: "balanced",
    label: "稳扎稳打",
    schedule: ["wash", null, "cafeteria", null, "walk_city", "homework"],
  },
  {
    id: "craft_rush",
    label: "工坊课后",
    schedule: ["wash", null, "cafeteria", null, "part_time", "homework"],
  },
  {
    id: "body_expand",
    label: "修身舒展",
    schedule: ["training", null, "cafeteria", null, "training", "wash"],
  },
];

Object.assign(window.GAME_DATA, {
  WEEKDAY_LABELS,
  COURSE_SELECTION_BLOCKS,
  SCHEDULE_PRESETS,
});
