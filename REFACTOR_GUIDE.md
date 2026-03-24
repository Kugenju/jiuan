# 久安问道录 Demo 重构指导

## 1. 文档目标

本文基于两部分输入：

- `游戏demo策划案.pdf`：明确了 demo 的核心目标是验证“一周养成 + 课程/事件 + 夜间记忆构筑 + 评级结算”的玩法闭环。
- 当前代码结构：`main.js` 负责状态、规则、输入、渲染、UI 接线，`data/*.js` 只承担部分内容配置。

本次重构的目标不是先做“大而全”的正式工程，而是做一套适合**持续验证玩法**的架构：

- 新玩法能以模块方式插入，而不是继续堆在 `main.js`
- 数值、剧情、课程、记忆构筑可以分别迭代
- 同一套规则能被 UI、自动化测试、调试工具复用
- 每次改动后可以快速验证“是否破坏了一周核心流程”

## 2. 现状诊断

当前 demo 已经具备可玩的周循环，但架构上存在明显瓶颈：

1. `main.js` 同时承担状态定义、规则结算、阶段切换、Canvas 绘制、DOM 渲染、事件绑定、测试导出。
2. 当前状态对象是单体结构，白天玩法、夜间玩法、剧情、UI 开关都挂在同一个根对象上，修改一个系统容易影响其他系统。
3. `data/*.js` 目前主要是静态内容表，很多玩法规则仍写死在运行时函数里，例如记忆块生成、夜间结算、阶段推进。
4. “白天日程块”和“夜间记忆块”还没有统一的可扩展协议，新增玩法通常要同时改数据、流程函数、渲染分支。
5. 虽然已有 `render_game_to_text` 和 `advanceTime` 这类自动化钩子，但缺少面向模块的验证入口，难以做规则级回归。

结论：当前实现适合快速原型，但不适合继续扩充课程、人物、随机事件、作业小游戏、混合记忆塔等策划案中的核心玩法。

## 3. 重构目标

### 3.1 核心原则

1. 玩法规则优先于表现层。
2. 内容驱动优先于硬编码分支。
3. 命令驱动状态变更，避免任意函数直接改全局状态。
4. UI 只消费状态和派发命令，不负责游戏规则。
5. 所有关键玩法必须能脱离浏览器界面单独验证。

### 3.2 Demo 阶段必须支持的验证对象

第一阶段架构至少要稳定支持以下玩法验证：

- 一周日程编排与推进
- 固定事件、可选事件、随机事件三类日程块
- 属性/状态/技能/关系的统一结算
- 课程与作业的差异化收益
- 夜间短期记忆 -> 长期记忆构筑
- 记忆块衰减、保留、转化
- 剧情触发与支线标记
- 周评级与阶段目标结算

## 4. 推荐架构总览

推荐采用“内容层 + 领域层 + 应用层 + 表现层 + 调试验证层”的结构。

```text
root/
  data/                        # 纯内容定义
    archetypes/
    activities/
    courses/
    events/
    memory/
    story/
    balance/
  src/
    app/                       # 流程编排与会话管理
      game-session.js
      phase-machine.js
      command-dispatcher.js
      event-log.js
      selectors.js
    domain/                    # 核心玩法规则
      player/
      schedule/
      activity/
      course/
      event/
      memory/
      story/
      summary/
    ui/                        # DOM / Canvas / 输入适配
      bootstrap.js
      renderers/
      panels/
      input/
    debug/                     # 调试、导出、测试场景
      state-export.js
      scenario-runner.js
      seeds.js
  desktop/                     # Electron 外壳
  scripts/                     # 构建/校验/自动化脚本
```

### 4.1 分层职责

#### 内容层 `data/`

职责：

- 提供课程、活动、事件、人物、剧情、记忆构件、评级参数
- 只描述“是什么”，不描述“怎么跑”

约束：

- 不写 DOM
- 不写流程跳转
- 不在内容文件里直接操作状态

#### 领域层 `src/domain/`

职责：

- 处理纯规则
- 输入旧状态和命令/上下文，输出新状态和事件
- 可以脱离浏览器单独测试

约束：

- 不读写 DOM
- 不直接调用 `querySelector`
- 不依赖 Canvas

#### 应用层 `src/app/`

职责：

- 管理当前会话
- 负责阶段推进、命令分发、事件日志、状态快照
- 把多个领域模块组合成完整的一天/一周流程

约束：

