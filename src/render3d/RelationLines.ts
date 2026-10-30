import {
  Box3,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  FrontSide,
  Group,
  LineCurve3,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from 'three'
import type { Object3D } from 'three'
import type { RelationCategory, RenderEdge } from '../core/types'
import {
  OccupancyGrid,
  OrthogonalRouter,
  type Point2,
} from './OrthogonalRouter'
import {
  BRIDGE_RAMP_LENGTH,
  CAPITAL_PIPE_RADIUS,
  ELEVATED_Y,
  GUARANTEE_LINE_RADIUS,
  PIPELINE_THICKNESS,
  PIPELINE_WIDTH,
  SCENE_SCALE,
  SURFACE_OFFSET,
  TECH_LINE_RADIUS,
} from './constants'

export const FLOW_COLORS = {
  enterprise: 0xa0e3f2,
  material: 0x5bb8d4,
  capital: 0x2e86ab,
  tech: 0x3dd6c4,
  guarantee: 0x2e7d32,
  control: 0x8e7cc3,
} as const

const RISK_EDGE_COLORS: Partial<Record<string, number>> = {
  low: 0xffb74d,
  medium: 0xff8c42,
  high: 0xe53935,
  source: 0xb71c1c,
}

const NORMAL_FLOW_COLORS: Partial<Record<string, number>> = {
  material: FLOW_COLORS.enterprise,
  capital: FLOW_COLORS.enterprise,
  tech: FLOW_COLORS.tech,
  guarantee: FLOW_COLORS.guarantee,
}

const RIBBON_WIDTH = PIPELINE_WIDTH
const RIBBON_HEIGHT = PIPELINE_THICKNESS
const PIPE_RADIUS = CAPITAL_PIPE_RADIUS
const PIPE_AXIS_Y = CAPITAL_PIPE_RADIUS
const BRIDGE_HEIGHT = ELEVATED_Y
const ARROW_Y = RIBBON_HEIGHT + 0.005 * SCENE_SCALE
const UP = new Vector3(0, 1, 0)
const EPSILON = 1e-5

export interface SnappedEndpoints {
  start: Vector3
  end: Vector3
  direction: Vector3
  startNormal: Vector3
  endNormal: Vector3
}

export interface SurfaceSnapDiagnostic {
  edgeId: string
  from: string
  to: string
  category: 'tech' | 'guarantee'
  start: RoutePoint3D
  end: RoutePoint3D
  path: RoutePoint3D[]
  radius: number
  mutual: boolean
}

export interface RelationLinesOptions {
  getModel: (enterpriseId: string) => Object3D | undefined
  getCenter?: (enterpriseId: string) => Point2 | undefined
  enterpriseIds?: string[]
}

interface RoutePoint3D {
  x: number
  y: number
  z: number
}

export interface RouteDiagnostic {
  edgeId: string
  from: string
  to: string
  category: 'material' | 'capital'
  points: RoutePoint3D[]
  bridgeSegments: boolean[]
}

interface GroundSegment {
  x1: number
  z1: number
  x2: number
  z2: number
  edgeId: string
}

function edgeDistance(
  halfX: number,
  halfZ: number,
  direction: Vector3,
): number {
  const tx =
    Math.abs(direction.x) > EPSILON
      ? halfX / Math.abs(direction.x)
      : Number.POSITIVE_INFINITY
  const tz =
    Math.abs(direction.z) > EPSILON
      ? halfZ / Math.abs(direction.z)
      : Number.POSITIVE_INFINITY
  return Math.min(tx, tz)
}

function faceNormal(
  halfX: number,
  halfZ: number,
  direction: Vector3,
): Vector3 {
  const xWeight = Math.abs(direction.x) / Math.max(halfX, EPSILON)
  const zWeight = Math.abs(direction.z) / Math.max(halfZ, EPSILON)
  if (xWeight >= zWeight) {
    return new Vector3(Math.sign(direction.x) || 1, 0, 0)
  }
  return new Vector3(0, 0, Math.sign(direction.z) || 1)
}

/**
 * 从两个建筑模型的世界包围盒底部中心点计算贴地端点。
 * 该函数保留为 Step 9A 的端点计算工具；新路由实际使用路由方向裁切到包围盒边缘。
 */
export function snapToBuildingBottom(
  modelA: Object3D,
  modelB: Object3D,
): SnappedEndpoints {
  modelA.updateWorldMatrix(true, true)
  modelB.updateWorldMatrix(true, true)

  const boxA = new Box3().setFromObject(modelA)
  const boxB = new Box3().setFromObject(modelB)
  const centerA = boxA.getCenter(new Vector3()).setY(0)
  const centerB = boxB.getCenter(new Vector3()).setY(0)

  const direction = centerB.clone().sub(centerA)
  direction.y = 0
  if (direction.lengthSq() < 1e-8) {
    direction.set(1, 0, 0)
  } else {
    direction.normalize()
  }

  const sizeA = boxA.getSize(new Vector3())
  const sizeB = boxB.getSize(new Vector3())
  const halfXA = Math.max(sizeA.x / 2, EPSILON)
  const halfZA = Math.max(sizeA.z / 2, EPSILON)
  const halfXB = Math.max(sizeB.x / 2, EPSILON)
  const halfZB = Math.max(sizeB.z / 2, EPSILON)

  const distanceA = edgeDistance(halfXA, halfZA, direction)
  const distanceB = edgeDistance(halfXB, halfZB, direction)
  const startNormal = faceNormal(halfXA, halfZA, direction)
  const endNormal = faceNormal(halfXB, halfZB, direction).negate()

  const start = centerA
    .clone()
    .addScaledVector(direction, distanceA)
    .addScaledVector(startNormal, SURFACE_OFFSET)
    .setY(0)
  const end = centerB
    .clone()
    .addScaledVector(direction, -distanceB)
    .addScaledVector(endNormal, SURFACE_OFFSET)
    .setY(0)

  return { start, end, direction, startNormal, endNormal }
}

/**
 * 将端点吸附到建筑中部（或底部）表面。
 * 高度取各自包围盒高度的 50%；在 XZ 方向寻找射线与包围盒面的交点，
 * 最后沿外法线移动 0.01，避免与模型表面 Z-fighting。
 */
export function snapToBuildingSurface(
  modelA: Object3D,
  modelB: Object3D,
  heightMode: 'middle' | 'bottom' = 'middle',
): SnappedEndpoints {
  modelA.updateWorldMatrix(true, true)
  modelB.updateWorldMatrix(true, true)

  const boxA = new Box3().setFromObject(modelA)
  const boxB = new Box3().setFromObject(modelB)
  const heightA =
    heightMode === 'middle'
      ? boxA.min.y + (boxA.max.y - boxA.min.y) * 0.5
      : boxA.min.y
  const heightB =
    heightMode === 'middle'
      ? boxB.min.y + (boxB.max.y - boxB.min.y) * 0.5
      : boxB.min.y
  const centerA = boxA.getCenter(new Vector3()).setY(heightA)
  const centerB = boxB.getCenter(new Vector3()).setY(heightB)

  const direction = centerB.clone().sub(centerA)
  direction.y = 0
  if (direction.lengthSq() < 1e-8) {
    direction.set(1, 0, 0)
  } else {
    direction.normalize()
  }

  const sizeA = boxA.getSize(new Vector3())
  const sizeB = boxB.getSize(new Vector3())
  const halfXA = Math.max(sizeA.x / 2, EPSILON)
  const halfZA = Math.max(sizeA.z / 2, EPSILON)
  const halfXB = Math.max(sizeB.x / 2, EPSILON)
  const halfZB = Math.max(sizeB.z / 2, EPSILON)

  const distanceA = edgeDistance(halfXA, halfZA, direction)
  const distanceB = edgeDistance(halfXB, halfZB, direction)
  const startNormal = faceNormal(halfXA, halfZA, direction)
  const endNormal = faceNormal(halfXB, halfZB, direction).negate()

  const start = centerA
    .clone()
    .addScaledVector(direction, distanceA)
    .addScaledVector(startNormal, SURFACE_OFFSET)
    .setY(heightA)
  const end = centerB
    .clone()
    .addScaledVector(direction, -distanceB)
    .addScaledVector(endNormal, SURFACE_OFFSET)
    .setY(heightB)

  return { start, end, direction, startNormal, endNormal }
}

/**
 * 物料流/资金流贴地线。
 * 输入 RenderModel.edges，先用布局中心做正交曼哈顿路由，再裁切到建筑底缘。
 * 只处理 material / capital；风险颜色、标签和点击不在此模块。
 */
export class RelationLines {
  readonly group = new Group()
  readonly bridgeLog: string[] = []
  readonly routes: RouteDiagnostic[] = []
  readonly surfaceSnaps: SurfaceSnapDiagnostic[] = []
  private readonly getModel: (enterpriseId: string) => Object3D | undefined
  private readonly getCenter?: (enterpriseId: string) => Point2 | undefined
  private readonly enterpriseIds: string[]
  private readonly edgeMaterials = new Map<string, MeshStandardMaterial>()
  private readonly edgeMeshes = new Map<string, Mesh[]>()
  private readonly edgeCategories = new Map<string, RelationCategory>()
  private readonly edgeConfigs = new Map<
    string,
    {
      category: RelationCategory
      riskLevel: RenderEdge['riskLevel']
      active: boolean
    }
  >()
  private readonly materialPool = new Map<string, MeshStandardMaterial>()
  private visibleEdgeIds: Set<string> | null = null
  private layerVisibility: Record<RelationCategory, boolean> = {
    material: true,
    capital: true,
    tech: true,
    guarantee: true,
  }
  private dimmedEdgeIds = new Set<string>()
  private focusedEdgeIds: Set<string> | null = null
  private readonly arrowGeometry: BufferGeometry
  private readonly lineGeometries = new Set<BufferGeometry>()
  private hoveredEdgeId: string | null = null

  constructor(options: RelationLinesOptions) {
    this.getModel = options.getModel
    this.getCenter = options.getCenter
    this.enterpriseIds = options.enterpriseIds ?? []
    this.group.name = 'relation-lines'
    this.arrowGeometry = createArrowGeometry()
  }

  update(edges: RenderEdge[]): void {
    this.clear()
    this.bridgeLog.length = 0
    this.routes.length = 0
    this.surfaceSnaps.length = 0
    this.hoveredEdgeId = null
    for (const edge of edges) {
      this.edgeCategories.set(edge.id, edge.category)
      this.edgeConfigs.set(edge.id, {
        category: edge.category,
        riskLevel: edge.riskLevel,
        active: edge.active,
      })
    }

    const grid = new OccupancyGrid()
    const middleGrid = new OccupancyGrid()
    const centers = new Map<string, Point2>()
    const allEnterpriseIds =
      this.enterpriseIds.length > 0
        ? this.enterpriseIds
        : [
            ...new Set(
              edges.flatMap((edge) => [edge.from, edge.to]),
            ),
          ]

    for (const enterpriseId of allEnterpriseIds) {
      const model = this.getModel(enterpriseId)
      if (!model) continue
      const box = new Box3().setFromObject(model)
      grid.blockBox(box.min.x, box.max.x, box.min.z, box.max.z, 0.12 * SCENE_SCALE)
      middleGrid.blockBox(
        box.min.x,
        box.max.x,
        box.min.z,
        box.max.z,
        0.12 * SCENE_SCALE,
      )
      const center = this.centerFor(enterpriseId, model)
      if (center) centers.set(enterpriseId, center)
    }

    const router = new OrthogonalRouter(grid)
    const middleRouter = new OrthogonalRouter(middleGrid)
    const groundSegments: GroundSegment[] = []
    let renderOrder = 10

    for (const edge of edges) {
      if (
        edge.category !== 'material' &&
        edge.category !== 'capital' &&
        edge.category !== 'tech' &&
        edge.category !== 'guarantee'
      ) {
        continue
      }
      const modelA = this.getModel(edge.from)
      const modelB = this.getModel(edge.to)
      if (!modelA || !modelB) continue

      if (edge.category === 'tech' || edge.category === 'guarantee') {
        const centerA = centers.get(edge.from)
        const centerB = centers.get(edge.to)
        if (!centerA || !centerB) continue
        const snapped = snapToBuildingSurface(modelA, modelB, 'middle')
        const route = middleRouter.route(centerA, centerB)
        const clipped = clipRouteToBuildingEdges(route, modelA, modelB)
        if (clipped.length < 2) continue
        const xzPoints = clipped.map((point) => ({ ...point }))
        // 端点高度取中部表面高度；XZ 使用正交路由裁切后的表面端点，
        // 避免把中部端点替换成斜线插值点。
        const totalLength = xzPoints.reduce(
          (total, point, index) =>
            index === 0
              ? total
              : total +
                Math.hypot(
                  point.x - xzPoints[index - 1].x,
                  point.z - xzPoints[index - 1].z,
                ),
          0,
        )
        let travelled = 0
        const path = xzPoints.map((point, index) => {
          if (index > 0) {
            travelled += Math.hypot(
              point.x - xzPoints[index - 1].x,
              point.z - xzPoints[index - 1].z,
            )
          }
          const ratio =
            totalLength > EPSILON ? travelled / totalLength : 0
          return {
            x: point.x,
            y:
              snapped.start.y +
              (snapped.end.y - snapped.start.y) * ratio,
            z: point.z,
          }
        })
        const radius =
          edge.category === 'tech'
            ? TECH_LINE_RADIUS
            : GUARANTEE_LINE_RADIUS
        const material = this.getEdgeMaterial(edge.id, 'normal')
        this.edgeMaterials.set(edge.id, material)
        this.addMiddleFlowPath(
          path,
          material,
          edge.id,
          renderOrder,
          radius,
          edge.category === 'guarantee' && edge.mutual === true,
          edge.category,
        )
        this.surfaceSnaps.push({
          edgeId: edge.id,
          from: edge.from,
          to: edge.to,
          category: edge.category,
          start: {
            x: path[0].x,
            y: path[0].y,
            z: path[0].z,
          },
          end: {
            x: path[path.length - 1].x,
            y: path[path.length - 1].y,
            z: path[path.length - 1].z,
          },
          path: path.map((point) => ({ ...point })),
          radius,
          mutual: edge.category === 'guarantee' && edge.mutual === true,
        })
        renderOrder += 2
        continue
      }

      const centerA = centers.get(edge.from)
      const centerB = centers.get(edge.to)
      if (!centerA || !centerB) continue

      const route = router.route(centerA, centerB)
      const clipped = clipRouteToBuildingEdges(route, modelA, modelB)
      if (clipped.length < 2) continue

      const bridgeSegments = this.detectBridgeSegments(
        edge.id,
        clipped,
        groundSegments,
      )
      const path = buildElevatedRoute(clipped, bridgeSegments)
      this.routes.push({
        edgeId: edge.id,
        from: edge.from,
        to: edge.to,
        category: edge.category,
        points: path.map((point) => ({ ...point })),
        bridgeSegments: [...bridgeSegments],
      })
      const material = this.getEdgeMaterial(edge.id, 'normal')
      this.edgeMaterials.set(edge.id, material)
      if (edge.category === 'material') {
        this.addRibbon(path, material, edge.id, renderOrder)
        this.addArrow(path, material, edge.id, renderOrder + 1)
      } else {
        this.addPipe(path, material, edge.id, renderOrder)
      }
      renderOrder += 2

      for (let index = 0; index < clipped.length - 1; index += 1) {
        if (bridgeSegments[index]) continue
        groundSegments.push({
          x1: clipped[index].x,
          z1: clipped[index].z,
          x2: clipped[index + 1].x,
          z2: clipped[index + 1].z,
          edgeId: edge.id,
        })
      }
    }
    this.applyEdgeVisibility()
    this.applyEdgeMaterialStates()
  }

  dispose(): void {
    this.clear()
    this.arrowGeometry.dispose()
    this.group.removeFromParent()
  }

  setHoveredEdge(edgeId: string | null): void {
    if (edgeId && !this.isEdgeVisible(edgeId)) {
      return
    }
    if (this.hoveredEdgeId === edgeId) return
    this.hoveredEdgeId = edgeId
    this.applyEdgeMaterialStates()
  }

  private getEdgeMaterial(
    edgeId: string,
    state: 'normal' | 'dim' | 'hover' | 'focus',
  ): MeshStandardMaterial {
    const config = this.edgeConfigs.get(edgeId)
    if (!config) {
      throw new Error(`Unknown relation edge: ${edgeId}`)
    }
    const specs = {
      material: {
        name: 'Material-Flow-Material',
        opacity: 0.85,
        roughness: 0.4,
        metalness: 0.15,
      },
      capital: {
        name: 'Capital-Flow-Material',
        opacity: 0.9,
        roughness: 0.35,
        metalness: 0.2,
      },
      tech: {
        name: 'Tech-Flow-Material',
        opacity: 0.85,
        roughness: 0.4,
        metalness: 0.1,
      },
      guarantee: {
        name: 'Guarantee-Material',
        opacity: 0.85,
        roughness: 0.4,
        metalness: 0.1,
      },
    } as const
    const spec = specs[config.category]
    const riskColor = config.active
      ? RISK_EDGE_COLORS[config.riskLevel]
      : undefined
    const color =
      riskColor ?? NORMAL_FLOW_COLORS[config.category] ?? FLOW_COLORS.enterprise
    const riskKey = riskColor ? config.riskLevel : 'normal'
    const key = `${config.category}:${riskKey}:${state}`
    const cached = this.materialPool.get(key)
    if (cached) return cached

    const opacity =
      state === 'dim' ? 0.15 : state === 'hover' ? 1 : spec.opacity
    const material = createFlowMaterial(
      `${spec.name}:${state}`,
      color,
      opacity,
      spec.roughness,
      spec.metalness,
    )
    if (riskColor || state === 'hover' || state === 'focus') {
      material.emissive.setHex(riskColor ?? color)
      material.emissiveIntensity =
        state === 'normal' ? 0.28 : 0.36
    } else {
      material.emissive.setHex(0x000000)
      material.emissiveIntensity = 0
    }
    material.userData.baseOpacity = material.opacity
    material.userData.baseEmissive = material.emissive.getHex()
    material.userData.baseEmissiveIntensity = material.emissiveIntensity
    this.materialPool.set(key, material)
    return material
  }

  private clear(): void {
    this.group.clear()
    this.lineGeometries.forEach((geometry) => geometry.dispose())
    this.lineGeometries.clear()
    this.materialPool.forEach((material) => material.dispose())
    this.materialPool.clear()
    this.edgeMaterials.clear()
    this.edgeMeshes.clear()
    this.edgeCategories.clear()
    this.edgeConfigs.clear()
    this.hoveredEdgeId = null
  }

  setVisibleEdgeIds(edgeIds: string[] | null): void {
    this.visibleEdgeIds = edgeIds ? new Set(edgeIds) : null
    this.applyEdgeVisibility()
    this.applyEdgeMaterialStates()
    if (this.hoveredEdgeId && !this.isEdgeVisible(this.hoveredEdgeId)) {
      this.setHoveredEdge(null)
    }
  }

  setLayerVisibility(
    visibility: Partial<Record<RelationCategory, boolean>>,
  ): void {
    this.layerVisibility = {
      ...this.layerVisibility,
      ...visibility,
    }
    this.applyEdgeVisibility()
    if (this.hoveredEdgeId && !this.isEdgeVisible(this.hoveredEdgeId)) {
      this.setHoveredEdge(null)
    }
  }

  setDimmedEdgeIds(edgeIds: string[]): void {
    this.dimmedEdgeIds = new Set(edgeIds)
    this.applyEdgeMaterialStates()
  }

  setFocusedEdgeIds(edgeIds: string[] | null): void {
    this.focusedEdgeIds = edgeIds ? new Set(edgeIds) : null
    this.applyEdgeMaterialStates()
  }

  private isEdgeVisible(edgeId: string): boolean {
    if (
      this.visibleEdgeIds &&
      !this.visibleEdgeIds.has(edgeId)
    ) {
      return false
    }
    const category = this.edgeCategories.get(edgeId)
    return category ? this.layerVisibility[category] : true
  }

  private applyEdgeVisibility(): void {
    for (const [edgeId, meshes] of this.edgeMeshes.entries()) {
      const visible = this.isEdgeVisible(edgeId)
      for (const mesh of meshes) mesh.visible = visible
    }
  }

  private applyEdgeMaterialStates(): void {
    for (const edgeId of this.edgeConfigs.keys()) {
      const dimmed =
        this.dimmedEdgeIds.has(edgeId) ||
        (this.focusedEdgeIds !== null &&
          !this.focusedEdgeIds.has(edgeId))
      const focused =
        !dimmed &&
        this.focusedEdgeIds !== null &&
        this.focusedEdgeIds.has(edgeId)
      const state =
        this.hoveredEdgeId === edgeId && this.isEdgeVisible(edgeId)
          ? 'hover'
          : dimmed
            ? 'dim'
            : focused
              ? 'focus'
              : 'normal'
      const material = this.getEdgeMaterial(edgeId, state)
      this.edgeMaterials.set(edgeId, material)
      const meshes = this.edgeMeshes.get(edgeId)
      if (!meshes) continue
      for (const mesh of meshes) {
        mesh.material = material
      }
    }
  }

  private addEdgeMesh(
    mesh: Mesh,
    edgeId: string,
    renderOrder: number,
  ): void {
    mesh.userData.edgeId = edgeId
    mesh.renderOrder = renderOrder
    mesh.visible = this.isEdgeVisible(edgeId)
    this.group.add(mesh)
    const meshes = this.edgeMeshes.get(edgeId) ?? []
    meshes.push(mesh)
    this.edgeMeshes.set(edgeId, meshes)
  }

  private centerFor(
    enterpriseId: string,
    model: Object3D,
  ): Point2 | undefined {
    const provided = this.getCenter?.(enterpriseId)
    if (provided) return { ...provided }
    const box = new Box3().setFromObject(model)
    if (box.isEmpty()) return undefined
    const center = box.getCenter(new Vector3())
    return { x: center.x, z: center.z }
  }

  private detectBridgeSegments(
    edgeId: string,
    points: Point2[],
    groundSegments: GroundSegment[],
  ): boolean[] {
    const bridgeSegments = new Array<boolean>(points.length - 1).fill(false)

    for (let index = 0; index < points.length - 1; index += 1) {
      const segment = points[index]
      const next = points[index + 1]
      const overlap = groundSegments.some((ground) =>
        collinearOverlap(
          segment.x,
          segment.z,
          next.x,
          next.z,
          ground.x1,
          ground.z1,
          ground.x2,
          ground.z2,
        ) ||
        orthogonalCross(
          segment.x,
          segment.z,
          next.x,
          next.z,
          ground.x1,
          ground.z1,
          ground.x2,
          ground.z2,
        ),
      )
      if (!overlap) continue
      bridgeSegments[index] = true
      const message = `${edgeId} 段 ${index + 1} 上跨避让`
      this.bridgeLog.push(message)
      console.info(`[RelationLines] ${message}`)
    }

    return bridgeSegments
  }

  private addRibbon(
    points: RoutePoint3D[],
    material: MeshStandardMaterial,
    edgeId: string,
    renderOrder: number,
  ): void {
    const geometry = createRibbonGeometry(points)
    this.lineGeometries.add(geometry)
    const mesh = new Mesh(geometry, material)
    mesh.name = 'material-flow-ribbon'
    this.addEdgeMesh(mesh, edgeId, renderOrder)
  }

  private addArrow(
    points: RoutePoint3D[],
    material: MeshStandardMaterial,
    edgeId: string,
    renderOrder: number,
  ): void {
    if (points.length < 2) return
    let bestIndex = -1
    let bestLength = -1

    for (let index = 0; index < points.length - 1; index += 1) {
      const from = points[index]
      const to = points[index + 1]
      const length = Math.hypot(to.x - from.x, to.z - from.z)
      const ground = Math.abs(from.y) < EPSILON && Math.abs(to.y) < EPSILON
      const score = length + (ground ? 2 : 0)
      if (score > bestLength) {
        bestLength = score
        bestIndex = index
      }
    }

    if (bestIndex < 0) return
    const from = points[bestIndex]
    const to = points[bestIndex + 1]
    const dx = to.x - from.x
    const dz = to.z - from.z
    const length = Math.hypot(dx, dz)
    if (length < EPSILON) return

    const arrow = new Mesh(this.arrowGeometry, material)
    arrow.name = 'material-flow-arrow'
    arrow.position.set(
      (from.x + to.x) / 2,
      (from.y + to.y) / 2 + ARROW_Y,
      (from.z + to.z) / 2,
    )
    arrow.rotation.y = Math.atan2(dx, dz)
    this.addEdgeMesh(arrow, edgeId, renderOrder)
  }

  private addMiddleFlowPath(
    points: RoutePoint3D[],
    material: MeshStandardMaterial,
    edgeId: string,
    renderOrder: number,
    radius: number,
    mutual: boolean,
    category: 'tech' | 'guarantee',
  ): void {
    if (points.length < 2) return
    const tubeName =
      category === 'tech' ? 'tech-flow-tube' : 'guarantee-flow-tube'
    const jointName =
      category === 'tech' ? 'tech-flow-joint' : 'guarantee-flow-joint'

    const addTubeSegment = (
      from: RoutePoint3D,
      to: RoutePoint3D,
      order: number,
    ) => {
      const start = new Vector3(from.x, from.y, from.z)
      const end = new Vector3(to.x, to.y, to.z)
      const length = start.distanceTo(end)
      if (length < EPSILON) return
      const curve = new LineCurve3(start, end)
      const geometry = new TubeGeometry(
        curve,
        Math.max(8, Math.min(96, Math.ceil(length * 10))),
        radius,
        10,
        false,
      )
      this.lineGeometries.add(geometry)
      const tube = new Mesh(geometry, material)
      tube.name = mutual ? 'guarantee-mutual-tube' : tubeName
      this.addEdgeMesh(tube, edgeId, order)
    }

    for (let index = 0; index < points.length - 1; index += 1) {
      addTubeSegment(points[index], points[index + 1], renderOrder)
    }

    for (let index = 1; index < points.length - 1; index += 1) {
      const point = points[index]
      const geometry = new SphereGeometry(radius, 8, 6)
      this.lineGeometries.add(geometry)
      const joint = new Mesh(geometry, material)
      joint.name = jointName
      joint.position.set(point.x, point.y, point.z)
      this.addEdgeMesh(joint, edgeId, renderOrder + 1)
    }

    if (!mutual) return
    const addArrow = (
      point: RoutePoint3D,
      direction: Vector3,
      order: number,
    ) => {
      const arrowHeight = Math.max(0.2 * SCENE_SCALE, radius * 5)
      const geometry = new ConeGeometry(radius * 2.2, arrowHeight, 10)
      this.lineGeometries.add(geometry)
      const arrow = new Mesh(geometry, material)
      arrow.name = 'guarantee-mutual-arrow'
      arrow.position.set(point.x, point.y, point.z)
      arrow.quaternion.setFromUnitVectors(UP, direction.normalize())
      this.addEdgeMesh(arrow, edgeId, order)
    }

    const firstDirection = new Vector3(
      points[1].x - points[0].x,
      points[1].y - points[0].y,
      points[1].z - points[0].z,
    )
    const lastIndex = points.length - 1
    const lastDirection = new Vector3(
      points[lastIndex].x - points[lastIndex - 1].x,
      points[lastIndex].y - points[lastIndex - 1].y,
      points[lastIndex].z - points[lastIndex - 1].z,
    )
    const startPoint = {
      x: points[0].x + (points[1].x - points[0].x) * 0.2,
      y: points[0].y + (points[1].y - points[0].y) * 0.2,
      z: points[0].z + (points[1].z - points[0].z) * 0.2,
    }
    const endPoint = {
      x:
        points[lastIndex].x +
        (points[lastIndex - 1].x - points[lastIndex].x) * 0.2,
      y:
        points[lastIndex].y +
        (points[lastIndex - 1].y - points[lastIndex].y) * 0.2,
      z:
        points[lastIndex].z +
        (points[lastIndex - 1].z - points[lastIndex].z) * 0.2,
    }
    addArrow(startPoint, firstDirection.clone().negate(), renderOrder + 2)
    addArrow(endPoint, lastDirection, renderOrder + 3)
  }

  private addPipe(
    points: RoutePoint3D[],
    material: MeshStandardMaterial,
    edgeId: string,
    renderOrder: number,
  ): void {    for (let index = 0; index < points.length - 1; index += 1) {
      const from = points[index]
      const to = points[index + 1]
      const start = new Vector3(from.x, from.y + PIPE_AXIS_Y, from.z)
      const end = new Vector3(to.x, to.y + PIPE_AXIS_Y, to.z)
      const segment = end.clone().sub(start)
      const length = segment.length()
      if (length < EPSILON) continue

      const geometry = new CylinderGeometry(
        PIPE_RADIUS,
        PIPE_RADIUS,
        length,
        16,
        1,
        false,
      )
      this.lineGeometries.add(geometry)
      const mesh = new Mesh(geometry, material)
      mesh.name = 'capital-flow-pipe'
      mesh.position.copy(start).add(end).multiplyScalar(0.5)
      mesh.quaternion.setFromUnitVectors(UP, segment.normalize())
      this.addEdgeMesh(mesh, edgeId, renderOrder)
    }

    for (let index = 1; index < points.length - 1; index += 1) {
      const point = points[index]
      const geometry = new SphereGeometry(PIPE_RADIUS, 16, 12)
      this.lineGeometries.add(geometry)
      const joint = new Mesh(geometry, material)
      joint.name = 'capital-flow-elbow'
      joint.position.set(point.x, point.y + PIPE_AXIS_Y, point.z)
      this.addEdgeMesh(joint, edgeId, renderOrder)
    }
  }
}

function clipRouteToBuildingEdges(
  route: Point2[],
  modelA: Object3D,
  modelB: Object3D,
): Point2[] {
  if (route.length < 2) return route.map((point) => ({ ...point }))
  const points = route.map((point) => ({ ...point }))

  const startDirection = routeDirection(points, true)
  const endDirection = routeDirection(points, false)
  if (startDirection) {
    points[0] = clipToBoxEdge(modelA, startDirection)
  }
  if (endDirection) {
    points[points.length - 1] = clipToBoxEdge(modelB, endDirection)
  }
  return simplifyRoute(points)
}

function routeDirection(points: Point2[], fromStart: boolean): Point2 | null {
  if (fromStart) {
    for (let index = 1; index < points.length; index += 1) {
      const dx = points[index].x - points[0].x
      const dz = points[index].z - points[0].z
      if (Math.abs(dx) > EPSILON) {
        return { x: Math.sign(dx), z: 0 }
      }
      if (Math.abs(dz) > EPSILON) {
        return { x: 0, z: Math.sign(dz) }
      }
    }
  } else {
    const last = points.length - 1
    for (let index = last - 1; index >= 0; index -= 1) {
      const dx = points[index].x - points[last].x
      const dz = points[index].z - points[last].z
      if (Math.abs(dx) > EPSILON) {
        return { x: Math.sign(dx), z: 0 }
      }
      if (Math.abs(dz) > EPSILON) {
        return { x: 0, z: Math.sign(dz) }
      }
    }
  }
  return null
}

function clipToBoxEdge(model: Object3D, direction: Point2): Point2 {
  const box = new Box3().setFromObject(model)
  const center = box.getCenter(new Vector3())
  const size = box.getSize(new Vector3())
  const halfX = Math.max(size.x / 2, EPSILON)
  const halfZ = Math.max(size.z / 2, EPSILON)
  const axisX = Math.abs(direction.x) >= Math.abs(direction.z)
  const distance = axisX
    ? halfX / Math.max(Math.abs(direction.x), EPSILON)
    : halfZ / Math.max(Math.abs(direction.z), EPSILON)

  return {
    x: center.x + direction.x * (distance + SURFACE_OFFSET),
    z: center.z + direction.z * (distance + SURFACE_OFFSET),
  }
}

function simplifyRoute(points: Point2[]): Point2[] {
  const deduped: Point2[] = []
  points.forEach((point) => {
    const last = deduped[deduped.length - 1]
    if (
      !last ||
      Math.abs(last.x - point.x) > EPSILON ||
      Math.abs(last.z - point.z) > EPSILON
    ) {
      deduped.push(point)
    }
  })

  if (deduped.length <= 2) return deduped

  const result: Point2[] = [deduped[0]]
  for (let index = 1; index < deduped.length - 1; index += 1) {
    const previous = result[result.length - 1]
    const current = deduped[index]
    const next = deduped[index + 1]
    const sameX =
      Math.abs(previous.x - current.x) < EPSILON &&
      Math.abs(current.x - next.x) < EPSILON
    const sameZ =
      Math.abs(previous.z - current.z) < EPSILON &&
      Math.abs(current.z - next.z) < EPSILON
    if (!sameX && !sameZ) result.push(current)
  }
  result.push(deduped[deduped.length - 1])
  return result
}

function buildElevatedRoute(
  points: Point2[],
  bridgeSegments: boolean[],
): RoutePoint3D[] {
  const result: RoutePoint3D[] = []
  const push = (point: Point2, y: number) => {
    const last = result[result.length - 1]
    if (
      last &&
      Math.abs(last.x - point.x) < EPSILON &&
      Math.abs(last.z - point.z) < EPSILON &&
      Math.abs(last.y - y) < EPSILON
    ) {
      return
    }
    result.push({ x: point.x, y, z: point.z })
  }

  push(points[0], 0)
  let index = 0
  while (index < points.length - 1) {
    if (!bridgeSegments[index]) {
      push(points[index + 1], 0)
      index += 1
      continue
    }

    let runEnd = index
    while (
      runEnd + 1 < points.length - 1 &&
      bridgeSegments[runEnd + 1]
    ) {
      runEnd += 1
    }

    const start = points[index]
    const firstNext = points[index + 1]
    const startLength = Math.hypot(
      firstNext.x - start.x,
      firstNext.z - start.z,
    )
    const startRampLength = Math.min(
      BRIDGE_RAMP_LENGTH,
      startLength * 0.35,
    )
    const startT = startLength > EPSILON ? startRampLength / startLength : 0
    push(
      {
        x: start.x + (firstNext.x - start.x) * startT,
        z: start.z + (firstNext.z - start.z) * startT,
      },
      BRIDGE_HEIGHT,
    )

    for (let pointIndex = index + 1; pointIndex <= runEnd; pointIndex += 1) {
      push(points[pointIndex], BRIDGE_HEIGHT)
    }

    const lastStart = points[runEnd]
    const lastEnd = points[runEnd + 1]
    const endLength = Math.hypot(
      lastEnd.x - lastStart.x,
      lastEnd.z - lastStart.z,
    )
    const endRampLength = Math.min(
      BRIDGE_RAMP_LENGTH,
      endLength * 0.35,
    )
    const endT = endLength > EPSILON ? endRampLength / endLength : 0
    push(
      {
        x: lastEnd.x + (lastStart.x - lastEnd.x) * endT,
        z: lastEnd.z + (lastStart.z - lastEnd.z) * endT,
      },
      BRIDGE_HEIGHT,
    )
    push(lastEnd, 0)

    index = runEnd + 1
  }

  return result
}

function collinearOverlap(
  ax1: number,
  az1: number,
  ax2: number,
  az2: number,
  bx1: number,
  bz1: number,
  bx2: number,
  bz2: number,
): boolean {
  const aHorizontal = Math.abs(az1 - az2) < EPSILON
  const bHorizontal = Math.abs(bz1 - bz2) < EPSILON
  if (aHorizontal !== bHorizontal) return false

  if (aHorizontal && Math.abs(az1 - bz1) < 0.02) {
    const overlap =
      Math.min(Math.max(ax1, ax2), Math.max(bx1, bx2)) -
      Math.max(Math.min(ax1, ax2), Math.min(bx1, bx2))
    return overlap > 0.1
  }

  if (
    !aHorizontal &&
    Math.abs(ax1 - bx1) < 0.02
  ) {
    const overlap =
      Math.min(Math.max(az1, az2), Math.max(bz1, bz2)) -
      Math.max(Math.min(az1, az2), Math.min(bz1, bz2))
    return overlap > 0.1
  }

  return false
}

function orthogonalCross(
  ax1: number,
  az1: number,
  ax2: number,
  az2: number,
  bx1: number,
  bz1: number,
  bx2: number,
  bz2: number,
): boolean {
  const aVertical = Math.abs(ax1 - ax2) < EPSILON
  const aHorizontal = Math.abs(az1 - az2) < EPSILON
  const bVertical = Math.abs(bx1 - bx2) < EPSILON
  const bHorizontal = Math.abs(bz1 - bz2) < EPSILON
  if (!(aVertical && bHorizontal) && !(aHorizontal && bVertical)) {
    return false
  }

  const vertical = aVertical
    ? { x: ax1, zMin: Math.min(az1, az2), zMax: Math.max(az1, az2) }
    : { x: bx1, zMin: Math.min(bz1, bz2), zMax: Math.max(bz1, bz2) }
  const horizontal = aVertical
    ? { z: bz1, xMin: Math.min(bx1, bx2), xMax: Math.max(bx1, bx2) }
    : { z: az1, xMin: Math.min(ax1, ax2), xMax: Math.max(ax1, ax2) }

  return (
    vertical.x >= horizontal.xMin - EPSILON &&
    vertical.x <= horizontal.xMax + EPSILON &&
    horizontal.z >= vertical.zMin - EPSILON &&
    horizontal.z <= vertical.zMax + EPSILON
  )
}

function createRibbonGeometry(points: RoutePoint3D[]): BufferGeometry {
  const clean = points.filter((point, index) => {
    if (index === 0) return true
    const previous = points[index - 1]
    return (
      Math.abs(previous.x - point.x) > EPSILON ||
      Math.abs(previous.z - point.z) > EPSILON ||
      Math.abs(previous.y - point.y) > EPSILON
    )
  })
  if (clean.length < 2) return new BufferGeometry()

  const directions: Point2[] = []
  for (let index = 0; index < clean.length - 1; index += 1) {
    const from = clean[index]
    const to = clean[index + 1]
    const dx = to.x - from.x
    const dz = to.z - from.z
    const length = Math.hypot(dx, dz)
    directions.push(
      length > EPSILON ? { x: dx / length, z: dz / length } : { x: 0, z: 0 },
    )
  }

  const positions: number[] = []
  const indices: number[] = []
  const halfWidth = RIBBON_WIDTH / 2

  clean.forEach((point, index) => {
    const previousDirection =
      index > 0 ? directions[index - 1] : directions[index]
    const nextDirection =
      index < clean.length - 1 ? directions[index] : directions[index - 1]
    const normalIn = {
      x: -previousDirection.z,
      z: previousDirection.x,
    }
    const normalOut = {
      x: -nextDirection.z,
      z: nextDirection.x,
    }
    let miterX = normalIn.x + normalOut.x
    let miterZ = normalIn.z + normalOut.z
    const miterLength = Math.hypot(miterX, miterZ)
    if (miterLength < EPSILON) {
      miterX = normalOut.x
      miterZ = normalOut.z
    } else {
      miterX /= miterLength
      miterZ /= miterLength
    }
    const denominator = Math.max(
      0.5,
      miterX * normalOut.x + miterZ * normalOut.z,
    )
    const offset = halfWidth / denominator
    const leftX = point.x + miterX * offset
    const leftZ = point.z + miterZ * offset
    const rightX = point.x - miterX * offset
    const rightZ = point.z - miterZ * offset
    const base = point.y
    const top = base + RIBBON_HEIGHT

    positions.push(
      leftX,
      top,
      leftZ,
      rightX,
      top,
      rightZ,
      leftX,
      base,
      leftZ,
      leftX,
      top,
      leftZ,
      rightX,
      base,
      rightZ,
      rightX,
      top,
      rightZ,
    )
  })

  const topOffset = 0
  const leftOffset = 2
  const rightOffset = 4

  for (let index = 0; index < clean.length - 1; index += 1) {
    const topA = topOffset + index * 6
    const topB = topA + 1
    const topC = topA + 6
    const topD = topA + 7
    const ax = positions[topA * 3]
    const az = positions[topA * 3 + 2]
    const bx = positions[topB * 3]
    const bz = positions[topB * 3 + 2]
    const cx = positions[topC * 3]
    const cz = positions[topC * 3 + 2]
    const crossY =
      (bz - az) * (cx - ax) - (bx - ax) * (cz - az)
    if (crossY >= 0) {
      indices.push(topA, topB, topC, topB, topD, topC)
    } else {
      indices.push(topA, topC, topB, topB, topC, topD)
    }

    const leftA = leftOffset + index * 6
    const leftB = leftA + 1
    const leftC = leftA + 6
    const leftD = leftA + 7
    indices.push(leftA, leftB, leftC, leftB, leftD, leftC)

    const rightA = rightOffset + index * 6
    const rightB = rightA + 1
    const rightC = rightA + 6
    const rightD = rightA + 7
    indices.push(rightA, rightB, rightC, rightB, rightD, rightC)
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(positions, 3),
  )
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

function createArrowGeometry(): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(
      [
        0,
        0,
        0.17 * SCENE_SCALE,
        -0.11 * SCENE_SCALE,
        0,
        -0.09 * SCENE_SCALE,
        0.11 * SCENE_SCALE,
        0,
        -0.09 * SCENE_SCALE,
      ],
      3,
    ),
  )
  geometry.setIndex([0, 2, 1])
  geometry.computeVertexNormals()
  return geometry
}

function createFlowMaterial(
  name: string,
  color: number,
  opacity: number,
  roughness: number,
  metalness: number,
): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    color,
    transparent: true,
    opacity,
    roughness,
    metalness,
    side: FrontSide,
    depthWrite: false,
  })
  material.name = name
  return material
}
