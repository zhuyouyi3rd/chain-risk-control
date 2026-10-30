import type {
  ControllerGroup,
  Relation,
  RelationCategory,
  RenderEdge,
  RenderModel,
  RenderNode,
  RiskLevel,
  RiskSource,
  WorkspaceData,
} from './types'
import { buildControllerGroups } from './workspace'

const EPSILON = 1e-9
const PRECISION = 1e6

export interface PropagationHop {
  edgeId: string
  from: string
  to: string
  category: RelationCategory
  association: number
  fromImpact: number
  toImpact: number
  riskLevel: Exclude<RiskLevel, 'source'>
  reverse: boolean
}

export interface RiskPropagationPath {
  riskSourceId: string
  riskSourceName: string
  startEnterpriseId: string
  targetEnterpriseId: string
  hops: PropagationHop[]
  impact: number
  level: RiskLevel
}

export interface PropagationResult {
  renderModel: RenderModel
  pathsByEnterprise: Map<string, RiskPropagationPath[]>
  reachabilityByRiskSource: Map<string, RiskSourceReachability>
}

export interface RiskSourceReachability {
  riskSourceId: string
  reachableNodes: Set<string>
  reachableEdges: Set<string>
}

interface PropagationEdge {
  edgeId: string
  from: string
  to: string
  weight: number
  category: RelationCategory
  reverse: boolean
}

interface RelationPropagation {
  relation: Relation
  directions: PropagationEdge[]
}