- 不写具体美术渲染细节
- 不承载复杂数值规则

#### 表现层 `src/ui/`

职责：

- 根据状态渲染菜单、日程面板、结算面板、记忆盘面
- 将点击、键盘、拖拽转换为命令

约束：

- 不直接计算活动收益
- 不直接修改状态树

#### 调试验证层 `src/debug/`

职责：

- 导出状态文本
- 固定随机种子
- 跑预定义场景
- 提供自动化断言入口

## 5. 核心模块设计

### 5.1 玩家核心模块 `domain/player`

职责：

- 管理属性、状态、技能、资源、关系
- 负责 clamp、派生值、检定公式

建议拆分：

- `player-stats.js`
- `player-status.js`
- `player-skills.js`
- `player-relations.js`
- `player-derived.js`

接口协议：

```ts
type PlayerStats = {
  intelligence: number
  memory: number
  stamina: number
  inspiration: number
  willpower: number
  aura: number
  charisma: number
  cleanliness: number
}

type PlayerStatus = {
  mood: number
  fatigue: number
  selfControl: number
}

type PlayerResources = {
  coins: number
  insight: number
  spirit: number
}

type PlayerProfile = {
  stats: PlayerStats
  status: PlayerStatus
  skills: Record<string, number>
  resources: PlayerResources
  relationships: Record<string, number>
}

type EffectBundle = {
  stats?: Partial<PlayerStats>
  status?: Partial<PlayerStatus>
  skills?: Record<string, number>
  resources?: Partial<PlayerResources>
  relationships?: Record<string, number>
}

function applyEffect(profile: PlayerProfile, effect: EffectBundle): PlayerProfile
function normalizeProfile(profile: PlayerProfile): PlayerProfile
function buildDerivedContext(profile: PlayerProfile): DerivedContext
```

验证方式：

- 单测：不同 `EffectBundle` 叠加后的上下限正确
- 单测：疲惫、自控、心力等派生检定稳定
- 场景测试：极端数值下不会出现负资源、越界状态

### 5.2 日程系统 `domain/schedule`

职责：

- 管理日历、天数、时段、日程槽
- 支持固定事件、可选事件、随机事件、剧情事件插入
- 管理起床检定、缺席、插班、临时覆盖

核心抽象：

- `ScheduleSlot`
- `ScheduleEntry`
- `DailyPlan`
- `ScheduleContext`

接口协议：

```ts
type ScheduleSlotId = "morning" | "noon" | "afternoon" | "night"

type ScheduleEntry = {
  id: string
  kind: "course" | "activity" | "assignment" | "story" | "random"
  sourceId: string
  locked?: boolean
  tags?: string[]
}

type DailyPlan = {
  day: number
  slots: Record<ScheduleSlotId, ScheduleEntry | null>
  modifiers: string[]
}

type DayStartResult = {
  plan: DailyPlan
  injectedEvents: RuntimeEvent[]
}

function createDailyPlan(input: DailyPlanSeed): DailyPlan
function setScheduleEntry(plan: DailyPlan, slot: ScheduleSlotId, entry: ScheduleEntry): DailyPlan
function validateDailyPlan(plan: DailyPlan, rules: ScheduleRules): ValidationResult
function buildDayStart(plan: DailyPlan, context: ScheduleContext): DayStartResult
```

验证方式：

- 单测：不可把锁定课程覆盖掉
- 单测：随机事件能按条件插入或替换时段
- 场景测试：空排程、全锁定排程、剧情插队排程都能正常推进

### 5.3 活动/课程结算模块 `domain/activity` + `domain/course`

职责：

- 统一处理白天时段执行
- 支持不同玩法形态：纯过场、数值结算、小游戏、对话、实践任务

建议统一成“执行器协议”：

```ts
type ActivityDefinition = {
  id: string
  kind: "course" | "activity" | "assignment" | "practice"
  tone: "study" | "life" | "body" | "social"
  tags: string[]
  preferredSlots?: ScheduleSlotId[]
  baseEffect?: EffectBundle
  preferredEffect?: EffectBundle
  specialRules?: SpecialRuleRef[]
  memoryOutput?: MemoryOutputRule[]
  eventHooks?: EventHookRef[]
}

type ActivityResolutionInput = {
  state: GameState
  planEntry: ScheduleEntry
  slot: ScheduleSlotId
  runtimeContext: RuntimeContext
}

type ActivityResolutionResult = {
  statePatch: StatePatch
  events: RuntimeEvent[]
  notes: string[]
  memoryDrops: MemoryFragment[]
}

function resolveActivity(input: ActivityResolutionInput): ActivityResolutionResult
```

