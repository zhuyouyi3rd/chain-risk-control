import {
  AmbientLight,
  BackSide,
  Box3,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  FrontSide,
  GridHelper,
  Group,
  InstancedMesh,
  Material,
  MathUtils,
  Matrix4,
  Mesh,
  MOUSE,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Texture,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import type { Object3D } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  CSS2DObject,
  CSS2DRenderer,
} from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { ENTERPRISE_TYPE_LABELS, RISK_LEVEL_LABELS } from '../core/labels'
import type {
  Enterprise,
  EnterpriseType,
  RelationCategory,
  RenderEdge,
  RenderNode,
  RiskLevel,
} from '../core/types'
import {
  computeLayeredLayout,
  computeLayoutBounds,
  type EnterprisePlacement,
  type LayoutBounds,
} from './LayoutEngine'
import { RelationLines, FLOW_COLORS } from './RelationLines'
import {
  BASE_HEIGHT,
  CONTROL_RING_WIDTH,
  GRID_CELL_SIZE,
  MODEL_TARGET_SIZE,
  RISK_SOURCE_RING_WIDTH,
  SCENE_SCALE,
} from './constants'

const MODEL_FILES: Record<EnterpriseType, string> = {
  raw_material: 'raw-material.glb',
  warehouse: 'warehouse.glb',
  workshop: 'workshop.glb',
  trading: 'trading.glb',
  service: 'service.glb',
  finance: 'finance.glb',
}

const MODEL_BASE = `${import.meta.env.BASE_URL}models/`
const GRID_Y = -BASE_HEIGHT - 0.001
const ENTITY_COLOR = 0xa0e3f2
const BASE_COLOR = 0x555555
const GRID_COLOR = 0x2a2a2a

const NODE_RISK_COLORS: Record<RiskLevel, number> = {
  none: 0x000000,
  low: 0xffb74d,
  medium: 0xff8c42,
  high: 0xe53935,
  source: 0xb71c1c,
}

interface NodeRiskVisual {
  group: Group
  materials: MeshBasicMaterial[]
  geometries: BufferGeometry[]
  level: RiskLevel
}

export interface ThreeSceneProgress {
  loaded: number
  total: number
  type: EnterpriseType
  fileProgress: number
}

export interface RelationHoverPayload {
  edgeId: string
  clientX: number
  clientY: number
}

export interface EnterpriseHoverPayload {
  enterpriseId: string
  clientX: number
  clientY: number
}

export interface ThreeSceneOptions {
  container: HTMLElement
  onProgress?: (progress: ThreeSceneProgress) => void
  onReady?: () => void
  onRelationHover?: (payload: RelationHoverPayload | null) => void
  onEnterpriseHover?: (payload: EnterpriseHoverPayload | null) => void
  onEnterpriseClick?: (enterpriseId: string) => void
  onBackgroundClick?: () => void
}

/**
 * 3D 场景：网格地面、轨道相机、六类 GLB 缓存加载、底座贴合与统一材质。
 * Step 9A 接入贴地物料流/资金流；不涉及风险配色或节点点击交互。
 */
export class ThreeScene {
  private readonly container: HTMLElement
  private readonly onProgress?: (progress: ThreeSceneProgress) => void
  private readonly onReady?: () => void
  private readonly onRelationHover?: (
    payload: RelationHoverPayload | null,
  ) => void
  private readonly onEnterpriseHover?: (
    payload: EnterpriseHoverPayload | null,
  ) => void
  private readonly onEnterpriseClick?: (enterpriseId: string) => void
  private readonly onBackgroundClick?: () => void
  private readonly scene = new Scene()
  private readonly camera: PerspectiveCamera
  private readonly renderer: WebGLRenderer
  private readonly controls: OrbitControls
  private readonly loader = new GLTFLoader()
  private readonly raycaster = new Raycaster()
  private readonly pointer = new Vector2()
  private readonly nodeLayer = new Group()
  private readonly entityMaterial: MeshStandardMaterial
  private readonly baseMaterial: MeshStandardMaterial
  private readonly controlRingMaterial: MeshBasicMaterial
  private readonly modelCache = new Map<EnterpriseType, Group>()
  private readonly modelsByEnterpriseId = new Map<string, Group>()
  private readonly nodeGroups: Group[] = []
  private readonly nodeGroupByEnterpriseId = new Map<string, Group>()
  private readonly nodeBaseRadii = new Map<string, number>()
  private readonly nodeEntityMaterials = new Map<string, MeshStandardMaterial>()
  private readonly nodeRiskVisuals = new Map<string, NodeRiskVisual>()
  private readonly nodeLevels = new Map<string, RiskLevel>()
  private readonly pulseVisuals: Array<{ group: Group; phase: number }> = []
  private readonly pickableObjects: Object3D[] = []
  private renderDirty = true
  private animationHandle: number | null = null
  private resizeTimer: number | null = null
  private resizeCount = 0
  private hoverState: { type: 'node' | 'edge'; id: string } | null = null
  private hoveredNodeId: string | null = null
  private pointerRafId: number | null = null
  private pendingPointer: { clientX: number; clientY: number } | null = null
  private middlePanActive = false
  private suppressHoverUntil = 0
  private lastControlsInputAt = 0
  private readonly initialCameraPosition = new Vector3()
  private readonly initialTarget = new Vector3()
  private hasInitialView = false
  private reachableNodeIds: Set<string> | null = null
  private focusedEnterpriseId: string | null = null
  private dimmedNodeIds = new Set<string>()
  private currentEdges: RenderEdge[] = []
  private layerVisibility: Record<RelationCategory, boolean> = {
    material: true,
    capital: true,
    tech: true,
    guarantee: true,
  }
  private pointerDownX = 0
  private pointerDownY = 0
  private readonly modelGeometries = new Set<BufferGeometry>()
  private readonly baseGeometries = new Set<BufferGeometry>()
  private baseUnitGeometry: CylinderGeometry | null = null
  private baseInstances: InstancedMesh | null = null
  private readonly baseInstanceIds: string[] = []
  private controlRingMesh: Mesh | null = null
  private labelRenderer: CSS2DRenderer
  private readonly labels = new Map<
    string,
    {
      object: CSS2DObject
      element: HTMLDivElement
      meta: HTMLSpanElement
      typeLabel: string
      level: RiskLevel
    }
  >()
  private readonly labelWorldPosition = new Vector3()
  private readonly resizeObserver: ResizeObserver
  private relationLines: RelationLines | null = null
  private placements = new Map<string, EnterprisePlacement>()
  private bounds: LayoutBounds = {
    minX: 0,
    maxX: 0,
    minZ: 0,
    maxZ: 0,
    centerX: 0,
    centerZ: 0,
    width: 0,
    depth: 0,
  }
  private grid: GridHelper | null = null
  private hoveredEdgeId: string | null = null
  private disposed = false

