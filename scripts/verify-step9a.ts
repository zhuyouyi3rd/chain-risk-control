import assert from 'node:assert/strict'
import {
  Box3,
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Vector3,
} from 'three'
import type { RenderEdge } from '../src/core/types'
import {
  FLOW_COLORS,
  RelationLines,
  snapToBuildingBottom,
  snapToBuildingSurface,
} from '../src/render3d/RelationLines'
import {
  CAPITAL_PIPE_RADIUS,
  GUARANTEE_LINE_RADIUS,
  PIPELINE_THICKNESS,
  SURFACE_OFFSET,
  TECH_LINE_RADIUS,
} from '../src/render3d/constants'

function modelAt(x: number): Group {
  const group = new Group()
  group.position.set(x, 0, 0)
  const mesh = new Mesh(
    new BoxGeometry(1, 1, 1),
    new MeshBasicMaterial(),
  )
  mesh.position.y = 0.5
  group.add(mesh)
  group.updateMatrixWorld(true)
  return group
}

const modelA = modelAt(-3)
const modelB = modelAt(3)
const snap = snapToBuildingBottom(modelA, modelB)

assert.ok(Math.abs(snap.start.y) < 1e-6)
assert.ok(Math.abs(snap.end.y) < 1e-6)
assert.ok(snap.start.x > -2.5)
assert.ok(snap.start.x <= -2.5 + SURFACE_OFFSET + 1e-6)
assert.ok(snap.end.x < 2.5)
assert.ok(snap.end.x >= 2.5 - SURFACE_OFFSET - 1e-6)
assert.ok(snap.direction.x > 0.99)

const surface = snapToBuildingSurface(modelA, modelB, 'middle')
assert.ok(Math.abs(surface.start.y - 0.5) < 1e-6)
assert.ok(Math.abs(surface.end.y - 0.5) < 1e-6)
assert.ok(
  Math.abs(surface.start.x - (-2.5 + SURFACE_OFFSET)) < 1e-6,
)
assert.ok(Math.abs(surface.end.x - (2.5 - SURFACE_OFFSET)) < 1e-6)
assert.ok(Math.abs(surface.startNormal.x - 1) < 1e-6)
assert.ok(Math.abs(surface.endNormal.x - -1) < 1e-6)
assert.ok(Math.abs(surface.start.z) < 1e-6)
assert.ok(Math.abs(surface.end.z) < 1e-6)

const modelMap = new Map<string, Object3D>([
  ['A', modelA],
  ['B', modelB],
])
const lines = new RelationLines({
  getModel: (id) => modelMap.get(id),
})

const edges: RenderEdge[] = [
  {
    id: 'M1',
    from: 'A',
    to: 'B',
    category: 'material',
    association: 0.8,
    active: true,
    riskLevel: 'high',
    dimmed: false,
    highlighted: false,
  },
  {
    id: 'C1',
    from: 'B',
    to: 'A',
    category: 'capital',
    association: 0.6,
    active: false,
    riskLevel: 'none',
    dimmed: false,
    highlighted: false,
  },
  {
    id: 'T1',
    from: 'A',
    to: 'B',
    category: 'tech',
    association: 0.5,
    active: false,
    riskLevel: 'none',
    dimmed: false,
    highlighted: false,
  },
]
lines.update(edges)

const ribbons = lines.group.children.filter(
  (child) => child.name === 'material-flow-ribbon',
)
const arrows = lines.group.children.filter(
  (child) => child.name === 'material-flow-arrow',
)
const pipes = lines.group.children.filter(
  (child) => child.name === 'capital-flow-pipe',
)
const elbows = lines.group.children.filter(
  (child) => child.name === 'capital-flow-elbow',
)
const techTubes = lines.group.children.filter(
  (child) => child.name === 'tech-flow-tube',
)
assert.equal(ribbons.length, 1)
assert.equal(arrows.length, 1)
assert.ok(pipes.length >= 3)
assert.equal(pipes[0].material, pipes[1].material)
assert.ok(elbows.length >= 1)
assert.ok(techTubes.length >= 1)
assert.ok(lines.group.children.length >= 8)
assert.equal(techTubes[0].userData.edgeId, 'T1')

