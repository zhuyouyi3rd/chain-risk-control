import assert from 'node:assert/strict'
import { buildPropagation } from '../src/core/graph'
import { createTestWorkspaceData } from '../src/core/testData'

const data = createTestWorkspaceData()
const propagation = buildPropagation(data, ['RS1', 'RS2'])
const rs1 = propagation.reachabilityByRiskSource.get('RS1')
const rs2 = propagation.reachabilityByRiskSource.get('RS2')
assert.ok(rs1)
assert.ok(rs2)

const sorted = (values: Set<string>) => [...values].sort()
console.log('RS1 nodes', sorted(rs1.reachableNodes))
console.log('RS1 edges', sorted(rs1.reachableEdges))
console.log('RS2 nodes', sorted(rs2.reachableNodes))
console.log('RS2 edges', sorted(rs2.reachableEdges))

assert.deepEqual(sorted(rs1.reachableNodes), [
  'E1',
  'E2',
  'E3',
  'E4',
  'E7',
  'E8',
])
assert.deepEqual(sorted(rs1.reachableEdges), [
  'R01',
  'R02',
  'R03',
  'R04',
  'R07',
  'R09',
  'R10',
])
assert.ok(rs2.reachableEdges.has('R08'))
assert.ok(rs2.reachableEdges.has('R07'))
assert.ok(rs2.reachableEdges.has('R10'))
assert.ok(!rs1.reachableEdges.has('R05'))
assert.ok(!rs1.reachableEdges.has('R06'))
assert.ok(!rs1.reachableEdges.has('R08'))
assert.ok(!rs1.reachableEdges.has('R11'))
console.log('✓ Step 10B 风险源可达集合验证通过')
