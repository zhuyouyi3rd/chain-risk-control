import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { useWorkspaceStore } from '../src/stores/workspace'

setActivePinia(createPinia())
const store = useWorkspaceStore()
store.loadTestData()

assert.deepEqual(
  {
    total: store.summary.total,
    riskSources: store.summary.riskSources,
    enabledRiskSources: store.summary.enabledRiskSources,
    sourceNodes: store.summary.sourceNodes,
    affected: store.summary.affected,
    high: store.summary.high,
    medium: store.summary.medium,
    low: store.summary.low,
    none: store.summary.none,
  },
  {
    total: 9,
    riskSources: 3,
    enabledRiskSources: 2,
    sourceNodes: 2,
    affected: 8,
    high: 2,
    medium: 3,
    low: 1,
    none: 1,
  },
  '汇总指标应与 RS1+RS2 推演结果一致',
)

assert.equal(store.filteredEnterpriseRows.length, 9)
assert.equal(store.riskEnterpriseRows.length, 8)
assert.equal(store.safeEnterpriseRows.length, 1)

store.setAffectedFilter('affected')
assert.equal(store.filteredEnterpriseRows.length, 8)
store.setAffectedFilter('unaffected')
assert.deepEqual(
  store.filteredEnterpriseRows.map((row) => row.enterprise.id),
  ['E9'],
)
store.setAffectedFilter('all')

store.setLevelFilter('high')
assert.deepEqual(
  store.filteredEnterpriseRows.map((row) => row.enterprise.id).sort(),
  ['E2', 'E5'],
)
store.setLevelFilter('all')

store.setEnterpriseQuery('恒信')
assert.deepEqual(
  store.filteredEnterpriseRows.map((row) => row.enterprise.id),
  ['E6'],
)
store.setEnterpriseQuery('高风险')
assert.deepEqual(
  store.filteredEnterpriseRows.map((row) => row.enterprise.id).sort(),
  ['E2', 'E5'],
)
store.setEnterpriseQuery('风险源')
assert.deepEqual(
  store.filteredEnterpriseRows.map((row) => row.enterprise.id).sort(),
  ['E1', 'E6'],
)
store.setEnterpriseQuery('无风险')
assert.deepEqual(
  store.filteredEnterpriseRows.map((row) => row.enterprise.id),
  ['E9'],
)
store.resetEnterpriseFilters()
assert.equal(store.filteredEnterpriseRows.length, 9)

store.toggleEnterpriseFocus('E1')
assert.equal(store.selectedEnterpriseId, 'E1')
const focusedNode = store.renderModel.nodes.find((node) => node.id === 'E1')
assert.equal(focusedNode?.highlighted, true)
assert.equal(focusedNode?.dimmed, false)
assert.equal(
  store.renderModel.nodes.filter((node) => node.highlighted).length,
  1,
)
assert.equal(
  store.renderModel.nodes.find((node) => node.id === 'E2')?.dimmed,
  false,
  'E1 的直接邻居 E2 应保持高亮',
)
assert.equal(
  store.renderModel.nodes.find((node) => node.id === 'E4')?.dimmed,
  false,
  'E1 的直接邻居 E4 应保持高亮',
)
assert.equal(
  store.renderModel.nodes.find((node) => node.id === 'E3')?.dimmed,
  true,
  '非直接邻居 E3 应虚化',
)

const focusedEdges = store.renderModel.edges.filter((edge) => edge.highlighted)
assert.deepEqual(
  focusedEdges.map((edge) => edge.id).sort(),
  ['R01', 'R05', 'R09'],
  '聚焦 E1 时应高亮 E1 的三条关联边',
)
assert.equal(
  store.renderModel.edges.find((edge) => edge.id === 'R02')?.dimmed,
  true,
)

store.toggleEnterpriseFocus('E1')
assert.equal(store.selectedEnterpriseId, null)
assert.ok(store.renderModel.nodes.every((node) => !node.dimmed && !node.highlighted))
assert.ok(store.renderModel.edges.every((edge) => !edge.dimmed && !edge.highlighted))

store.toggleEnterpriseFocus('E1')
store.deleteEnterprise('E1')

assert.equal(store.data.enterprises.length, 8)
assert.equal(store.data.enterprises.some((enterprise) => enterprise.id === 'E1'), false)
assert.deepEqual(
  store.data.relations.map((relation) => relation.id),
  ['R02', 'R03', 'R04', 'R06', 'R07', 'R08', 'R10', 'R11'],
  '删除 E1 应同步删除关联关系 R01 / R05 / R09',
)
assert.deepEqual(
  store.data.riskSources.map((riskSource) => riskSource.id),
  ['RS2', 'RS3'],
  '删除 E1 应同步删除以 E1 为 target 的 RS1',
)
assert.equal(store.selectedEnterpriseId, null, '删除聚焦企业后应清除聚焦')
assert.equal(store.renderModel.nodes.length, 8)
assert.equal(store.renderModel.nodes.some((node) => node.id === 'E1'), false)
assert.equal(
  store.renderModel.nodes.filter((node) => node.level === 'source').length,
  1,
  '删除后只剩 RS2 的 E6 为风险源',
)
assert.ok(
  store.renderModel.nodes.every((node) => !node.dimmed && !node.highlighted),
)

console.log('✓ 汇总指标：风险源 3 / 启用 2 / 源节点 2 / 受影响 8 / 高 2 / 中 3 / 低 1 / 无 1')
console.log('✓ 受影响、等级筛选和名称/等级搜索均通过')
console.log('✓ 点击 E1 聚焦：E1/E2/E4 与 R01/R05/R09 高亮，其余 dimmed')
console.log('✓ 取消聚焦后 RenderModel 恢复全部非虚化')
console.log('✓ 删除 E1：企业、3 条关联关系、RS1 同时删除，聚焦状态清空')
console.log('✓ Pinia store 驱动 RenderModel 的 Step 5 联动验证通过')