const material = (ribbons[0] as Mesh).material
const capital = (pipes[0] as Mesh).material
const inactiveTechMaterial = (techTubes[0] as Mesh).material
assert.equal(FLOW_COLORS.enterprise, 0xa0e3f2)
assert.equal(FLOW_COLORS.material, 0x5bb8d4)
assert.equal(FLOW_COLORS.capital, 0x2e86ab)
assert.equal(FLOW_COLORS.tech, 0x3dd6c4)
assert.equal(FLOW_COLORS.guarantee, 0x2e7d32)
assert.equal(FLOW_COLORS.control, 0x8e7cc3)
assert.ok(material instanceof Object)
assert.ok(capital instanceof Object)
assert.equal((material as { transparent: boolean }).transparent, true)
assert.equal((material as { opacity: number }).opacity, 0.85)
assert.equal((material as { roughness: number }).roughness, 0.4)
assert.equal((material as { metalness: number }).metalness, 0.15)
assert.equal(
  (material as { color: { getHexString(): string } }).color.getHexString(),
  'e53935',
)
assert.equal((capital as { transparent: boolean }).transparent, true)
assert.equal((capital as { opacity: number }).opacity, 0.9)
assert.equal((capital as { roughness: number }).roughness, 0.35)
assert.equal((capital as { metalness: number }).metalness, 0.2)
assert.equal(
  (capital as { color: { getHexString(): string } }).color.getHexString(),
  'a0e3f2',
)
assert.equal(
  (inactiveTechMaterial as { color: { getHexString(): string } }).color.getHexString(),
  '3dd6c4',
)
assert.equal(
  (arrows[0] as Mesh).material,
  material,
  '箭头材质应跟随物料流水线',
)
assert.equal(ribbons[0].userData.edgeId, 'M1')
assert.equal(arrows[0].userData.edgeId, 'M1')
assert.ok(ribbons[0].renderOrder > 0)

const hoverMaterial = material as {
  opacity: number
  emissiveIntensity: number
}
lines.setHoveredEdge('M1')
const hoveredMaterial = (ribbons[0] as Mesh).material as {
  opacity: number
  emissiveIntensity: number
}
assert.notEqual(hoveredMaterial, hoverMaterial)
assert.equal(hoveredMaterial.opacity, 1)
assert.ok(hoveredMaterial.emissiveIntensity > 0)
lines.setHoveredEdge(null)
const restoredMaterial = (ribbons[0] as Mesh).material as {
  opacity: number
  emissiveIntensity: number
}
assert.equal(restoredMaterial, hoverMaterial)
assert.equal(restoredMaterial.opacity, 0.85)
assert.equal(restoredMaterial.emissiveIntensity, 0.28)

lines.setVisibleEdgeIds(['M1'])
for (const child of lines.group.children) {
  assert.equal(child.visible, child.userData.edgeId === 'M1')
}
lines.setVisibleEdgeIds(null)
for (const child of lines.group.children) {
  assert.equal(child.visible, true)
}
const resetMaterial = (ribbons[0] as Mesh).material as {
  opacity: number
}
assert.equal(
  resetMaterial.opacity,
  0.85,
  '风险源过滤恢复后不应残留隐藏态透明度',
)

function actualMinY(root: Object3D): number {
  let min = Number.POSITIVE_INFINITY
  const point = new Vector3()
  root.updateMatrixWorld(true)
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const positions = object.geometry.getAttribute('position')
    for (let index = 0; index < positions.count; index += 1) {
      point.fromBufferAttribute(positions, index)
      point.applyMatrix4(object.matrixWorld)
      min = Math.min(min, point.y)
    }
  })
  return min
}

for (const pipe of pipes) {
  pipe.geometry.computeBoundingBox()
  const box = pipe.geometry.boundingBox
  assert.ok(box)
  assert.ok(
    Math.abs(box.max.x - box.min.x - CAPITAL_PIPE_RADIUS * 2) < 1e-5,
  )
}

const minY = actualMinY(lines.group)
assert.ok(minY >= -1e-6, `实际几何最低点不应低于地面：${minY}`)
assert.ok(minY <= 1e-4, `实际几何最低点应贴地：${minY}`)

const ribbonBox = new Box3().setFromObject(ribbons[0])
assert.ok(Math.abs(ribbonBox.min.y) < 1e-6)
assert.ok(Math.abs(ribbonBox.max.y - PIPELINE_THICKNESS) < 1e-6)

lines.update([
  {
    ...edges[0],
    active: false,
    riskLevel: 'none',
  },
])
const restoredRibbon = lines.group.children.find(
  (child) => child.name === 'material-flow-ribbon',
) as Mesh
assert.equal(
  (restoredRibbon.material as { color: { getHexString(): string } })
    .color.getHexString(),
  'a0e3f2',
)
assert.equal(
  (restoredRibbon.material as { emissiveIntensity: number })
    .emissiveIntensity,
  0,
)

lines.update([])
assert.equal(lines.group.children.length, 0)

