import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { applyReverseView, applyEnterpriseFocus } from '../src/core/focus'
import { buildRenderModel } from '../src/core/graph'
import { createTestWorkspaceData } from '../src/core/testData'
import { buildGraphOption } from '../src/render2d/graphOption'
import { createLayeredLayout2D } from '../src/render2d/layout'
import { routeGraph2D } from '../src/render2d/OrthogonalRouter2D'
import { SAFE_EDGE_COLOR } from '../src/render2d/theme'
import { useWorkspaceStore } from '../src/stores/workspace'

const workspace = createTestWorkspaceData()
const model = buildRenderModel(workspace, ['RS1', 'RS2'])
const width = 790
const height = 844
const layout = createLayeredLayout2D(model.nodes, width, height)
const routes = routeGraph2D(model.edges, layout)
const option = buildGraphOption(model, layout)
const allSeries = option.series as Array<Record<string, unknown>>

assert.equal(model.nodes.length, 9)
for (const layerNodes of [
  ['E1', 'E2'],
  ['E3'],
  ['E4', 'E6'],
  ['E7'],
  ['E8'],
  ['E5', 'E9'],
]) {
  const xs = layerNodes.map((id) => layout.slots[id].x)
  assert.ok(xs.every((x) => Math.abs(x - xs[0]) < 0.01), '层的 X 应一致')
}

const axisAligned = (points: { x: number; y: number }[]) =>
  points.every(
    (point, index) =>
      index === 0 ||
      Math.abs(point.x - points[index - 1].x) < 0.01 ||
      Math.abs(point.y - points[index - 1].y) < 0.01,
  )

function nodeHits(points: { x: number; y: number }[]): number {
  let hits = 0
  for (let index = 0; index < points.length - 1; index += 1) {
    const a = points[index]
    const b = points[index + 1]
    const steps = Math.max(
      1,
      Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2),
    )
    for (let step = 1; step < steps; step += 1) {
      const t = step / steps
      const x = a.x + (b.x - a.x) * t
      const y = a.y + (b.y - a.y) * t
      for (const slot of Object.values(layout.slots)) {
        if (
          Math.abs(x - slot.x) < slot.width / 2 + 0.5 &&
          Math.abs(y - slot.y) < slot.height / 2 + 0.5
        ) {
          hits += 1
        }
      }
    }
  }
  return hits
}

function labelHits(points: { x: number; y: number }[]): number {
  let hits = 0
  for (let index = 0; index < points.length - 1; index += 1) {
    const a = points[index]
    const b = points[index + 1]
    const steps = Math.max(
      1,
      Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2),
    )
    for (let step = 1; step < steps; step += 1) {
      const t = step / steps
      const x = a.x + (b.x - a.x) * t
      const y = a.y + (b.y - a.y) * t
      for (const slot of Object.values(layout.slots)) {
        if (
          x > slot.labelLeft &&
          x < slot.labelRight &&
          y > slot.labelTop &&
          y < slot.labelBottom
        ) {
          hits += 1
        }
      }
    }
  }
  return hits
}

function attachedToNode(
  point: { x: number; y: number },
  slot: (typeof layout.slots)[string],
): boolean {
  const gap = 2
  const tolerance = 0.8
  const onVerticalSide =
    Math.abs(point.x - (slot.symbolLeft - gap)) < tolerance ||
    Math.abs(point.x - (slot.symbolRight + gap)) < tolerance
  const withinSymbolY =
    point.y >= slot.symbolTop - 0.2 &&
    point.y <= slot.symbolBottom + 0.2
  const withinLabelX =
    point.x >= slot.labelLeft - 0.2 &&
    point.x <= slot.labelRight + 0.2
  const withinSymbolX =
    point.x >= slot.symbolLeft - 0.2 &&
    point.x <= slot.symbolRight + 0.2
  return (
    (onVerticalSide && withinSymbolY) ||
    (Math.abs(point.y - (slot.symbolTop - gap)) < tolerance &&
      withinSymbolX) ||
    (Math.abs(point.y - (slot.labelBottom + gap)) < tolerance &&
      withinLabelX)
  )
}