重点：

- “上课”“做作业”“锻炼”“打工”都走同一执行入口
- 小游戏不是直接改总状态，而是返回 `ActivityResolutionResult`
- 以后接入小游戏时，只需要补一个 executor adapter

验证方式：

- 单测：同一活动在偏好时段与非偏好时段收益不同
- 单测：特殊规则仅在满足条件时触发
- 场景测试：一整天四个槽执行后，结算顺序稳定且可复现

### 5.4 事件与剧情模块 `domain/event` + `domain/story`

职责：

- 管理固定剧情、条件触发剧情、随机事件、人物支线
- 统一条件判断与奖励发放

建议把当前 `STORY_BEATS` 升级为通用触发器协议：

```ts
type TriggerCondition = {
  minDay?: number
  maxDay?: number
  activityId?: string
  slot?: ScheduleSlotId
  minSkill?: { key: string, value: number }
  maxStat?: { key: string, value: number }
  minRelationship?: { key: string, value: number }
  flagsAll?: string[]
  flagsNone?: string[]
  formula?: string
}

type StoryBeatDefinition = {
  id: string
  category: "main" | "branch" | "tutorial" | "random"
  once: boolean
  priority: number
  trigger: TriggerCondition
  effect?: EffectBundle
  grantsFlags?: string[]
  unlocksEntries?: string[]
  dialogueId?: string
}

function evaluateStoryTriggers(state: GameState, context: TriggerContext): StoryBeatDefinition[]
function applyStoryBeat(state: GameState, beat: StoryBeatDefinition): StoryApplyResult
```

扩展建议：

- 对话内容和剧情触发条件分离
- 支线人物、舍友、导师都走相同协议
- “失踪舍友”支线应作为独立 storyline 管理，不要散落在活动备注里

验证方式：

- 单测：同一天多剧情命中时按优先级取舍
- 单测：`once=true` 的剧情不会重复触发
- 场景测试：给定状态快照，能稳定触发指定支线

### 5.5 记忆与推理系统 `domain/memory`

这是本 demo 最核心的差异化模块，必须单独设计，不应再作为 `main.js` 中的若干函数存在。

职责：

- 管理短期记忆池
- 管理长期记忆盘面
- 管理记忆块衰减、过期、保留
- 处理基座、能力塔、增长塔、推理塔、衔接塔的建造和夜间结算

建议拆分：

- `memory-fragment-pool.js`
- `memory-board.js`
- `memory-building-rules.js`
- `memory-night-resolution.js`
- `memory-decay.js`

核心状态协议：

```ts
type MemoryFragment = {
  id: string
  sourceDay: number
  sourceEntryId: string
  skill: string
  shape: string
  tier: 1 | 2 | 3
  ttl: number
  tags: string[]
}

type MemoryNodeState = {
  id: string
  zone: string
  unlocked: boolean
  buildingId: string | null
}

type MemoryBuilding = {
  id: string
  type: "base" | "ability" | "growth" | "reasoning" | "bridge" | "hybrid"
  zoneAffinity?: string[]
  level: number
  builtDay: number
}

type MemoryState = {
  fragmentPool: MemoryFragment[]
  boardNodes: MemoryNodeState[]
  boardEdges: EdgeState[]
  buildings: Record<string, MemoryBuilding>
  nightlyActionsLeft: number
}
```

行为协议：

```ts
type BuildMemoryCommand = {
  pieceId: string
  target: { kind: "node" | "edge", id: string }
}

type MemoryResolutionResult = {
  statePatch: StatePatch
  generatedEffects: EffectBundle[]
  unlockedRules: string[]
  decayResults: DecayResult[]
}

function generateMemoryFragments(dayResult: DayResolutionResult): MemoryFragment[]
function validateMemoryBuild(state: MemoryState, command: BuildMemoryCommand): ValidationResult
function applyMemoryBuild(state: MemoryState, command: BuildMemoryCommand): MemoryState
function resolveNightMemory(state: GameState): MemoryResolutionResult
function decayMemoryFragments(state: MemoryState): MemoryState
```

重构重点：

1. 把“今天生成哪些记忆块”从硬编码条件升级成规则表。
2. 把“夜间建筑收益”从 if/else 升级成建筑效果协议。
3. 提前为策划案里的“增长塔”“推理塔”“混合塔”留协议，不要只围绕当前五种块命名。
4. 短期记忆池必须具备 `ttl` 和衰减逻辑，否则无法验证“遗忘”和“资源管理”。

