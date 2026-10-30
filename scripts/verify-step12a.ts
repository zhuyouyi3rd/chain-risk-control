import assert from 'node:assert/strict'
import { createTestWorkspaceData } from '../src/core/testData'
import {
  BASE_HEIGHT,
  CAPITAL_PIPE_RADIUS,
  ELEVATED_Y,
  GRID_CELL_SIZE,
  GUARANTEE_LINE_RADIUS,
  LAYER_GAP_X,
  MODEL_TARGET_SIZE,
  NODE_GAP_Z,
  PIPELINE_THICKNESS,
  PIPELINE_WIDTH,
  ROUTER_CELL_SIZE,
  ROUTER_LANE_STEP,
  SCENE_SCALE,
  TECH_LINE_RADIUS,
} from '../src/render3d/constants'
import {
  computeLayeredLayout,
  computeLayoutBounds,
} from '../src/render3d/LayoutEngine'

const approx = (actual: number, expected: number) => {
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `${actual} !== ${expected}`,
  )
}
approx(SCENE_SCALE, 3.5)
approx(LAYER_GAP_X, 14)
approx(NODE_GAP_Z, 10.5)
approx(BASE_HEIGHT, 0.28)
approx(PIPELINE_WIDTH, 0.875)
approx(PIPELINE_THICKNESS, 0.21)
approx(CAPITAL_PIPE_RADIUS, 0.28)
approx(TECH_LINE_RADIUS, 0.14)
approx(GUARANTEE_LINE_RADIUS, 0.245)
approx(ELEVATED_Y, 0.875)
approx(GRID_CELL_SIZE, 3.5)
approx(ROUTER_CELL_SIZE, 1.75)
approx(ROUTER_LANE_STEP, 5.25)

const data = createTestWorkspaceData()
const placements = computeLayeredLayout(data.enterprises)
const bounds = computeLayoutBounds(placements)

const expected: Record<string, [number, number]> = {
  E1: [0, -5.25],
  E2: [0, 5.25],
  E3: [14, 0],
  E4: [28, -5.25],
  E6: [28, 5.25],
  E7: [42, 0],
  E8: [56, 0],
  E5: [70, -5.25],
  E9: [70, 5.25],
}
for (const [id, [x, z]] of Object.entries(expected)) {
  const placement = placements.get(id)
  assert.ok(placement, `${id} missing`)
  assert.equal(placement.x, x)
  assert.equal(placement.z, z)
}
assert.equal(bounds.width, 70)
assert.equal(bounds.depth, 10.5)
assert.equal(bounds.centerX, 35)
assert.equal(bounds.centerZ, 0)

const minimumClearance = MODEL_TARGET_SIZE * 1.1
const requiredGap = 1.5 * SCENE_SCALE
assert.ok(LAYER_GAP_X - minimumClearance >= requiredGap)
assert.ok(NODE_GAP_Z - minimumClearance >= requiredGap)

console.log(
  JSON.stringify(
    {
      scale: SCENE_SCALE,
      layerGapX: LAYER_GAP_X,
      nodeGapZ: NODE_GAP_Z,
      modelTarget: MODEL_TARGET_SIZE,
      baseHeight: BASE_HEIGHT,
      gridCell: GRID_CELL_SIZE,
      routerCell: ROUTER_CELL_SIZE,
      laneStep: ROUTER_LANE_STEP,
      pipelineWidth: PIPELINE_WIDTH,
      pipelineThickness: PIPELINE_THICKNESS,
      capitalPipeRadius: CAPITAL_PIPE_RADIUS,
      techLineRadius: TECH_LINE_RADIUS,
      guaranteeLineRadius: GUARANTEE_LINE_RADIUS,
      elevatedY: ELEVATED_Y,
      clearanceX: LAYER_GAP_X - minimumClearance,
      clearanceZ: NODE_GAP_Z - minimumClearance,
    },
    null,
    2,
  ),
)
console.log('✓ Step 12A 全局缩放常量、坐标与净距验证通过')