let sameColorOverlap = 0
for (let i = 0; i < model.edges.length; i += 1) {
  const a = model.edges[i]
  const ap = routes.paths[a.id]
  assert.ok(ap && ap.length >= 2, `${a.id} missing orthogonal path`)
  assert.ok(axisAligned(ap), `${a.id} has a diagonal segment`)
  assert.equal(nodeHits(ap), 0, `${a.id} crosses a node`)
  assert.equal(labelHits(ap), 0, `${a.id} crosses a node label`)
  assert.ok(
    attachedToNode(ap[0], layout.slots[a.from]),
    `${a.id} start is not attached to ${a.from}`,
  )
  assert.ok(
    attachedToNode(ap[ap.length - 1], layout.slots[a.to]),
    `${a.id} end is not attached to ${a.to}`,
  )
  for (let j = i + 1; j < model.edges.length; j += 1) {
    const b = model.edges[j]
    if (a.category !== b.category) continue
    const bp = routes.paths[b.id]
    if (!bp) continue
    for (let x = 0; x < ap.length - 1; x += 1) {
      for (let y = 0; y < bp.length - 1; y += 1) {
        const ah = Math.abs(ap[x].y - ap[x + 1].y) < 0.01
        const bh = Math.abs(bp[y].y - bp[y + 1].y) < 0.01
        if (ah !== bh) continue
        if (ah && Math.abs(ap[x].y - bp[y].y) < 0.5) {
          const overlap =
            Math.min(
              Math.max(ap[x].x, ap[x + 1].x),
              Math.max(bp[y].x, bp[y + 1].x),
            ) -
            Math.max(
              Math.min(ap[x].x, ap[x + 1].x),
              Math.min(bp[y].x, bp[y + 1].x),
            )
          if (overlap > 1.5) sameColorOverlap += 1
        } else if (!ah && Math.abs(ap[x].x - bp[y].x) < 0.5) {
          const overlap =
            Math.min(
              Math.max(ap[x].y, ap[x + 1].y),
              Math.max(bp[y].y, bp[y + 1].y),
            ) -
            Math.max(
              Math.min(ap[x].y, ap[x + 1].y),
              Math.min(bp[y].y, bp[y + 1].y),
            )
          if (overlap > 1.5) sameColorOverlap += 1
        }
      }
    }
  }
}

assert.equal(sameColorOverlap, 0, '同色边不应共线重合')
assert.deepEqual(routes.sameColorConflicts, [])
assert.ok(routes.crossings.length > 0, '应有不同颜色交叉点')

const main = allSeries.find((item) => item.id === 'main-graph')
assert.ok(main)
assert.equal(main.type, 'graph')
assert.equal(main.coordinateSystem, 'cartesian2d')
assert.equal((main.data as unknown[]).length, 9)
assert.equal(main.links, undefined, 'graph series 不应再承载连线')
assert.equal((main.data as Array<{ x: number; y: number }>)[0].x, layout.positions.E1.x)

const lines = allSeries.find((item) => item.id === 'relations')
assert.ok(lines)
assert.equal(lines.type, 'lines')
assert.equal(lines.polyline, true)
assert.equal(lines.coordinateSystem, 'cartesian2d')
const lineData = lines.data as Array<{
  edgeId: string
  coords: [number, number][]
  lineStyle: { color: string; type: string | number[]; opacity: number }
}>
assert.equal(lineData.length, 11)
assert.ok(
  lineData.every((line) => line.coords.length >= 2),
  '每条边都应有多段折线',
)
assert.ok(
  lineData.every((line) =>
    line.coords.every(
      (point, index) =>
        index === 0 ||
        Math.abs(point[0] - line.coords[index - 1][0]) < 0.01 ||
        Math.abs(point[1] - line.coords[index - 1][1]) < 0.01,
    ),
  ),
  'lines coords 只能水平/垂直',
)

const byEdge = new Map(lineData.map((line) => [line.edgeId, line]))
assert.equal(byEdge.get('R01')?.lineStyle.color, '#FF8C42')
assert.equal(byEdge.get('R05')?.lineStyle.color, '#FFB74D')
assert.equal(byEdge.get('R08')?.lineStyle.color, '#E53935')
assert.equal(byEdge.get('R11')?.lineStyle.color, '#1ABC9C')
assert.ok((byEdge.get('R08')?.coords.length ?? 0) >= 4)
assert.ok(
  lineData.filter((line) => line.edgeId === 'R01' || line.edgeId === 'R05')
    .length === 2,
  'E1↔E4 两条边都存在',
)

const pulse = allSeries.find((item) => item.id === 'source-pulse')
assert.ok(pulse)
assert.equal(pulse.type, 'graph')
assert.equal(pulse.coordinateSystem, 'cartesian2d')

