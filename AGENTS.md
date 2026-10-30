# 产业链风控系统 — 项目约束

## 技术栈
Vue 3 + TypeScript + Vite + Pinia。2D渲染用 ECharts Graph。
所有图数据、推演逻辑与渲染解耦，放在 `src/core/` 下，纯函数，不 import 任何渲染库。

## 数据契约
渲染层只消费 RenderModel：
{
  nodes: { id, name, type, impact, level, controllerGroup?, dimmed, highlighted }[]
  edges: { id, from, to, category, association, active, riskLevel, dimmed, highlighted }[]
  groups: { controllerId, members }[]
}

## 视觉硬约束
- 建模区背景始终 #000000。
- 企业节点填充色始终 #82C9E0，风险只用描边/光晕/标签表达，不改变填充。
- 关系线常态颜色：material #4A90D9 实线 / capital #9B59B6 虚线 / tech #1ABC9C 点划线 / guarantee #2E7D32 粗实线。
- 关系线常态禁用红色。仅当边处于风险传导路径时，才按传导等级变色：低 #FFB74D / 中 #FF8C42 / 高 #E53935。
- 同控关系不画连线，用节点外环色环表达。
- 风险源节点：深红 #B71C1C 双环 + 脉冲。

## 风险规则（2D阶段简化版）
风险源 impact = 1.0。
传播：impact(v) = max over 入边 [impact(u) × association]。
等级分档：无=0，低(0,0.35]，中(0.35,0.65]，高(0.65,1.0]。
关联值在2D阶段直接作为 relation 字段录入，不做实时计算。

## 禁止
- 禁止在 2D 阶段引入 Three.js 或任何 3D 依赖。
- 禁止用 ECharts 的 categories 表达同控，同控走独立色环通道。
- 禁止自动力导向抖动；布局必须固定、可复现。