function clampImpact(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

function roundImpact(value: number): number {
  return Math.round(clampImpact(value) * PRECISION) / PRECISION
}

/**
 * 按 impact 分档：0→none，(0,0.35]→low，(0.35,0.65]→medium，其余→high。
 * risk source 的 source 等级由 buildRenderModel 单独覆盖。
 */
export function levelFromImpact(impact: number): Exclude<RiskLevel, 'source'> {
  const value = clampImpact(impact)
  if (value <= 0) return 'none'
  if (value <= 0.35 + EPSILON) return 'low'
  if (value <= 0.65 + EPSILON) return 'medium'
  return 'high'
}

function propagationDirections(relation: Relation): PropagationEdge[] {
  if (!relation.from || !relation.to) return []
  if (relation.from === relation.to) return []
  if (!Number.isFinite(relation.association) || relation.association <= 0) {
    return []
  }

  const weight = clampImpact(relation.association)
  const directions: PropagationEdge[] = [
    {
      edgeId: relation.id,
      from: relation.from,
      to: relation.to,
      weight,
      category: relation.category,
      reverse: false,
    },
  ]

  if (relation.category === 'guarantee' && relation.mutual) {
    directions.push({
      edgeId: relation.id,
      from: relation.to,
      to: relation.from,
      weight,
      category: relation.category,
      reverse: true,
    })
  }

  return directions
}

function canPropagateTo(
  edge: PropagationEdge,
  enterpriseIds: Set<string>,
): boolean {
  return enterpriseIds.has(edge.from) && enterpriseIds.has(edge.to)
}

function computeImpacts(
  workspaceData: WorkspaceData,
  activeRiskSourceIds: ReadonlySet<string>,
  enterpriseIds: Set<string>,
  propagationEdges: PropagationEdge[],
): { impacts: Map<string, number>; sourceNodeIds: Set<string> } {
  const impacts = new Map<string, number>()
  const sourceNodeIds = new Set<string>()

  for (const enterprise of workspaceData.enterprises) {
    impacts.set(enterprise.id, 0)
  }

  for (const riskSource of workspaceData.riskSources) {
    if (!activeRiskSourceIds.has(riskSource.id)) continue
    for (const targetId of riskSource.targetEnterpriseIds) {
      if (!enterpriseIds.has(targetId)) continue
      impacts.set(targetId, 1)
      sourceNodeIds.add(targetId)
    }
  }

  // Bellman-Ford 风格的 max 松弛。边权在 (0,1]，简单路径最多 n-1 跳，
  // 因此最多 n 轮松弛即可收敛；循环不会让冲击超过风险源的 1.0。
  const maxPasses = Math.max(1, workspaceData.enterprises.length)
  for (let pass = 0; pass < maxPasses; pass += 1) {
    let changed = false
    for (const edge of propagationEdges) {
      const sourceImpact = impacts.get(edge.from) ?? 0
      if (sourceImpact <= 0) continue
      const candidate = sourceImpact * edge.weight
      const current = impacts.get(edge.to) ?? 0
      if (candidate > current + EPSILON) {
        impacts.set(edge.to, candidate)
        changed = true
      }
    }
    if (!changed) break
  }

  return { impacts, sourceNodeIds }
}

function buildEdge(
  relationPropagation: RelationPropagation,
  impacts: Map<string, number>,
): RenderEdge {
  const { relation, directions } = relationPropagation
  let maxTransmitted = 0

  for (const direction of directions) {
    const sourceImpact = impacts.get(direction.from) ?? 0
    if (sourceImpact <= 0) continue
    const transmitted = sourceImpact * direction.weight
    if (transmitted > maxTransmitted) maxTransmitted = transmitted
  }

  const active = maxTransmitted > 0
  return {
    id: relation.id,
    from: relation.from,
    to: relation.to,
    category: relation.category,
    association: relation.association,
    active,
    mutual: relation.mutual,
    // 边按“经过该边后实际传递的冲击”分档；风险源节点才使用 source 等级。
    riskLevel: active ? levelFromImpact(maxTransmitted) : 'none',
    dimmed: false,
    highlighted: false,
  }
}

interface Predecessor {
  edge: PropagationEdge
}

/**
 * 对单个风险源做一次 max 松弛，并记录每个节点的最佳前驱边。
 * 与全局 impact 算法一致；额外得到可回溯的 source -> target 路径。
 */
function computeSourcePaths(
  riskSource: RiskSource,
  enterpriseIds: Set<string>,
  propagationEdges: PropagationEdge[],
): RiskPropagationPath[] {
  const seeds = riskSource.targetEnterpriseIds.filter((id) =>
    enterpriseIds.has(id),
  )
  if (seeds.length === 0) return []

  const impacts = new Map<string, number>()
  for (const id of enterpriseIds) impacts.set(id, 0)
  for (const seed of seeds) impacts.set(seed, 1)

  const predecessors = new Map<string, Predecessor>()
  const maxPasses = Math.max(1, enterpriseIds.size)

  for (let pass = 0; pass < maxPasses; pass += 1) {
    let changed = false
    for (const edge of propagationEdges) {
      const sourceImpact = impacts.get(edge.from) ?? 0
      if (sourceImpact <= 0) continue
      const candidate = sourceImpact * edge.weight
      const current = impacts.get(edge.to) ?? 0
      if (candidate > current + EPSILON) {
        impacts.set(edge.to, candidate)
        predecessors.set(edge.to, { edge })
        changed = true
      }
    }
    if (!changed) break
  }

  const seedSet = new Set(seeds)
  const paths: RiskPropagationPath[] = []

  for (const targetId of enterpriseIds) {
    const targetImpact = impacts.get(targetId) ?? 0
    if (targetImpact <= 0) continue

    if (seedSet.has(targetId)) {
      paths.push({
        riskSourceId: riskSource.id,
        riskSourceName: riskSource.name,
        startEnterpriseId: targetId,
        targetEnterpriseId: targetId,
        hops: [],
        impact: 1,
        level: 'source',
      })
      continue
    }

    const reversedHops: PropagationHop[] = []
    const visited = new Set<string>([targetId])
    let cursor = targetId
    let complete = false

    while (!seedSet.has(cursor)) {
      const predecessor = predecessors.get(cursor)
      if (!predecessor) break
      const edge = predecessor.edge
      if (visited.has(edge.from)) break

      const fromImpact = impacts.get(edge.from) ?? 0
      const toImpact = impacts.get(edge.to) ?? 0
      reversedHops.push({
        edgeId: edge.edgeId,
        from: edge.from,
        to: edge.to,
        category: edge.category,
        association: edge.weight,
        fromImpact: roundImpact(fromImpact),
        toImpact: roundImpact(toImpact),
        riskLevel: levelFromImpact(toImpact),
        reverse: edge.reverse,
      })
      visited.add(edge.from)
      cursor = edge.from
      if (seedSet.has(cursor)) complete = true
    }

    if (!complete || reversedHops.length === 0) continue
    reversedHops.reverse()

    const impact = roundImpact(targetImpact)
    paths.push({
      riskSourceId: riskSource.id,
      riskSourceName: riskSource.name,
      startEnterpriseId: cursor,
      targetEnterpriseId: targetId,
      hops: reversedHops,
      impact,
      level: levelFromImpact(impact),
    })
  }

  return paths
}

function buildPropagationPaths(
  workspaceData: WorkspaceData,
  activeRiskSourceIds: ReadonlySet<string>,
  enterpriseIds: Set<string>,
  propagationEdges: PropagationEdge[],
): Map<string, RiskPropagationPath[]> {
  const pathsByEnterprise = new Map<string, RiskPropagationPath[]>()

  for (const riskSource of workspaceData.riskSources) {
    if (!activeRiskSourceIds.has(riskSource.id)) continue
    const paths = computeSourcePaths(
      riskSource,
      enterpriseIds,
      propagationEdges,
    )
    for (const path of paths) {
      const list = pathsByEnterprise.get(path.targetEnterpriseId) ?? []
      list.push(path)
      pathsByEnterprise.set(path.targetEnterpriseId, list)
    }
  }

  return pathsByEnterprise
}

/**
 * 风险源可达域。
 *
 * reachableNodes 使用沿传播方向的多源 BFS。
 * reachableEdges 取 BFS 的非回退边（toDistance >= fromDistance），并补入活跃的
 * 外部边界入边，便于详情模式展示“上游边界关系进入受影响子图”的连线；
 * 回边/成环边不会出现在详情中。
 */
function buildRiskSourceReachability(
  workspaceData: WorkspaceData,
  relationPropagations: RelationPropagation[],
  edges: RenderEdge[],
  enterpriseIds: Set<string>,
): Map<string, RiskSourceReachability> {
  const adjacency = new Map<string, PropagationEdge[]>()
  for (const item of relationPropagations) {
    for (const direction of item.directions) {
      const outgoing = adjacency.get(direction.from) ?? []
      outgoing.push(direction)
      adjacency.set(direction.from, outgoing)
    }
  }
  const edgeById = new Map(edges.map((edge) => [edge.id, edge]))
  const result = new Map<string, RiskSourceReachability>()

  for (const riskSource of workspaceData.riskSources) {
    const distances = new Map<string, number>()
    const queue: string[] = []

    for (const targetId of riskSource.targetEnterpriseIds) {
      if (!enterpriseIds.has(targetId) || distances.has(targetId)) continue
      distances.set(targetId, 0)
      queue.push(targetId)
    }

    for (let index = 0; index < queue.length; index += 1) {
      const nodeId = queue[index]
      const distance = distances.get(nodeId) ?? 0
      for (const edge of adjacency.get(nodeId) ?? []) {
        if (distances.has(edge.to)) continue
        distances.set(edge.to, distance + 1)
        queue.push(edge.to)
      }
    }

    const reachableEdges = new Set<string>()
    for (const item of relationPropagations) {
      let include = false
      for (const direction of item.directions) {
        const fromDistance = distances.get(direction.from)
        const toDistance = distances.get(direction.to)
        if (
          fromDistance !== undefined &&
          toDistance !== undefined &&
          toDistance >= fromDistance
        ) {
          include = true
          break
        }
        if (
          fromDistance === undefined &&
          toDistance !== undefined &&
          edgeById.get(direction.edgeId)?.active
        ) {
          include = true
          break
        }
      }
      if (include) reachableEdges.add(item.relation.id)
    }

    result.set(riskSource.id, {
      riskSourceId: riskSource.id,
      reachableNodes: new Set(distances.keys()),
      reachableEdges,
    })
  }

  return result
}

/**
 * 构建 2D RenderModel，并保留 Step3 推演引擎的逐源路径记录。
 *
 * - 风险源 impact 固定为 1.0（不使用 RiskSource.score）。
 * - 逐边传播：impact(v) = max over 入边 [impact(u) × association]。
 * - guarantee + mutual 关系双向传播；同控只生成 groups，不参与传播。
 * - 路径记录为每个开启风险源到每个可达企业的最佳路径。
 *
 * 纯函数：不依赖 Vue、Pinia、ECharts，也不修改传入数据。
 */
export function buildPropagation(
  workspaceData: WorkspaceData,
  activeRiskSourceIds: readonly string[],
): PropagationResult {
  const activeIds = new Set(activeRiskSourceIds)
  const enterpriseIds = new Set(
    workspaceData.enterprises.map((enterprise) => enterprise.id),
  )

  const relationPropagations: RelationPropagation[] = workspaceData.relations.map(
    (relation) => ({
      relation,
      directions: propagationDirections(relation).filter((edge) =>
        canPropagateTo(edge, enterpriseIds),
      ),
    }),
  )

  const propagationEdges = relationPropagations.flatMap(
    (item) => item.directions,
  )

  const { impacts, sourceNodeIds } = computeImpacts(
    workspaceData,
    activeIds,
    enterpriseIds,
    propagationEdges,
  )

  const nodes: RenderNode[] = workspaceData.enterprises.map((enterprise) => {
    const impact = roundImpact(impacts.get(enterprise.id) ?? 0)
    return {
      id: enterprise.id,
      name: enterprise.name,
      type: enterprise.type,
      impact,
      level: sourceNodeIds.has(enterprise.id)
        ? 'source'
        : levelFromImpact(impact),
      ...(enterprise.controllerGroup
        ? { controllerGroup: enterprise.controllerGroup }
        : {}),
      dimmed: false,
      highlighted: false,
    }
  })

  const edges = relationPropagations.map((item) => buildEdge(item, impacts))

  const groups: ControllerGroup[] =
    workspaceData.groups.length > 0
      ? workspaceData.groups.map((group) => ({
          ...group,
          members: [...group.members],
        }))
      : buildControllerGroups(workspaceData.enterprises)

  return {
    renderModel: { nodes, edges, groups },
    pathsByEnterprise: buildPropagationPaths(
      workspaceData,
      activeIds,
      enterpriseIds,
      propagationEdges,
    ),
    reachabilityByRiskSource: buildRiskSourceReachability(
      workspaceData,
      relationPropagations,
      edges,
      enterpriseIds,
    ),
  }
}

/** 兼容只消费 RenderModel 的调用方。 */
export function buildRenderModel(
  workspaceData: WorkspaceData,
  activeRiskSourceIds: readonly string[],
): RenderModel {
  return buildPropagation(workspaceData, activeRiskSourceIds).renderModel
}