const focusModel = applyEnterpriseFocus(model, 'E4')
const focusOption = buildGraphOption(focusModel, layout)
const focusSeries = focusOption.series as Array<Record<string, unknown>>
const focusMain = focusSeries.find((item) => item.id === 'main-graph') as {
  data: Array<{ id: string; itemStyle: { opacity: number }; label: { opacity: number } }>
}
const focusNodeOpacity = new Map(
  focusMain.data.map((node) => [node.id, node.itemStyle.opacity]),
)
const focusLabelOpacity = new Map(
  focusMain.data.map((node) => [node.id, node.label.opacity]),
)
for (const id of ['E1', 'E2', 'E3', 'E4', 'E7']) {
  assert.equal(focusNodeOpacity.get(id), 1, `${id} should stay bright`)
  assert.equal(focusLabelOpacity.get(id), 1, `${id} label should stay bright`)
}
for (const id of ['E5', 'E6', 'E8', 'E9']) {
  assert.equal(focusNodeOpacity.get(id), 0.15, `${id} should dim`)
  assert.equal(focusLabelOpacity.get(id), 0.15, `${id} label should dim`)
}

const focusLines = focusSeries.find((item) => item.id === 'relations') as {
  data: Array<{ edgeId: string; lineStyle: { opacity: number } }>
}
const focusEdgeOpacity = new Map(
  focusLines.data.map((line) => [line.edgeId, line.lineStyle.opacity]),
)
for (const id of ['R01', 'R02', 'R03', 'R05', 'R06']) {
  assert.equal(focusEdgeOpacity.get(id), 1, `${id} should stay bright`)
}
for (const id of ['R04', 'R07', 'R08', 'R09', 'R10', 'R11']) {
  assert.equal(focusEdgeOpacity.get(id), 0.15, `${id} should dim`)
}

const controlRings = focusSeries.find((item) => item.id === 'control-rings') as {
  data: Array<{ id: string; itemStyle: { opacity: number } }>
}
const controlRingById = new Map(
  controlRings.data.map((node) => [node.id, node.itemStyle.opacity]),
)
assert.equal(controlRingById.get('control-rings-E8'), 0, 'dimmed node ring should be hidden')
assert.equal(controlRingById.get('control-rings-E5'), 0, 'dimmed node ring should be hidden')

const neutralModel = buildRenderModel(workspace, [])
const reverseOption = buildGraphOption(
  applyReverseView(neutralModel),
  layout,
)
const reverseLines = (
  reverseOption.series as Array<Record<string, unknown>>
).find((item) => item.id === 'relations') as {
  data: Array<{ lineStyle: { color: string; opacity: number } }>
}
assert.ok(reverseLines)
assert.ok(
  reverseLines.data.every((line) => line.lineStyle.color === SAFE_EDGE_COLOR),
  '反选视图安全关系应使用 #7F9DB9',
)
assert.ok(
  reverseLines.data.every((line) => line.lineStyle.opacity === 1),
  '全部企业无风险时，安全关系应实显',
)

setActivePinia(createPinia())
const store = useWorkspaceStore()
store.loadTestData()
assert.equal(store.summary.none, 1)
assert.deepEqual(
  store.renderModel.nodes
    .filter((node) => node.impact === 0)
    .map((node) => node.id),
  ['E9'],
)

store.setThresholdEnabled(true)
store.openEnterpriseDetail('E1')
store.setReverseView(true)
assert.equal(store.reverseView, true)
assert.equal(store.thresholdEnabled, false)
assert.equal(store.detailEnterpriseId, null)
assert.equal(store.renderModel.viewMode, 'reverse')
assert.deepEqual(
  store.renderModel.nodes
    .filter((node) => !node.dimmed)
    .map((node) => node.id),
  ['E9'],
)
assert.ok(store.renderModel.edges.every((edge) => edge.dimmed))

store.setRiskSourceEnabled('RS1', false)
store.setRiskSourceEnabled('RS2', false)
assert.equal(store.summary.none, 9)
assert.equal(
  store.renderModel.nodes.filter((node) => !node.dimmed).length,
  9,
)
assert.equal(
  store.renderModel.edges.filter((edge) => !edge.dimmed).length,
  model.edges.length,
)

store.toggleReverseView()
assert.equal(store.reverseView, false)
assert.equal(store.renderModel.viewMode, undefined)

store.setReverseView(true)
const extraWorkspace = store.createWorkspace('反选重置测试')
assert.equal(store.reverseView, false)
store.deleteWorkspace(extraWorkspace.id)

console.log(
  `✓ 分层布局：6 层固定 X，9 个节点全部可复现`,
)
console.log(
  `✓ 正交路由：11 条边全部水平/垂直，节点穿透 0，同色重合 0`,
)
console.log(
  `✓ 不同颜色交叉点：${routes.crossings.length} 个，使用断口点标注`,
)
console.log(
  '✓ 风险色：R01 中风险 / R05 低风险 / R08 高风险 / R11 常态色',
)
console.log('✓ 反选视图：安全关系统一 #7F9DB9，正常关系实显')
console.log('✓ 阈値、详情、工作区、重置状态不受影响')
console.log('✓ Step 2D-Beautify 验证通过')
