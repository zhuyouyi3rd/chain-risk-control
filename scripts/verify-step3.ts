import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { buildRenderModel } from '../src/core/graph'
import { createTestWorkspaceData } from '../src/core/testData'
import type { RiskLevel } from '../src/core/types'
import { useWorkspaceStore } from '../src/stores/workspace'

const EPSILON = 1e-9

const workspace = createTestWorkspaceData()
const activeRiskSourceIds = ['RS1', 'RS2']
const model = buildRenderModel(workspace, activeRiskSourceIds)

const expectedImpacts: Record<string, number> = {
  E1: 1,
  E2: 0.7,
  E4: 0.6,
  E3: 0.39,
  E7: 0.375,
  E6: 1,
  E5: 0.75,
  E9: 0,
  // E7(0.375) × R10(0.45) = 0.16875，第三跳仍按公式继续传播。
  E8: 0.16875,
}

const expectedLevels: Record<string, RiskLevel> = {
  E1: 'source',
  E2: 'high',
  E4: 'medium',
  E3: 'medium',
  E7: 'medium',
  E6: 'source',
  E5: 'high',
  E8: 'low',
  E9: 'none',
}

function close(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) <= EPSILON
}

console.log('='.repeat(78))
console.log('Step 3 · 图模型与推演引擎验证')
console.log('数据集：', '内置测试数据集 · 9 企业 / 11 关系 / 3 风险源')
console.log('开启风险源：', activeRiskSourceIds.join(', '), '（RS3 关闭）')
console.log('='.repeat(78))

console.table(
  model.nodes.map((node) => ({
    id: node.id,
    name: node.name,
    impact: node.impact,
    level: node.level,
    group: node.controllerGroup ?? '',
  })),
)

console.table(
  model.edges.map((edge) => ({
    id: edge.id,
    path: `${edge.from} -> ${edge.to}`,
    category: edge.category,
    association: edge.association,
    active: edge.active,
    riskLevel: edge.riskLevel,
  })),
)

for (const node of model.nodes) {
  const expectedImpact = expectedImpacts[node.id]
  assert.notEqual(
    expectedImpact,
    undefined,
    `Missing expected impact for ${node.id}`,
  )
  assert.ok(
    close(node.impact, expectedImpact),
    `${node.id} impact: expected ${expectedImpact}, got ${node.impact}`,
  )
  assert.equal(
    node.level,
    expectedLevels[node.id],
    `${node.id} level: expected ${expectedLevels[node.id]}, got ${node.level}`,
  )
}

assert.deepEqual(
  model.groups.map((group) => ({
    controllerId: group.controllerId,
    controllerName: group.controllerName,
    members: [...group.members],
  })),
  [
    {
      controllerId: 'C1',
      controllerName: '张某',
      members: ['E5', 'E6', 'E8'],
    },
  ],
  '同控分组应来自 C1，且不产生额外的传播边',
)

const edgeById = new Map(model.edges.map((edge) => [edge.id, edge]))
assert.equal(edgeById.get('R11')?.active, false, 'R11 应不可达')
assert.equal(edgeById.get('R11')?.riskLevel, 'none', 'R11 不得变色')
assert.equal(edgeById.get('R08')?.active, true, '互保边应激活')
assert.equal(edgeById.get('R08')?.riskLevel, 'high', '互保反向传播应到高风险')
assert.equal(edgeById.get('R01')?.active, true, 'E1 -> E4 应激活')
assert.equal(edgeById.get('R01')?.riskLevel, 'medium', 'E1 -> E4 传递 0.60')
assert.equal(edgeById.get('R10')?.active, true, 'R10 应激活：E7 -> E8')
assert.equal(edgeById.get('R10')?.riskLevel, 'low', 'R10 传递 0.16875')

const noActiveSources = buildRenderModel(workspace, [])
assert.ok(
  noActiveSources.nodes.every(
    (node) => node.impact === 0 && node.level === 'none',
  ),
  '关闭全部风险源后，所有企业 impact 应为 0',
)
assert.ok(
  noActiveSources.edges.every(
    (edge) => !edge.active && edge.riskLevel === 'none',
  ),
  '关闭全部风险源后，所有边应不可达',
)

const onlyRs1 = buildRenderModel(workspace, ['RS1'])
const onlyRs1Nodes = new Map(
  onlyRs1.nodes.map((node) => [node.id, node]),
)
assert.equal(onlyRs1Nodes.get('E5')?.impact, 0, '同控不应把 E1 风险传给 E5')
assert.equal(onlyRs1Nodes.get('E6')?.impact, 0, '同控不应把 E1 风险传给 E6')

const onlyRs3 = buildRenderModel(workspace, ['RS3'])
const onlyRs3Nodes = new Map(
  onlyRs3.nodes.map((node) => [node.id, node]),
)
assert.equal(onlyRs3Nodes.get('E5')?.impact, 1, '风险源 impact 固定为 1.0')
assert.equal(onlyRs3Nodes.get('E6')?.impact, 1, '风险源 impact 固定为 1.0')
assert.equal(onlyRs3Nodes.get('E5')?.level, 'source')
assert.equal(onlyRs3Nodes.get('E6')?.level, 'source')

setActivePinia(createPinia())
const store = useWorkspaceStore()
store.loadTestData()
assert.deepEqual(
  store.activeRiskSourceIds,
  activeRiskSourceIds,
  'Pinia store 应只把 enabled 的风险源传给推演引擎',
)
assert.deepEqual(
  store.renderModel.nodes.map((node) => [node.id, node.impact, node.level]),
  model.nodes.map((node) => [node.id, node.impact, node.level]),
  'Pinia store 的 renderModel 应与纯函数输出一致',
)
assert.deepEqual(
  store.renderModel.edges.map((edge) => [
    edge.id,
    edge.active,
    edge.riskLevel,
  ]),
  model.edges.map((edge) => [edge.id, edge.active, edge.riskLevel]),
  'Pinia store 的 edges 应与纯函数输出一致',
)
console.log('✓ Pinia store -> buildRenderModel 接入验证通过')
console.log('✓ 全部风险源关闭时，所有 impact 为 0、所有边 inactive')
console.log('✓ 同控组不参与逐边传播（C1 未被 RS1 直接激活）')
console.log('✓ 风险源 impact 固定为 1.0（RS3 的 score=0.6 不参与计算）')
console.log('-'.repeat(78))
console.log('✓ 9 个节点 impact/level 全部按公式通过断言')
console.log('✓ E8 = 0.16875：E7(0.375) × R10(0.45)')
console.log('✓ R10 active/low，E8 low')
console.log('='.repeat(78))