  constructor(options: ThreeSceneOptions) {
    this.container = options.container
    this.onProgress = options.onProgress
    this.onReady = options.onReady
    this.onRelationHover = options.onRelationHover
    this.onEnterpriseHover = options.onEnterpriseHover
    this.onEnterpriseClick = options.onEnterpriseClick
    this.onBackgroundClick = options.onBackgroundClick
    this.loader.setMeshoptDecoder(MeshoptDecoder)

    this.scene.background = new Color(0x000000)
    this.scene.add(new AmbientLight(0xffffff, 0.78))

    const directionalLight = new DirectionalLight(0xffffff, 1.8)
    directionalLight.position.set(6.5, 10, 7.5)
    this.scene.add(directionalLight)

    this.camera = new PerspectiveCamera(
      42,
      Math.max(1, this.container.clientWidth) /
        Math.max(1, this.container.clientHeight),
      0.1,
      260,
    )
    this.camera.position.set(8, 7.2, 10)
    this.camera.lookAt(0, 0.7, 0)

    this.renderer = new WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    })
    this.renderer.shadowMap.enabled = false
    this.renderer.setClearColor(0x000000, 1)
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, 1.5),
    )
    this.container.appendChild(this.renderer.domElement)

    this.labelRenderer = new CSS2DRenderer()
    this.labelRenderer.domElement.className = 'three-label-layer'
    this.container.appendChild(this.labelRenderer.domElement)

    this.controls = new OrbitControls(
      this.camera,
      this.renderer.domElement,
    )
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.09
    this.controls.rotateSpeed = 0.72
    this.controls.zoomSpeed = 0.82
    this.controls.enablePan = true
    this.controls.panSpeed = 1.0
    this.controls.screenSpacePanning = true
    this.controls.mouseButtons = {
      LEFT: MOUSE.ROTATE,
      MIDDLE: MOUSE.PAN,
      RIGHT: MOUSE.PAN,
    }
    this.controls.minDistance = 3.2 * SCENE_SCALE
    this.controls.maxDistance = 180
    this.controls.maxPolarAngle = Math.PI / 2 - 0.04
    this.controls.target.set(0, 0.7, 0)
    this.controls.update()
    this.controls.addEventListener('change', this.handleControlsChange)

    this.renderer.domElement.addEventListener(
      'pointermove',
      this.handlePointerMove,
    )
    this.renderer.domElement.addEventListener(
      'pointerleave',
      this.handlePointerLeave,
    )
    this.renderer.domElement.addEventListener(
      'pointerdown',
      this.handlePointerDown,
    )
    this.renderer.domElement.addEventListener('mousedown', this.handleMouseDown)
    this.renderer.domElement.addEventListener('auxclick', this.handleAuxClick)
    this.renderer.domElement.addEventListener('click', this.handleClick)
    this.renderer.domElement.addEventListener('wheel', this.handleWheelInput, {
      passive: true,
    })
    window.addEventListener('mouseup', this.handleWindowMouseUp)

    this.entityMaterial = new MeshStandardMaterial({
      color: ENTITY_COLOR,
      transparent: true,
      opacity: 0.78,
      roughness: 0.45,
      metalness: 0.1,
      side: FrontSide,
      depthWrite: false,
    })
    this.entityMaterial.name = 'Enterprise-Unified-Material'

    this.baseMaterial = new MeshStandardMaterial({
      color: BASE_COLOR,
      roughness: 0.82,
      metalness: 0.08,
      side: FrontSide,
    })
    this.baseMaterial.name = 'Enterprise-Base-Material'

    this.controlRingMaterial = new MeshBasicMaterial({
      color: FLOW_COLORS.control,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      side: FrontSide,
    })
    this.controlRingMaterial.name = 'Enterprise-Control-Ring-Material'

    this.scene.add(this.nodeLayer)
    this.resizeObserver = new ResizeObserver(() => this.scheduleResize())
    this.resizeObserver.observe(this.container)
    this.resize()
    this.startRenderLoop()
  }

  async load(
    enterprises: Enterprise[],
    edges: RenderEdge[],
    nodes: RenderNode[] = [],
  ): Promise<void> {
    if (this.disposed) throw new Error('3D scene has been disposed')

    const types = [
      ...new Set(enterprises.map((enterprise) => enterprise.type)),
    ]
    if (types.length === 0) {
      this.onReady?.()
      return
    }

    this.disposeRelationLines()
    this.clearNodes()
    this.placements = computeLayeredLayout(enterprises)
    this.bounds = computeLayoutBounds(this.placements)
    this.buildGrid(this.bounds)

    for (let index = 0; index < types.length; index += 1) {
      const type = types[index]
      if (!this.modelCache.has(type)) {
        this.onProgress?.({
          loaded: index,
          total: types.length,
          type,
          fileProgress: 0,
        })
        const source = await this.loadModel(type, (fileProgress) => {
          if (this.disposed) return
          this.onProgress?.({
            loaded: index,
            total: types.length,
            type,
            fileProgress,
          })
        })
        if (this.disposed) return
        this.modelCache.set(type, source)
      }
      this.onProgress?.({
        loaded: index + 1,
        total: types.length,
        type,
        fileProgress: 0,
      })
    }

    if (this.disposed) return
    this.buildNodes(enterprises)
    this.updateNodeLevels(nodes)
    this.buildRelationLines(edges)
    this.renderDirty = true
    this.onReady?.()
  }

  updateNodeLevels(nodes: RenderNode[]): void {
    const presentIds = new Set<string>()
    const dimmedIds = new Set<string>()
    for (const node of nodes) {
      presentIds.add(node.id)
      if (node.dimmed) dimmedIds.add(node.id)
      const previousLevel = this.nodeLevels.get(node.id)
      const visual = this.nodeRiskVisuals.get(node.id)
      if (
        previousLevel === node.level &&
        (visual?.level === node.level || node.level === 'none')
      ) {
        continue
      }
      this.applyNodeRiskVisual(node.id, node.level)
      this.nodeLevels.set(node.id, node.level)
      this.updateNodeLabel(node.id, node.level)
    }

    for (const enterpriseId of [...this.nodeLevels.keys()]) {
      if (presentIds.has(enterpriseId)) continue
      this.removeNodeRiskVisual(enterpriseId)
      this.nodeLevels.delete(enterpriseId)
    }
    this.dimmedNodeIds = dimmedIds
    this.applyNodeReachability()
    this.renderDirty = true
  }

  updateRelations(edges: RenderEdge[]): void {
    this.clearNodeHover()
    this.clearRelationHover()
    this.hoverState = null
    this.currentEdges = edges.map((edge) => ({ ...edge }))
    this.relationLines?.update(edges)
    this.relationLines?.setLayerVisibility(this.layerVisibility)
    this.relationLines?.setDimmedEdgeIds(
      edges.filter((edge) => edge.dimmed).map((edge) => edge.id),
    )
    this.applyEnterpriseEdgeFocus()
    this.renderDirty = true
  }

  setEnterpriseFocus(enterpriseId: string | null): void {
    if (this.focusedEnterpriseId === enterpriseId) return
    this.focusedEnterpriseId = enterpriseId
    this.applyEnterpriseEdgeFocus()
    this.applyNodeReachability()
    this.renderDirty = true
  }

  setLayerVisibility(
    visibility: Partial<Record<RelationCategory, boolean>>,
  ): void {
    this.layerVisibility = {
      ...this.layerVisibility,
      ...visibility,
    }
    this.hoverState = null
    this.clearRelationHover()
    this.relationLines?.setLayerVisibility(this.layerVisibility)
    this.renderDirty = true
  }

  private applyEnterpriseEdgeFocus(): void {
    if (!this.relationLines) return
    const focused = this.focusedEnterpriseId
    const edgeIds = focused
      ? this.currentEdges
          .filter(
            (edge) =>
              edge.from === focused || edge.to === focused,
          )
          .map((edge) => edge.id)
      : null
    this.relationLines.setFocusedEdgeIds(edgeIds)
  }

  resetView(): void {
    if (!this.hasInitialView) return
    this.middlePanActive = false
    this.suppressHoverUntil = performance.now() + 160
    this.cancelPendingHover()
    const dampingEnabled = this.controls.enableDamping
    this.controls.enableDamping = false
    // 先让 OrbitControls 冲掉平移/旋转阻尼残量，再写入初始视角。
    this.controls.update()
    this.controls.target.copy(this.initialTarget)
    this.camera.position.copy(this.initialCameraPosition)
    this.camera.lookAt(this.initialTarget)
    this.controls.update()
    this.controls.enableDamping = dampingEnabled
    this.renderDirty = true
  }

  private readonly handleControlsChange = (): void => {
    this.renderDirty = true
  }

  private startRenderLoop(): void {
    if (this.animationHandle !== null) return
    this.animationHandle = requestAnimationFrame(this.renderFrame)
  }

  private readonly renderFrame = (time: number): void => {
    if (this.disposed) return
    this.animationHandle = requestAnimationFrame(this.renderFrame)
    if (this.controls.update()) {
      this.renderDirty = true
    }
    if (
      this.controls.enableDamping &&
      this.lastControlsInputAt > 0 &&
      performance.now() - this.lastControlsInputAt > 1200
    ) {
      // 阻尼尾段已不可见；冲掉残量，避免无意义地持续重绘。
      this.controls.enableDamping = false
      this.controls.update()
      this.controls.enableDamping = true
      this.lastControlsInputAt = 0
      this.renderDirty = true
    }
    if (!this.renderDirty) return
    this.updatePulse(time)
    this.renderer.render(this.scene, this.camera)
    this.updateLabelLod()
    this.labelRenderer.render(this.scene, this.camera)
    this.renderDirty = false
  }

  private updatePulse(time: number): void {
    const elapsed = time * 0.001
    for (const pulse of this.pulseVisuals) {
      const scale =
        1 + Math.sin(elapsed * 1.8 + pulse.phase) * 0.03
      pulse.group.scale.setScalar(scale)
    }
  }

  private readonly scheduleResize = (): void => {
    if (this.resizeTimer !== null) {
      window.clearTimeout(this.resizeTimer)
    }
    this.resizeTimer = window.setTimeout(() => {
      this.resizeTimer = null
      if (!this.disposed) this.resize()
    }, 50)
  }

  private handlePointerMove = (event: PointerEvent): void => {
    if (event.buttons !== 0) {
      this.lastControlsInputAt = performance.now()
    }
    if (this.middlePanActive || performance.now() < this.suppressHoverUntil) {
      return
    }
    this.pendingPointer = {
      clientX: event.clientX,
      clientY: event.clientY,
    }
    if (this.pointerRafId !== null) return
    this.pointerRafId = requestAnimationFrame(() => {
      this.pointerRafId = null
      const pending = this.pendingPointer
      this.pendingPointer = null
      if (pending && !this.disposed) {
        this.processPointerMove(pending)
      }
    })
  }

  private processPointerMove(point: {
    clientX: number
    clientY: number
  }): void {
    if (!this.relationLines) return
    const canvas = this.renderer.domElement
    const rect = canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return

    this.pointer.x = ((point.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((point.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.camera)

    const nodeIntersections = this.raycaster.intersectObjects(
      this.pickableObjects,
      false,
    )
    for (const intersection of nodeIntersections) {
      if (!intersection.object.visible) continue
      let object: Object3D | null = intersection.object
      while (object) {
        let enterpriseId = object.userData.enterpriseId
        if (
          typeof enterpriseId !== 'string' &&
          object instanceof InstancedMesh &&
          intersection.instanceId !== undefined
        ) {
          enterpriseId =
            this.baseInstanceIds[intersection.instanceId]
        }
        if (typeof enterpriseId === 'string') {
          const previousHover = this.hoverState
          this.hoverState = { type: 'node', id: enterpriseId }
          if (previousHover?.type === 'edge') {
            this.clearRelationHover()
          }
          this.setHoveredNode(enterpriseId)
          this.onEnterpriseHover?.({
            enterpriseId,
            clientX: point.clientX,
            clientY: point.clientY,
          })
          return
        }
        object = object.parent
      }
    }

    this.clearNodeHover()

    const intersections = this.raycaster.intersectObjects(
      this.relationLines.group.children,
      true,
    )
    let topmost: (typeof intersections)[number] | null = null
    for (const intersection of intersections) {
      if (!intersection.object.visible) continue
      const edgeId = intersection.object.userData.edgeId
      if (typeof edgeId !== 'string') continue
      if (!topmost) {
        topmost = intersection
        continue
      }
      const order = intersection.object.renderOrder
      const topmostOrder = topmost.object.renderOrder
      if (
        order > topmostOrder ||
        (order === topmostOrder &&
          intersection.distance < topmost.distance)
      ) {
        topmost = intersection
      }
    }

    const edgeId = topmost?.object.userData.edgeId
    if (typeof edgeId === 'string') {
      this.hoverState = { type: 'edge', id: edgeId }
      if (this.hoveredEdgeId !== edgeId) {
        this.relationLines.setHoveredEdge(edgeId)
        this.hoveredEdgeId = edgeId
        this.renderDirty = true
      }
      this.onRelationHover?.({
        edgeId,
        clientX: point.clientX,
        clientY: point.clientY,
      })
      return
    }

    this.clearRelationHover()
    this.hoverState = null
  }

  private handlePointerLeave = (): void => {
    if (this.disposed) return
    if (this.pointerRafId !== null) {
      cancelAnimationFrame(this.pointerRafId)
      this.pointerRafId = null
    }
    this.pendingPointer = null
    this.hoverState = null
    this.clearNodeHover()
    this.clearRelationHover()
  }

  private handleMouseDown = (event: MouseEvent): void => {
    if (event.button !== 1) return
    event.preventDefault()
    this.middlePanActive = true
    this.suppressHoverUntil = performance.now() + 160
    this.cancelPendingHover()
  }

  private handleWindowMouseUp = (event: MouseEvent): void => {
    if (event.button !== 1 || !this.middlePanActive) return
    this.middlePanActive = false
    this.suppressHoverUntil = performance.now() + 160
  }

  private handleAuxClick = (event: MouseEvent): void => {
    if (event.button !== 1) return
    event.preventDefault()
  }

  private cancelPendingHover(): void {
    if (this.pointerRafId !== null) {
      cancelAnimationFrame(this.pointerRafId)
      this.pointerRafId = null
    }
    this.pendingPointer = null
    this.hoverState = null
    this.clearNodeHover()
    this.clearRelationHover()
  }

  private handlePointerDown = (event: PointerEvent): void => {
    this.lastControlsInputAt = performance.now()
    this.pointerDownX = event.clientX
    this.pointerDownY = event.clientY
  }

  private handleWheelInput = (): void => {
    this.lastControlsInputAt = performance.now()
  }

  private handleClick = (event: MouseEvent): void => {
    if (this.disposed) return
    if (this.middlePanActive || performance.now() < this.suppressHoverUntil) {
      return
    }
    if (
      Math.hypot(
        event.clientX - this.pointerDownX,
        event.clientY - this.pointerDownY,
      ) > 5
    ) {
      return
    }
    const rect = this.renderer.domElement.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hits = this.raycaster.intersectObjects(
      this.nodeLayer.children,
      true,
    )
    for (const hit of hits) {
      let object = hit.object
      while (object) {
        let enterpriseId = object.userData.enterpriseId
        if (
          typeof enterpriseId !== 'string' &&
          object instanceof InstancedMesh &&
          hit.instanceId !== undefined
        ) {
          enterpriseId = this.baseInstanceIds[hit.instanceId]
        }
        if (typeof enterpriseId === 'string') {
          this.onEnterpriseClick?.(enterpriseId)
          return
        }
        object = object.parent as typeof object
      }
    }
    this.onBackgroundClick?.()
  }

  setRiskSourceFilter(
    nodeIds: string[] | null,
    edgeIds: string[] | null,
  ): void {
    this.reachableNodeIds = nodeIds ? new Set(nodeIds) : null
    this.relationLines?.setVisibleEdgeIds(edgeIds)
    this.hoverState = null
    this.clearNodeHover()
    this.clearRelationHover()
    this.applyNodeReachability()
    this.renderDirty = true
  }

  private applyNodeReachability(): void {
    for (const [enterpriseId, material] of this.nodeEntityMaterials) {
      this.applyNodeMaterialAppearance(enterpriseId, material)
    }
    const filter = this.reachableNodeIds
    for (const [enterpriseId, visual] of this.nodeRiskVisuals) {
      visual.group.visible = !filter || filter.has(enterpriseId)
    }
    for (const [enterpriseId, label] of this.labels) {
      const focusDimmed =
        this.focusedEnterpriseId !== null &&
        this.focusedEnterpriseId !== enterpriseId
      const filterDimmed =
        filter !== null && !filter.has(enterpriseId)
      label.element.classList.toggle(
        'is-dimmed',
        focusDimmed ||
          filterDimmed ||
          this.dimmedNodeIds.has(enterpriseId),
      )
      label.element.classList.toggle(
        'is-focused',
        this.focusedEnterpriseId === enterpriseId,
      )
    }
    this.renderDirty = true
  }

  private applyNodeMaterialAppearance(
    enterpriseId: string,
    material: MeshStandardMaterial,
  ): void {
    const filter = this.reachableNodeIds
    const reachable = !filter || filter.has(enterpriseId)
    const hovered = this.hoveredNodeId === enterpriseId
    const focused = this.focusedEnterpriseId === enterpriseId
    const focusActive = this.focusedEnterpriseId !== null
    const dimmed = this.dimmedNodeIds.has(enterpriseId)
    material.opacity = hovered
      ? 1
      : focused
        ? 1
        : focusActive
          ? 0.18
          : filter
            ? reachable
              ? 0.92
              : 0.18
            : dimmed
              ? 0.18
              : 0.78
    if (hovered || focused) {
      material.emissive.setHex(ENTITY_COLOR)
      material.emissiveIntensity = 0.18
    } else if (filter && reachable) {
      material.emissive.setHex(ENTITY_COLOR)
      material.emissiveIntensity = 0.08
    } else {
      material.emissive.setHex(0x000000)
      material.emissiveIntensity = 0
    }
  }

  private setHoveredNode(enterpriseId: string | null): void {
    if (this.hoveredNodeId === enterpriseId) return
    const previousId = this.hoveredNodeId
    this.hoveredNodeId = enterpriseId
    for (const id of [previousId, enterpriseId]) {
      if (!id) continue
      const material = this.nodeEntityMaterials.get(id)
      if (material) this.applyNodeMaterialAppearance(id, material)
    }
    this.renderDirty = true
  }

  private clearNodeHover(): void {
    if (!this.hoveredNodeId) return
    if (
      this.hoverState?.type === 'node' &&
      this.hoverState.id === this.hoveredNodeId
    ) {
      this.hoverState = null
    }
    this.setHoveredNode(null)
    this.onEnterpriseHover?.(null)
  }

  private clearRelationHover(): void {
    if (!this.hoveredEdgeId) return
    this.relationLines?.setHoveredEdge(null)
    this.hoveredEdgeId = null
    this.renderDirty = true
    this.onRelationHover?.(null)
  }

  getRelationBridgeLog(): string[] {
    return this.relationLines?.bridgeLog ?? []
  }

  getEnterpriseBounds(): Record<
    string,
    {
      minX: number
      maxX: number
      minY: number
      maxY: number
      minZ: number
      maxZ: number
    }
  > {
    const result: Record<
      string,
      {
        minX: number
        maxX: number
        minY: number
        maxY: number
        minZ: number
        maxZ: number
      }
    > = {}
    this.modelsByEnterpriseId.forEach((model, enterpriseId) => {
      const box = new Box3().setFromObject(model)
      result[enterpriseId] = {
        minX: box.min.x,
        maxX: box.max.x,
        minY: box.min.y,
        maxY: box.max.y,
        minZ: box.min.z,
        maxZ: box.max.z,
      }
    })
    return result
  }

  resize(): void {
    if (this.disposed) return
    this.resizeCount += 1
    const width = this.container.clientWidth
    const height = this.container.clientHeight
    if (width <= 0 || height <= 0) return
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, 1.5),
    )
    this.renderer.setSize(width, height)
    this.labelRenderer.setSize(width, height)
    this.renderDirty = true
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    if (this.animationHandle !== null) {
      cancelAnimationFrame(this.animationHandle)
      this.animationHandle = null
    }
    if (this.resizeTimer !== null) {
      window.clearTimeout(this.resizeTimer)
      this.resizeTimer = null
    }
    if (this.pointerRafId !== null) {
      cancelAnimationFrame(this.pointerRafId)
      this.pointerRafId = null
    }
    this.pendingPointer = null
    this.renderer.domElement.removeEventListener(
      'pointermove',
      this.handlePointerMove,
    )
    this.renderer.domElement.removeEventListener(
      'pointerleave',
      this.handlePointerLeave,
    )
    this.renderer.domElement.removeEventListener(
      'pointerdown',
      this.handlePointerDown,
    )
    this.renderer.domElement.removeEventListener(
      'mousedown',
      this.handleMouseDown,
    )
    this.renderer.domElement.removeEventListener(
      'auxclick',
      this.handleAuxClick,
    )
    this.renderer.domElement.removeEventListener('click', this.handleClick)
    this.renderer.domElement.removeEventListener('wheel', this.handleWheelInput)
    window.removeEventListener('mouseup', this.handleWindowMouseUp)
    this.resizeObserver.disconnect()
    this.controls.removeEventListener('change', this.handleControlsChange)
    this.controls.dispose()
    this.disposeRelationLines()
    this.clearNodes()
    this.disposeGrid()
    this.modelGeometries.forEach((geometry) => geometry.dispose())
    this.modelGeometries.clear()
    this.nodeLayer.clear()
    this.scene.clear()
    this.modelCache.clear()
    this.entityMaterial.dispose()
    this.baseMaterial.dispose()
    this.controlRingMaterial.dispose()
    this.baseUnitGeometry?.dispose()
    this.baseUnitGeometry = null
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.renderer.domElement.remove()
    this.labelRenderer.domElement.remove()
  }

  private loadModel(
    type: EnterpriseType,
    onFileProgress: (progress: number) => void,
  ): Promise<Group> {
    return new Promise((resolve, reject) => {
      this.loader.load(
        `${MODEL_BASE}${MODEL_FILES[type]}`,
        (gltf) => {
          if (this.disposed) {
            this.disposeObjectTree(gltf.scene)
            reject(new Error('3D scene disposed while loading'))
            return
          }
          resolve(this.prepareSourceScene(gltf.scene))
        },
        (event) => {
          if (event.total > 0) {
            onFileProgress(Math.min(1, event.loaded / event.total))
          }
        },
        (error) => {
          reject(error)
        },
      )
    })
  }

  /**
   * 同一个类型的 GLB 只加载一次；这里把缓存场景的材质统一替换，
   * 并尽快释放原始贴图与材质，避免六个高精度模型占用过多显存。
   */
  private prepareSourceScene(source: Group): Group {
    const oldMaterials = new Set<Material>()
    const oldTextures = new Set<Texture>()

    source.traverse((object) => {
      if (!(object instanceof Mesh)) return
      this.modelGeometries.add(object.geometry)
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material]
      for (const material of materials) {
        if (!material) continue
        oldMaterials.add(material)
        for (const value of Object.values(material)) {
          if (value instanceof Texture) oldTextures.add(value)
        }
      }
      object.material = this.entityMaterial
      object.castShadow = false
      object.receiveShadow = false
    })

    oldTextures.forEach((texture) => texture.dispose())
    oldMaterials.forEach((material) => material.dispose())
    return source
  }

  private buildGrid(bounds: LayoutBounds): void {
    this.disposeGrid()
    const gridSize = Math.max(
      60,
      Math.ceil(
        Math.max(bounds.width + 20, bounds.depth + 20) /
          GRID_CELL_SIZE,
      ) * GRID_CELL_SIZE,
    )
    const divisions = Math.round(gridSize / GRID_CELL_SIZE)
    const grid = new GridHelper(
      gridSize,
      divisions,
      GRID_COLOR,
      GRID_COLOR,
    )
    grid.userData.gridCellSize = GRID_CELL_SIZE
    grid.userData.divisions = divisions
    grid.position.set(bounds.centerX, GRID_Y, bounds.centerZ)
    grid.renderOrder = -1
    const material = grid.material as Material | Material[]
    const materials = Array.isArray(material) ? material : [material]
    materials.forEach((item) => {
      item.transparent = true
      item.opacity = 0.82
      item.depthWrite = false
    })
    this.grid = grid
    this.scene.add(grid)
  }

  private mergeModelMeshes(
    model: Group,
    material: MeshStandardMaterial,
  ): void {
    const meshes: Mesh[] = []
    model.traverse((object) => {
      if (object instanceof Mesh) meshes.push(object)
    })
    if (meshes.length <= 1) return

    model.updateMatrixWorld(true)
    const inverseRoot = new Matrix4().copy(model.matrixWorld).invert()
    const geometries: BufferGeometry[] = []
    for (const mesh of meshes) {
      const geometry = mesh.geometry.clone()
      const localMatrix = new Matrix4().multiplyMatrices(
        inverseRoot,
        mesh.matrixWorld,
      )
      geometry.applyMatrix4(localMatrix)
      geometries.push(geometry)
    }
    const merged = mergeGeometries(geometries, false)
    geometries.forEach((geometry) => geometry.dispose())
    if (!merged) return

    model.clear()
    const mesh = new Mesh(merged, material)
    mesh.name = 'enterprise-merged-model'
    model.add(mesh)
  }

  private buildNodes(enterprises: Enterprise[]): void {
    this.baseInstanceIds.length = 0
    const basePlacements: Array<{
      id: string
      x: number
      z: number
      radius: number
    }> = []
    const controlRings: Array<{
      x: number
      z: number
      radius: number
    }> = []

    enterprises.forEach((enterprise) => {
      const source = this.modelCache.get(enterprise.type)
      const placement = this.placements.get(enterprise.id)
      if (!source || !placement) return

      const model = source.clone(true)
      model.name = `enterprise-model-${enterprise.id}`
      model.updateMatrixWorld(true)

      const rawBox = new Box3().setFromObject(model)
      const rawSize = rawBox.getSize(new Vector3())
      const largest = Math.max(rawSize.x, rawSize.y, rawSize.z)
      // 先归一化到基准尺寸，再显式乘 SCENE_SCALE；等价于 GLB 整体放大 2.5×。
      const scale = MODEL_TARGET_SIZE / Math.max(0.0001, largest)
      model.scale.multiplyScalar(scale)
      model.updateMatrixWorld(true)

      const scaledBox = new Box3().setFromObject(model)
      const center = scaledBox.getCenter(new Vector3())
      model.position.x -= center.x
      model.position.z -= center.z
      model.position.y -= scaledBox.min.y
      model.updateMatrixWorld(true)

      const fittedBox = new Box3().setFromObject(model)
      const fittedSize = fittedBox.getSize(new Vector3())
      const radius =
        (Math.max(fittedSize.x, fittedSize.z) / 2) * 1.1

      const nodeMaterial = this.entityMaterial.clone()
      nodeMaterial.name = `Enterprise-Material-${enterprise.id}`
      nodeMaterial.userData.baseOpacity = nodeMaterial.opacity
      this.mergeModelMeshes(model, nodeMaterial)
      model.traverse((object) => {
        if (!(object instanceof Mesh)) return
        object.material = nodeMaterial
        object.userData.enterpriseId = enterprise.id
        this.pickableObjects.push(object)
      })
      this.nodeEntityMaterials.set(enterprise.id, nodeMaterial)
      basePlacements.push({
        id: enterprise.id,
        x: placement.x,
        z: placement.z,
        radius,
      })
      if (enterprise.controllerGroup) {
        controlRings.push({
          x: placement.x,
          z: placement.z,
          radius,
        })
      }

      const group = new Group()
      group.name = `enterprise-node-${enterprise.id}`
      group.userData.enterpriseId = enterprise.id
      group.userData.enterpriseType = enterprise.type
      group.add(model)
      const label = this.createEnterpriseLabel(
        enterprise,
        fittedSize.y + 0.6 * SCENE_SCALE,
      )
      group.add(label)
      group.position.set(placement.x, 0, placement.z)
      this.modelsByEnterpriseId.set(enterprise.id, model)
      this.nodeGroupByEnterpriseId.set(enterprise.id, group)
      this.nodeBaseRadii.set(enterprise.id, radius)
      this.nodeLayer.add(group)
      this.nodeGroups.push(group)
    })

    if (!this.baseUnitGeometry) {
      this.baseUnitGeometry = new CylinderGeometry(1, 1, 1, 48)
    }
    const bases = new InstancedMesh(
      this.baseUnitGeometry,
      this.baseMaterial,
      basePlacements.length,
    )
    bases.name = 'enterprise-bases-instanced'
    const matrix = new Matrix4()
    basePlacements.forEach((item, index) => {
      matrix.makeScale(item.radius, BASE_HEIGHT, item.radius)
      matrix.setPosition(item.x, -BASE_HEIGHT / 2, item.z)
      bases.setMatrixAt(index, matrix)
      this.baseInstanceIds.push(item.id)
    })
    bases.instanceMatrix.needsUpdate = true
    bases.computeBoundingSphere()
    bases.userData.baseInstanceIds = [...this.baseInstanceIds]
    this.baseInstances = bases
    this.pickableObjects.push(bases)
    this.nodeLayer.add(bases)

    if (controlRings.length > 0) {
      const geometries = controlRings.map((ring) => {
        const geometry = new TorusGeometry(
          ring.radius + CONTROL_RING_WIDTH,
          CONTROL_RING_WIDTH,
          6,
          64,
        )
        geometry.rotateX(Math.PI / 2)
        geometry.translate(ring.x, -BASE_HEIGHT / 2, ring.z)
        return geometry
      })
      const merged = mergeGeometries(geometries, false)
      geometries.forEach((geometry) => geometry.dispose())
      if (merged) {
        const mesh = new Mesh(merged, this.controlRingMaterial)
        mesh.name = 'enterprise-control-rings-merged'
        this.controlRingMesh = mesh
        this.baseGeometries.add(merged)
        this.nodeLayer.add(mesh)
      }
    }

    this.nodeLayer.updateMatrixWorld(true)
    this.frameCamera(this.bounds)
  }

  private createEnterpriseLabel(
    enterprise: Enterprise,
    height: number,
  ): CSS2DObject {
    const element = document.createElement('div')
    element.className = 'three-label'
    element.dataset.enterpriseId = enterprise.id
    const name = document.createElement('span')
    name.className = 'three-label__name'
    name.textContent = enterprise.name
    const meta = document.createElement('span')
    meta.className = 'three-label__meta'
    meta.textContent = ENTERPRISE_TYPE_LABELS[enterprise.type]
    element.append(name, meta)
    const object = new CSS2DObject(element)
    object.position.set(0, height, 0)
    const level: RiskLevel = 'none'
    element.classList.add(`three-label--${level}`)
    this.labels.set(enterprise.id, {
      object,
      element,
      meta,
      typeLabel: ENTERPRISE_TYPE_LABELS[enterprise.type],
      level,
    })
    return object
  }

  private updateNodeLabel(
    enterpriseId: string,
    level: RiskLevel,
  ): void {
    const label = this.labels.get(enterpriseId)
    if (!label) return
    if (label.level !== level) {
      label.element.classList.remove(`three-label--${label.level}`)
      label.element.classList.add(`three-label--${level}`)
      label.level = level
    }
    label.meta.textContent = `${label.typeLabel} · ${RISK_LEVEL_LABELS[level]}`
  }

  private updateLabelLod(): void {
    for (const label of this.labels.values()) {
      label.object.getWorldPosition(this.labelWorldPosition)
      const detailed =
        this.camera.position.distanceTo(this.labelWorldPosition) < 70
      label.element.classList.toggle('is-near', detailed)
    }
  }

  private applyNodeRiskVisual(
    enterpriseId: string,
    level: RiskLevel,
  ): void {
    this.removeNodeRiskVisual(enterpriseId)
    if (level === 'none') return
    const nodeGroup = this.nodeGroupByEnterpriseId.get(enterpriseId)
    const model = this.modelsByEnterpriseId.get(enterpriseId)
    if (!nodeGroup || !model) return

    const visualGroup = new Group()
    visualGroup.name = `node-risk-${enterpriseId}-${level}`
    const materials: MeshBasicMaterial[] = []
    const geometries: BufferGeometry[] = []
    const color = NODE_RISK_COLORS[level]
    const isSource = level === 'source'

    const addOutline = (
      scale: number,
      opacity: number,
      renderOrder: number,
      name: string,
    ) => {
      const clone = model.clone(true)
      clone.scale.multiplyScalar(scale)
      clone.name = name
      const material = new MeshBasicMaterial({
        color,
        side: BackSide,
        transparent: true,
        opacity,
        depthWrite: false,
      })
      material.name = `${name}-material`
      materials.push(material)
      clone.traverse((object) => {
        if (!(object instanceof Mesh)) return
        object.material = material
        object.renderOrder = renderOrder
      })
      visualGroup.add(clone)
    }

    if (isSource) {
      addOutline(1.06, 0.92, -1, `risk-source-outline-${enterpriseId}`)
      const ringMaterial = new MeshBasicMaterial({
        color,
        side: FrontSide,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      })
      ringMaterial.name = `risk-source-ring-material-${enterpriseId}`
      materials.push(ringMaterial)
      const baseRadius = this.nodeBaseRadii.get(enterpriseId) ?? 0.8 * SCENE_SCALE
      for (let index = 0; index < 2; index += 1) {
        const geometry = new TorusGeometry(
          baseRadius +
            0.08 * SCENE_SCALE +
            index * 0.07 * SCENE_SCALE,
          RISK_SOURCE_RING_WIDTH,
          6,
          64,
        )
        geometries.push(geometry)
        const ring = new Mesh(geometry, ringMaterial)
        ring.name = `risk-source-ring-${enterpriseId}-${index + 1}`
        ring.rotation.x = Math.PI / 2
        ring.position.y =
          0.02 * SCENE_SCALE + index * 0.06 * SCENE_SCALE
        visualGroup.add(ring)
      }
      this.pulseVisuals.push({
        group: visualGroup,
        phase: enterpriseId === 'E1' ? 0 : Math.PI * 0.7,
      })
    } else {
      const scale =
        level === 'low' ? 1.035 : level === 'medium' ? 1.055 : 1.075
      addOutline(scale, 0.95, -1, `risk-outline-${enterpriseId}`)
      if (level === 'medium' || level === 'high') {
        addOutline(
          scale + 0.035,
          level === 'medium' ? 0.18 : 0.3,
          -2,
          `risk-glow-${enterpriseId}`,
        )
      }
    }

    nodeGroup.add(visualGroup)
    this.nodeRiskVisuals.set(enterpriseId, {
      group: visualGroup,
      materials,
      geometries,
      level,
    })
  }

  private removeNodeRiskVisual(enterpriseId: string): void {
    const visual = this.nodeRiskVisuals.get(enterpriseId)
    if (!visual) return
    visual.group.removeFromParent()
    visual.materials.forEach((material) => material.dispose())
    visual.geometries.forEach((geometry) => geometry.dispose())
    this.nodeRiskVisuals.delete(enterpriseId)
    const pulseIndex = this.pulseVisuals.findIndex(
      (pulse) => pulse.group === visual.group,
    )
    if (pulseIndex >= 0) this.pulseVisuals.splice(pulseIndex, 1)
  }

  private clearNodeRiskVisuals(): void {
    for (const enterpriseId of [...this.nodeRiskVisuals.keys()]) {
      this.removeNodeRiskVisual(enterpriseId)
    }
    this.pulseVisuals.length = 0
    this.nodeLevels.clear()
  }

  private buildRelationLines(edges: RenderEdge[]): void {
    this.disposeRelationLines()
    const lines = new RelationLines({
      getModel: (enterpriseId) =>
        this.modelsByEnterpriseId.get(enterpriseId),
      enterpriseIds: [...this.placements.keys()],
      getCenter: (enterpriseId) => {
        const placement = this.placements.get(enterpriseId)
        return placement
          ? { x: placement.x, z: placement.z }
          : undefined
      },
    })
    this.relationLines = lines
    this.scene.add(lines.group)
    lines.update(edges)
  }

  private disposeRelationLines(): void {
    if (!this.relationLines) return
    this.relationLines.dispose()
    this.relationLines = null
  }

  private frameCamera(bounds: LayoutBounds): void {
    const target = new Vector3(
      bounds.centerX,
      0.75,
      bounds.centerZ,
    )
    const fitRadius = Math.max(
      (bounds.width + 3 * SCENE_SCALE) / 2,
      (bounds.depth + 3 * SCENE_SCALE) / 2,
      4.5 * SCENE_SCALE,
    )
    const verticalFov = MathUtils.degToRad(this.camera.fov)
    const horizontalFov =
      2 *
      Math.atan(
        Math.tan(verticalFov / 2) * Math.max(this.camera.aspect, 0.35),
      )
    const limitingFov = Math.min(verticalFov, horizontalFov)
    const distance =
      (fitRadius / Math.tan(limitingFov / 2)) * 1.08
    const direction = new Vector3(0.58, 0.55, 0.86).normalize()
    this.camera.position
      .copy(target)
      .addScaledVector(direction, distance)
    this.camera.lookAt(target)
    this.controls.target.copy(target)
    this.controls.update()
    this.initialCameraPosition.copy(this.camera.position)
    this.initialTarget.copy(target)
    this.hasInitialView = true
  }

  private clearNodes(): void {
    this.clearNodeHover()
    this.hoverState = null
    this.focusedEnterpriseId = null
    this.dimmedNodeIds.clear()
    this.currentEdges = []
    for (const label of this.labels.values()) {
      label.object.removeFromParent()
      label.element.remove()
    }
    this.labels.clear()
    this.clearNodeRiskVisuals()
    this.reachableNodeIds = null
    this.nodeGroups.forEach((group) => {
      this.nodeLayer.remove(group)
      group.clear()
    })
    this.nodeGroups.length = 0
    if (this.baseInstances) {
      this.baseInstances.removeFromParent()
      this.baseInstances = null
    }
    this.baseInstanceIds.length = 0
    if (this.controlRingMesh) {
      this.controlRingMesh.removeFromParent()
      this.controlRingMesh = null
    }
    this.nodeGroupByEnterpriseId.clear()
    this.nodeBaseRadii.clear()
    this.nodeEntityMaterials.forEach((material) => material.dispose())
    this.nodeEntityMaterials.clear()
    this.pickableObjects.length = 0
    this.modelsByEnterpriseId.clear()
    this.baseGeometries.forEach((geometry) => geometry.dispose())
    this.baseGeometries.clear()
  }

  private disposeGrid(): void {
    if (!this.grid) return
    this.scene.remove(this.grid)
    this.grid.geometry.dispose()
    const material = this.grid.material as Material | Material[]
    const materials = Array.isArray(material) ? material : [material]
    materials.forEach((item) => item.dispose())
    this.grid = null
  }

  private disposeObjectTree(root: Group): void {
    const materials = new Set<Material>()
    const textures = new Set<Texture>()
    const geometries = new Set<BufferGeometry>()

    root.traverse((object) => {
      if (!(object instanceof Mesh)) return
      if (object.geometry) geometries.add(object.geometry)
      const objectMaterials = Array.isArray(object.material)
        ? object.material
        : [object.material]
      for (const material of objectMaterials) {
        if (!material) continue
        materials.add(material)
        for (const value of Object.values(material)) {
          if (value instanceof Texture) textures.add(value)
        }
      }
    })

    geometries.forEach((geometry) => geometry.dispose())
    textures.forEach((texture) => texture.dispose())
    materials.forEach((material) => material.dispose())
  }
}
