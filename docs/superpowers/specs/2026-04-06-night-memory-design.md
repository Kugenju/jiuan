# Night Memory Mode Design

**Date:** 2026-04-06

## Goal
把夜晚阶段做成“夜色书院”风格：整体明显进入深夜场景，但左侧主舞台保留一块更明亮的灯下区域，形成从白天到夜修的自然过渡；长期记忆区不再像独立科幻小游戏，而是像书院灯下推演识海与记忆盘面的空间。

## Visual Thesis
白天是暖纸与庭院，夜晚则转入墨青、木褐、旧金与微弱青辉。不是纯黑，也不是霓虹科幻，而是“夜深、灯未灭、案前仍在推演”的感觉。

## Scope
本轮只改视觉表现，不改夜晚玩法逻辑。

### In scope
- 夜晚模式下全局背景与主布局明暗关系
- `memory-stage` 的整体氛围、长期记忆盘面、碎片区与右侧面板风格统一
- 左侧主区域保留更亮的“灯下区域”过渡
- 夜晚专属边框、阴影、微光、层次调整

### Out of scope
- 长期记忆玩法规则改动
- 新增夜晚动画系统
- 重做白天界面结构

## Chosen Direction
采用 `A · 夜色书院`。

### Why this direction
- 与当前白天古典风格延续性最好
- 能满足“更接近深夜场景，但主 canvas 区域更明亮一些有过渡”的要求
- 能把长期记忆区从“另一套小游戏视觉”拉回同一个世界观

## Experience Targets

### 1. Global night shift
进入夜晚后，外层背景、右侧面板、信息卡片整体压暗，形成明显夜色切换。

### 2. Lamp-lit main stage
左侧主区域保留更亮的局部照明感，像书院夜修时案前灯光照亮盘面，周围环境已入夜。

### 3. Unified memory chamber
长期记忆区改成夜修盘面：保留当前结构，但去掉偏蓝紫科幻的独立小游戏气质，转为墨青夜色、金线、纸木材质、轻微灵光。

## Component Design

### Body and shell
- `body.memory-mode` 进入深夜底色
- 页面四周加重夜色包裹感
- 保留少量暖色雾光，避免画面死黑

### Left stage / main canvas transition
- 夜晚时左侧主区域比周边亮一档
- 亮区集中在主舞台中部或下半部，模拟灯下阅读 / 推演区域
- 亮区之外逐渐过渡到深夜色，不做硬切

### Memory stage
- 背景从当前蓝紫高科技渐变改为墨青夜色 + 木色 + 灯下雾光
- 六边形盘面保留“可操作、可读”的清晰度，但边框与节点光效更克制、更古典
- 用旧金、青金、暖纸色替代目前偏冷的科技高光主导

### Main panel in night mode
- 右侧面板和碎片区同步进入夜间风格
- 卡片像灯下案牍，不像另一层白天面板
- 主要按钮仍保持清晰可见，但亮度低于白天

## Color Direction
- Base night: 墨青黑、深灰蓝、旧木褐
- Accent warm: 旧金、灯烛暖黄
- Accent cool: 低饱和青色灵光
- Text: 暖灰白，不用纯白

## Readability Rules
- 文字对比度必须高于当前 memory 模式
- 节点、边线、可放置区域的交互状态要比装饰优先
- 夜间视觉增强不能影响格子与节点的辨识

## Testing Plan
- 补充/更新 CSS 测试，锁定夜间古典深夜 token 和关键样式块
- 保留现有 memory 相关结构测试
- 最后跑 `npm test`

## Files likely to change
- `styles.css`
- 如果需要少量辅助 class 或 body 状态接线，可能改 `main.js`
- 对应测试文件：`tests/classical-css-theme.test.cjs`