验证方式：

- 单测：无效建造不会污染状态
- 单测：衔接塔只允许连接满足条件的节点
- 单测：过夜后未使用记忆块按规则衰减
- 场景测试：连续 7 天构筑后，区域联通与收益符合预期

### 5.6 评级与阶段总结模块 `domain/summary`

职责：

- 汇总一周表现
- 输出评级、主修方向、剧情里程碑、玩法统计

协议：

```ts
type RunSummary = {
  finalRank: string
  scoreBreakdown: Record<string, number>
  bestSkill: string
  unlockedStorylines: string[]
  memoryBoardStats: {
    bases: number
    towers: number
    bridges: number
    hybridUnlocks: number
  }
}

function buildRunSummary(state: GameState): RunSummary
```

验证方式：

- 单测：评分公式透明可追踪
- 场景测试：不同 build 路线能得到不同总结文本

## 6. 应用层设计

### 6.1 统一状态树

建议改为：

```ts
type GameState = {
  meta: {
    seed: number
    version: string
  }
  session: {
    mode: "menu" | "planning" | "resolving" | "memory" | "summary"
    day: number
    totalDays: number
    phaseStep: string
  }
  player: PlayerProfile
  schedule: ScheduleState
  story: StoryState
  memory: MemoryState
  progression: ProgressionState
  ui: UIState
  logs: RuntimeEvent[]
}
```

规则：

- `player / schedule / story / memory` 是领域状态
- `ui` 只能放界面态，如面板开关、当前 hover、选中项
- `mode` 和 `phaseStep` 只由应用层改变

### 6.2 命令驱动

所有状态修改统一经由命令派发：

```ts
type GameCommand =
  | { type: "run/start", archetypeId: string }
  | { type: "schedule/set-entry", slot: ScheduleSlotId, entryId: string }
  | { type: "schedule/apply-preset", presetId: string }
  | { type: "day/start" }
  | { type: "day/advance-step" }
  | { type: "memory/select-piece", pieceId: string }
  | { type: "memory/build", pieceId: string, target: BuildTarget }
  | { type: "night/finish" }
  | { type: "ui/toggle-panel", panel: string }
  | { type: "run/restart" }
```

统一分发器：

```ts
type DispatchResult = {
  state: GameState
  events: RuntimeEvent[]
  errors: ValidationError[]
}

function dispatch(state: GameState, command: GameCommand): DispatchResult
```

收益：

- 便于录制回放
- 便于写自动化测试
- 便于未来做存档、撤销、脚本驱动

### 6.3 事件日志

事件不是“顺手写日志”，而应作为调试与回归基础设施。

```ts
type RuntimeEvent = {
  id: string
  day: number
  phase: string
  type: string
  payload: Record<string, unknown>
}
```

最少需要记录：

- 日程设置
- 时段开始/结束
- 属性变更
- 剧情触发
- 记忆块生成
- 记忆建造
- 夜间结算
- 周总结

## 7. 内容层协议

### 7.1 活动配置

建议将当前 `ACTIVITIES` 细化为 `activity` 与 `course` 两类内容文件，但协议保持一致。

```ts
type ContentActivity = {
  id: string
  name: string
  category: "course" | "activity" | "assignment" | "practice"
  tone: string
  summary: string
  sceneId: string
  tags: string[]
  preferredSlots?: ScheduleSlotId[]
  rewards: RewardRuleRef[]
  memoryDrops: MemoryDropRuleRef[]
  storyHooks?: string[]
  presentation?: {
    leadTextId?: string
    segmentTextIds?: string[]
    resultTextId?: string
  }
}
```

### 7.2 随机事件配置

```ts
type RandomEventDefinition = {
  id: string
  weight: number
  trigger: TriggerCondition
  effectType: "replace-slot" | "inject-choice" | "instant-effect"
  payload: Record<string, unknown>
}
```

### 7.3 课程配置

策划案里的课程体系不应一开始全部做出来，但协议要预留：

```ts
type CourseDefinition = {
  id: string
  track: "数术" | "符法" | "道法" | "炼器" | "灵物" | "阵法"
  module: "基础理论" | "实践技能" | "交叉学科" | "通识"
  credits: number
  unlockCondition?: TriggerCondition
  scheduleRule: CourseScheduleRule
  assignmentPool?: string[]
}
```

