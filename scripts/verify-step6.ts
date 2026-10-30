import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { buildPropagation } from '../src/core/graph'
import { createTestWorkspaceData } from '../src/core/testData'
import { useWorkspaceStore } from '../src/stores/workspace'

const propagation = buildPropagation(createTestWorkspaceData(), [
  'RS1',
  'RS2',
])
const pathsToE8 = propagation.pathsByEnterprise.get('E8') ?? []

assert.equal(pathsToE8.length, 2, 'E8 应同时有 RS1 与 RS2 两条路径')
const rs2Path = pathsToE8.find((path) => path.riskSourceId === 'RS2')
const rs1Path = pathsToE8.find((path) => path.riskSourceId === 'RS1')
assert.ok(rs2Path)
assert.ok(rs1Path)

assert.deepEqual(
  rs2Path.hops.map((hop) => [
    hop.edgeId,
    hop.from,
    hop.to,
    hop.association,
    hop.toImpact,
    hop.reverse,
  ]),
  [
    ['R08', 'E6', 'E5', 0.75, 0.75, true],
    ['R07', 'E5', 'E7', 0.5, 0.375, false],
    ['R10', 'E7', 'E8', 0.45, 0.16875, false],
  ],
  'RS2 到 E8 应经过担保反向边、技术流和资金流',
)
assert.equal(rs2Path.impact, 0.16875)
assert.equal(rs2Path.hops[0].category, 'guarantee')
assert.equal(rs2Path.hops[1].category, 'tech')
assert.equal(rs2Path.hops[2].category, 'capital')

assert.equal(rs1Path.hops.length, 4, 'RS1 到 E8 应经过四跳')
assert.equal(rs1Path.hops.at(-1)?.to, 'E8')
assert.equal(rs1Path.impact, 0.1053)
assert.equal(
  propagation.pathsByEnterprise.get('E9'),
  undefined,
  'E9 不应有传导路径',
)

const e4Paths = propagation.pathsByEnterprise.get('E4') ?? []
assert.equal(e4Paths.length, 2, 'E4 应记录来自 RS1/RS2 的两条证据路径')

setActivePinia(createPinia())
const store = useWorkspaceStore()
const firstWorkspaceId = store.activeWorkspaceId
store.loadTestData()

const nodeById = (id: string) =>
  store.renderModel.nodes.find((node) => node.id === id)

store.setThresholdEnabled(true)
store.setThresholdValue(0.5)
store.setThresholdOperator('gt')
store.setThresholdScope('all')
assert.equal(nodeById('E4')?.dimmed, false)
assert.equal(nodeById('E3')?.dimmed, true)
assert.equal(nodeById('E9')?.dimmed, true)
assert.equal(
  store.renderModel.edges.find((edge) => edge.id === 'R03')?.dimmed,
  true,
  'R03 的目标 E3 不通过阈值，应虚化',
)
assert.equal(
  store.renderModel.edges.find((edge) => edge.id === 'R11')?.dimmed,
  true,
)

store.setThresholdOperator('lt')
assert.equal(nodeById('E3')?.dimmed, false)
assert.equal(nodeById('E4')?.dimmed, true)
assert.equal(nodeById('E9')?.dimmed, false)
assert.equal(
  store.renderModel.edges.find((edge) => edge.id === 'R11')?.dimmed,
  false,
  'E9→E3 两端均通过 < 0.5，应保持实显',
)

store.setThresholdScope('affected')
assert.equal(nodeById('E9')?.dimmed, true, '仅受影响范围应虚化无风险 E9')
store.setThresholdEnabled(false)
assert.ok(
  store.renderModel.nodes.every((node) => !node.dimmed),
  '关闭阈值后所有节点恢复',
)

store.openEnterpriseDetail('E8')
assert.equal(store.detailEnterpriseId, 'E8')
assert.equal(store.selectedEnterpriseId, 'E8')
assert.equal(store.detailRow?.enterprise.id, 'E8')
assert.equal(store.detailPaths.length, 2)
assert.equal(store.detailPaths[0].riskSourceId, 'RS2')
store.closeEnterpriseDetail()
assert.equal(store.detailEnterpriseId, null)
assert.equal(store.selectedEnterpriseId, null)

const secondWorkspace = store.createWorkspace('备用工作区')
assert.equal(store.workspaceCount, 2)
assert.equal(store.activeWorkspaceId, secondWorkspace.id)
assert.equal(store.isLoaded, false, '新工作区应为空且独立')
store.loadTestData()
assert.equal(store.data.enterprises.length, 9)

store.switchWorkspace(firstWorkspaceId)
assert.equal(store.data.enterprises.length, 9)
assert.equal(store.activeWorkspaceName, '默认工作区')
store.renameWorkspace(firstWorkspaceId, '主工作区')
assert.equal(store.activeWorkspaceName, '主工作区')

store.switchWorkspace(secondWorkspace.id)
store.resetActiveWorkspace()
assert.equal(store.data.enterprises.length, 0)
assert.equal(store.workspaceCount, 2, '清空数据不应删除工作区')
store.switchWorkspace(firstWorkspaceId)
assert.equal(store.data.enterprises.length, 9, '其他工作区数据不受影响')

store.deleteWorkspace(secondWorkspace.id)
assert.equal(store.workspaceCount, 1)
assert.equal(store.deleteWorkspace(firstWorkspaceId), false, '至少保留一个工作区')
store.resetActiveWorkspace()
assert.equal(store.data.enterprises.length, 0)
assert.equal(store.activeWorkspaceName, '主工作区')

console.log('✓ E8 两条路径均正确记录：RS2 三跳 0.16875 / RS1 四跳 0.1053')
console.log('✓ 路径记录包含 edgeId、起终点、association、累计 impact、互保反向标记')
console.log('✓ 阈值 > / <、全部/仅受影响均只修改 dimmed，不删除实体')
console.log('✓ 节点详情 Store 状态与路径数量正确')
console.log('✓ 新建/切换/重命名/删除工作区相互独立，重置不影响其他工作区')
console.log('✓ Step 6 核心交互状态验证通过')
