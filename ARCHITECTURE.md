# 项目架构说明

## 1. 运行时依赖顺序

`index.html` 采用串行 `<script>` 注入数据，最后加载 `main.js`：

1. `data/core.js`
2. `data/archetypes.js`
3. `data/activities.js`
4. `data/schedules.js`
5. `data/story.js`
6. `data/copy.js`
7. `data/ui.js`
8. `main.js`（`type="module"`）

前 1-7 步统一向 `window.GAME_DATA` 挂载数据；`main.js` 只消费数据并负责流程、状态与渲染。

## 2. 数据所有权

| 文件 | 负责内容 | 不应放入 |
| --- | --- | --- |
| `data/core.js` | 常量词典：时段名、技能名、资源名、灵块定义、记忆分区元数据 | 剧情文本、流程逻辑 |
| `data/archetypes.js` | 开局原型与初始加成 | UI 文案、流程逻辑 |
| `data/activities.js` | 白天活动定义（名称、摘要、数值变化、占位剧情片段） | 渲染逻辑 |
| `data/schedules.js` | 默认排程与预设按钮数据 | 具体执行流程 |
| `data/story.js` | 日状态、剧情触发、评级阈值 | UI 文案 |
| `data/copy.js` | 叙事/日志/结算文案模板（含动态函数） | DOM 结构、渲染逻辑 |
| `data/ui.js` | 面板标题、按钮文本、提示语、Canvas 标题、ARIA 文案 | 游戏数值逻辑 |
| `main.js` | 状态机、规则校验、事件响应、渲染编排 | 大段中文文案 |

## 3. 文案边界约定

- 叙事性文本（剧情卡片、日志、结算描述）放 `COPY`。
- 界面性文本（按钮、面板标题、提示、可访问性标签）放 `UI_TEXT`。
- `main.js` 不直接写中文文案，统一通过 `COPY` / `UI_TEXT` 调用。

## 4. 编码与换行约定

- 全仓库文本文件统一 `UTF-8 + LF`。
- 约束来源：
  - `.editorconfig`
  - `.gitattributes`（`working-tree-encoding=UTF-8`）
  - `scripts/encoding-guard.cjs`
- 提交前执行：
  - `npm run encoding:check`
  - 如需自动修复：`npm run encoding:fix`

## 5. 变更建议流程

1. 先改 `data/*.js`（新增内容与文案）。
2. 再改 `main.js`（只接线，不内嵌文案）。
3. 最后运行：
   - `node --check main.js`
   - `npm run encoding:check`
   - `node tmp/run-serve-check.cjs`