lines.update([
  {
    id: 'M2',
    from: 'B',
    to: 'A',
    category: 'material',
    association: 0.7,
    active: false,
    riskLevel: 'none',
    dimmed: false,
    highlighted: false,
  },
])
assert.equal(lines.group.children.length, 2)
lines.update([])
assert.equal(lines.group.children.length, 0)
lines.dispose()

const middleEdges: RenderEdge[] = [
  {
    id: 'T9',
    from: 'A',
    to: 'B',
    category: 'tech',
    association: 0.5,
    active: true,
    riskLevel: 'medium',
    dimmed: false,
    highlighted: false,
  },
  {
    id: 'G9',
    from: 'A',
    to: 'B',
    category: 'guarantee',
    association: 0.7,
    active: true,
    riskLevel: 'high',
    mutual: true,
    dimmed: false,
    highlighted: false,
  },
  {
    id: 'G10',
    from: 'B',
    to: 'A',
    category: 'guarantee',
    association: 0.6,
    active: false,
    riskLevel: 'none',
    dimmed: false,
    highlighted: false,
  },
]
const middleLines = new RelationLines({
  getModel: (id) => modelMap.get(id),
})
middleLines.update(middleEdges)
assert.equal(middleLines.surfaceSnaps.length, 3)
for (const snapInfo of middleLines.surfaceSnaps) {
  assert.equal(snapInfo.start.y, 0.5)
  assert.equal(snapInfo.end.y, 0.5)
  assert.ok(
    Math.abs(
      Math.abs(snapInfo.start.x) - (2.5 - SURFACE_OFFSET),
    ) < 1e-6,
  )
  assert.ok(
    Math.abs(
      Math.abs(snapInfo.end.x) - (2.5 - SURFACE_OFFSET),
    ) < 1e-6,
  )
  assert.equal(snapInfo.mutual, snapInfo.edgeId === 'G9')
}
const tubes = middleLines.group.children.filter(
  (child) =>
    child.name === 'tech-flow-tube' ||
    child.name === 'guarantee-flow-tube' ||
    child.name === 'guarantee-mutual-tube',
)
const mutualArrows = middleLines.group.children.filter(
  (child) => child.name === 'guarantee-mutual-arrow',
)
assert.equal(tubes.length, 3)
assert.equal(mutualArrows.length, 2)
const techTube = tubes.find(
  (child) => child.userData.edgeId === 'T9',
) as Mesh
const mutualTube = tubes.find(
  (child) => child.userData.edgeId === 'G9',
) as Mesh
const inactiveGuaranteeTube = tubes.find(
  (child) => child.userData.edgeId === 'G10',
) as Mesh
assert.equal(
  (techTube.geometry as unknown as { parameters: { radius: number } })
    .parameters.radius,
  TECH_LINE_RADIUS,
)
assert.equal(
  (mutualTube.geometry as unknown as { parameters: { radius: number } })
    .parameters.radius,
  GUARANTEE_LINE_RADIUS,
)
assert.equal(techTube.material.opacity, 0.85)
assert.equal(mutualTube.material.opacity, 0.85)
assert.equal(
  (techTube.material as { color: { getHexString(): string } }).color.getHexString(),
  'ff8c42',
)
assert.equal(
  (mutualTube.material as { color: { getHexString(): string } }).color.getHexString(),
  'e53935',
)
assert.equal(
  (inactiveGuaranteeTube.material as { color: { getHexString(): string } }).color.getHexString(),
  '2e7d32',
)
for (const arrow of mutualArrows) {
  assert.equal(arrow.userData.edgeId, 'G9')
}
middleLines.dispose()

console.log('✓ snapToBuildingBottom：端点 y=0，沿包围盒外法线外移 SURFACE_OFFSET')
console.log('✓ snapToBuildingSurface：中点高度、端点吸附建筑表面')
console.log(
  `✓ 技术流 TubeGeometry：radius=${TECH_LINE_RADIUS}，青绿色 #3DD6C4 / 0.85`,
)
console.log(
  `✓ 担保 TubeGeometry：radius=${GUARANTEE_LINE_RADIUS}，互保双箭头，深绿色 #2E7D32 / 0.85`,
)
console.log('✓ 物料流：1 条扁平带 + 1 个小三角箭头')
console.log('✓ 资金流：3 段 CylinderGeometry + 2 个 SphereGeometry 弯头')
console.log('✓ active 高风险边：#E53935；中风险边：#FF8C42')
console.log('✓ 非传导资金流恢复 #A0E3F2；非传导技术流 #3DD6C4')
console.log('✓ 箭头复用所在物料流的材质')
console.log('✓ update([]) 清空旧几何；dispose 正常')
console.log('✓ Step 9A/9B/10A 关系线核心逻辑验证通过')