### 7.4 人物与关系配置

将舍友、导师、辅导员、朋友统一为角色表：

```ts
type CharacterDefinition = {
  id: string
  role: "roommate" | "mentor" | "friend" | "teacher" | "counselor"
  tags: string[]
  relationAxis: string
  storylineIds: string[]
}
```

## 8. 表现层设计

### 8.1 表现层只做三件事

1. 读取 selector 输出
2. 渲染 UI
3. 把用户输入转成命令

禁止：

- 在渲染函数里直接 `state.xxx += 1`
- 在按钮回调里直接调用领域规则函数
- 在 Canvas 绘制代码里混入玩法结算

### 8.2 推荐拆分

```text
src/ui/
  bootstrap.js
  renderers/
    canvas-renderer.js
    stage-renderer.js
    panel-renderer.js
    memory-renderer.js
  panels/
    menu-panel.js
    planning-panel.js
    resolving-panel.js
    memory-panel.js
    summary-panel.js
  input/
    keyboard-controller.js
    pointer-controller.js
    drag-controller.js
```

### 8.3 Selector 协议

UI 不直接读完整状态树，而读 selector：

```ts
function selectPlanningView(state: GameState): PlanningViewModel
function selectResolvingView(state: GameState): ResolvingViewModel
function selectMemoryView(state: GameState): MemoryViewModel
function selectSummaryView(state: GameState): SummaryViewModel
```

好处：

- 渲染层更稳定
- 后续换 UI 布局时不需要改规则
- 自动化测试可直接断言 ViewModel

## 9. 调试与验证体系

### 9.1 必须保留并升级的调试能力

当前已有的两个方向是正确的，应保留并升级：

- 固定随机种子
- 状态文本导出

建议新增：

- `scenario runner`：按命令序列跑 1 天或 7 天
- `golden snapshot`：关键场景快照
- `balance report`：统计各活动/课程的平均收益

### 9.2 场景脚本协议

```ts
type ScenarioStep =
  | { type: "command", command: GameCommand }
  | { type: "advanceTime", ms: number }
  | { type: "assert", path: string, equals?: unknown, gte?: number, lte?: number }

type ScenarioDefinition = {
  id: string
  seed: number
  steps: ScenarioStep[]
}
```

推荐至少维护以下回归场景：

1. `week_core_loop`
   验证：菜单 -> 一周 -> 总结可完整跑通
2. `memory_growth_path`
   验证：连续学习路线可稳定生成高质量记忆构件
3. `social_branch_path`
   验证：城市探索/舍友/辅导员分支能正常触发
4. `low_self_control_failure`
   验证：低自控下随机事件和负反馈能正确生效
5. `mixed_build_unlock`
   验证：衔接塔达到条件后可解锁混合建筑

### 9.3 验证分层

#### A. 规则单测

覆盖：

- 属性结算
- 事件触发
- 记忆建造合法性
- 评分公式

#### B. 场景集成测试

覆盖：

- 一天流程
- 一周流程
- 指定 build 路线
- 极端状态回归

#### C. 界面烟雾测试

覆盖：

- 页面是否可加载
- 关键按钮是否可点击
- 拖拽记忆块是否生效
- 不出现 console error

## 10. 推荐开发步骤

### 阶段 0：冻结当前基线

目标：

- 保住当前可玩版本
- 为后续重构提供对照物

动作：

- 保留当前 `main.js` 为基线版本
- 记录现有 1 周流程的状态导出样例
- 固化 2 到 3 个 Playwright 冒烟场景

验收：

- 当前 demo 仍能跑通第 1 周
- 基线导出可用于对比重构后行为

### 阶段 1：抽离核心状态和命令分发

目标：

- 把状态变更从 `main.js` 的自由函数改成命令驱动

动作：

- 新建 `src/app/game-session.js`
- 引入 `dispatch(state, command)`
- 把 `startRun / setSlot / assignActivity / startDay / placeMemoryPiece / endNight` 迁移为命令处理器

验收：

- UI 通过命令而非直接函数操作状态
- 原有自动化钩子仍可导出状态

### 阶段 2：抽离白天玩法领域模块

目标：

- 拆出玩家、日程、活动结算三块领域逻辑

动作：

- 建立 `domain/player`
- 建立 `domain/schedule`
- 建立 `domain/activity`
- 让 `day/start` 和 `day/advance-step` 只编排，不直接写规则

