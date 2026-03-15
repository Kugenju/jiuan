# 数据编辑说明

现在数据已经按内容类型拆分，后续你修改时可以只动对应文件，不需要再去翻一个总表。

## 文件分工

- `data/core.js`
  - `SLOT_NAMES`
  - `SKILL_LABELS`
  - `MEMORY_TYPES`
- `data/archetypes.js`
  - `ARCHETYPES`
- `data/activities.js`
  - `ACTIVITIES`
- `data/schedules.js`
  - `DEFAULT_SCHEDULES`
  - `SCHEDULE_PRESETS`
- `data/story.js`
  - `DAY_MODIFIERS`
  - `STORY_BEATS`
  - `RANK_THRESHOLDS`
- `data/copy.js`
  - `COPY`

## 该往哪里加内容

- 新增开局原型：改 `data/archetypes.js`
- 新增白天事件或行动：改 `data/activities.js`
- 调整默认日程和预设按钮：改 `data/schedules.js`
- 新增每日状态、剧情触发、结算评级：改 `data/story.js`
- 修改界面文案、叙事文案、日志文案：改 `data/copy.js`
- 修改时段名、技能名、灵块类型：改 `data/core.js`

## 新增一个白天事件

在 `data/activities.js` 的 `ACTIVITIES` 里新增一个对象。

```js
{
  id: "library",
  name: "藏书阁自习",
  tone: "study",
  summary: "安静整理笔记，适合稳步提升记忆与悟性。",
  scene: "library",
  skill: "dao",
  preferred: [0, 3],
  effects: {
    stats: { memory: 1 },
    skills: { dao: 1 },
    resources: { insight: 1 },
  },
  preferredEffects: {
    stats: { willpower: 1 },
  },
  notes: {
    base: "你把零散笔记梳理成了更清晰的理解。",
    preferred: "这个时段更适合静修，额外获得了心力收益。",
  },
}
```

当前支持的 `tone`：

- `study`
- `life`
- `body`
- `social`

## 新增一个预设流程

在 `data/schedules.js` 的 `SCHEDULE_PRESETS` 里新增：

```js
{
  id: "library_day",
  label: "藏书日",
  schedule: ["library", "cafeteria", "dao_seminar", "homework"],
}
```

界面会自动生成对应按钮。

## 新增一个剧情触发

在 `data/story.js` 的 `STORY_BEATS` 里新增：

```js
{
  id: "library_secret",
  condition: {
    activityId: "library",
    minDay: 2,
    minSkill: { key: "dao", value: 3 },
  },
  effect: {
    resources: { insight: 2 },
    relationships: { mentor: 1 },
  },
  note: "你在旧书堆里翻到一页残卷，获得了新的悟道线索。",
}
```

当前支持的触发条件键：

- `activityId`
- `minDay`
- `minSkill`
- `maxStat`
- `minRelationship`
- `combinedSkillsAtLeast`

## 规则

- 每个 `id` 都必须唯一。
- `schedule` 里引用的活动 id 必须已经存在于 `ACTIVITIES` 中。
- 数值变化统一写在 `effects`、`preferredEffects` 或 `effect` 里，不要再去 `main.js` 里额外补分支。