验收：

- 一天 4 个时段可以在无 UI 环境下完成结算
- 活动收益回归与当前版本基本一致

### 阶段 3：抽离记忆系统

目标：

- 让夜间玩法成为独立子系统

动作：

- 建立 `domain/memory`
- 将“记忆块生成”“建造合法性”“夜间结算”拆开
- 引入短期记忆池与 `ttl`

验收：

- `memory` 子系统可单独测试
- 连续多日构筑后盘面稳定
- 不再通过 UI 组件内逻辑判断建造规则

### 阶段 4：统一剧情与角色系统

目标：

- 支持支线扩展，不把剧情散落在活动备注里

动作：

- 将 `STORY_BEATS` 升级为通用 trigger protocol
- 新增角色表和 storyline 表
- 将“失踪舍友”做成完整支线验证样本

验收：

- 可通过配置新增一条支线
- 剧情触发顺序和一次性限制可测试

### 阶段 5：补课程/作业/随机事件协议

目标：

- 把策划案中的课程体系和特殊事件接进来

动作：

- 加入课程模块
- 为作业小游戏保留 executor adapter
- 加入随机事件插槽覆盖机制

验收：

- 能插入至少 1 个随机事件类型
- 能区分“课程本体”和“课程作业”

### 阶段 6：补平衡与调试工具

目标：

- 让玩法验证进入可快速试错阶段

动作：

- 建 scenario runner
- 建 balance report
- 为关键玩法建立 golden snapshot

验收：

- 改一个活动数值后，可快速跑完核心场景回归
- 能输出不同 build 的收益差异

## 11. 具体验证清单

### 11.1 每个模块的最低验证标准

#### 玩家模块

- 属性上下限正确
- 资源不出现非法负值
- 派生值计算稳定

#### 日程模块

- 锁定课程不可被覆盖
- 空槽检测正确
- 随机事件插入不破坏日程结构

#### 活动模块

- 偏好时段收益正确
- 特殊规则不会重复触发
- 课程/活动/作业共用统一结算口

#### 记忆模块

- 生成规则可追踪
- 非法落点拒绝
- 夜间结算收益与盘面对应
- 未使用碎片会衰减或消失

#### 剧情模块

- 多剧情冲突时优先级正确
- 已触发剧情不重复
- 人物关系变化可追踪

#### 总结模块

- 评分透明
- 结局文本与主要 build 对应

### 11.2 每次重构后都要跑的冒烟清单

1. 启动游戏，进入主菜单
2. 选择开局原型并开始第一天
3. 排满 4 个时段并执行白天流程
4. 进入夜间记忆系统并完成至少一次放置
5. 完成第 7 天并进入总结
6. 全程无 runtime error
7. 状态导出结构未破坏

## 12. 与当前代码的迁移建议

### 12.1 保留不动的部分

- `desktop/` Electron 外壳
- `styles.css` 的已有视觉资产
- `index.html` 的基础容器结构
- `render_game_to_text` / `advanceTime` 的调试思路

### 12.2 优先迁移的部分

- `createState` -> `domain` + `app` 状态树
- `applyEffectBundle` / `normalizeState` -> `domain/player`
- `startDay` / `advanceResolvingFlow` -> `app/phase-machine`
- `applyActivity` -> `domain/activity`
- `buildMemoryPieces` / `placeMemoryPiece` / `endNight` -> `domain/memory`
- `storyBeatMatches` / `triggerStoryBeats` -> `domain/story`

### 12.3 暂时不要过度投入的部分

当前 demo 阶段不建议过早投入：

- 复杂存档系统
- 多端同步
- 过深的资源加载框架
- 组件化 UI 重做
- 大规模美术资产管线

理由很简单：当前主目标是玩法验证速度，而不是产品化工程完备度。

## 13. 最终建议

这次重构最关键的不是把 `main.js` 拆成很多文件，而是把下面三件事真正做实：

1. 用**命令驱动**代替随处改状态。
2. 用**领域模块**承接规则，而不是让 UI 和流程函数混着写。
3. 用**场景回归工具**保证每次新增玩法后还能稳定验证一周闭环。

如果按本文顺序推进，重构完成后这个 demo 会具备三种很重要的能力：

- 能快速加课程、事件、角色、记忆塔而不破坏主流程
- 能单独验证某个玩法系统而不是每次都手打一整周
- 能逐步从 demo 过渡到正式项目，而不用推倒重来
