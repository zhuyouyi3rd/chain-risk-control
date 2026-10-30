import type { RenderModel } from './types'

export type ThresholdOperator = 'gt' | 'lt'
export type ThresholdScope = 'all' | 'affected'

export interface ThresholdFilter {
  enabled: boolean
  value: number
  operator: ThresholdOperator
  scope: ThresholdScope
}

export const DEFAULT_THRESHOLD: ThresholdFilter = {
  enabled: false,
  value: 0.5,
  operator: 'gt',
  scope: 'all',
}

/**
 * 把“单点聚焦”转换成 RenderModel 的 dimmed / highlighted 字段。
 * 高亮选中企业、它的直接邻居企业，以及它们之间的直接关联边。
 */
export function applyEnterpriseFocus(
  model: RenderModel,
  enterpriseId: string | null,
): RenderModel {
  if (!enterpriseId) return model
  if (!model.nodes.some((node) => node.id === enterpriseId)) return model

  const relatedEdges = model.edges.filter(
    (edge) => edge.from === enterpriseId || edge.to === enterpriseId,
  )
  const relatedEdgeIds = new Set(relatedEdges.map((edge) => edge.id))
  const activeNodeIds = new Set<string>([enterpriseId])
  for (const edge of relatedEdges) {
    activeNodeIds.add(edge.from === enterpriseId ? edge.to : edge.from)
  }

  return {
    nodes: model.nodes.map((node) => ({
      ...node,
      dimmed: !activeNodeIds.has(node.id),
      highlighted: node.id === enterpriseId,
    })),
    edges: model.edges.map((edge) => {
      const related = relatedEdgeIds.has(edge.id)
      return {
        ...edge,
        dimmed: !related,
        highlighted: related,
      }
    }),
    groups: model.groups,
    ...(model.viewMode ? { viewMode: model.viewMode } : {}),
  }
}

/**
 * 阈值筛选只修改 dimmed，不删除节点/边。
 * 边只有在两端都通过阈值时才保持实显。
 */
export function applyThresholdFilter(
  model: RenderModel,
  filter: ThresholdFilter,
): RenderModel {
  if (!filter.enabled) return model

  const passByNode = new Map<string, boolean>()
  for (const node of model.nodes) {
    const inScope = filter.scope === 'all' || node.impact > 0
    const comparable =
      filter.operator === 'gt'
        ? node.impact > filter.value
        : node.impact < filter.value
    passByNode.set(node.id, inScope && comparable)
  }

  return {
    nodes: model.nodes.map((node) => ({
      ...node,
      dimmed: node.dimmed || !passByNode.get(node.id),
    })),
    edges: model.edges.map((edge) => ({
      ...edge,
      dimmed:
        edge.dimmed ||
        !passByNode.get(edge.from) ||
        !passByNode.get(edge.to),
    })),
    groups: model.groups,
    ...(model.viewMode ? { viewMode: model.viewMode } : {}),
  }
}

/**
 * 2D 反选视图：只保留 impact=0 的企业，以及它们之间的常态关系。
 * 不删除数据，通过 dimmed 隐藏风险实体；渲染层据此使用安全关系色。
 */
export function applyReverseView(model: RenderModel): RenderModel {
  const safeNodeIds = new Set(
    model.nodes
      .filter((node) => node.impact === 0)
      .map((node) => node.id),
  )

  return {
    viewMode: 'reverse',
    nodes: model.nodes.map((node) => ({
      ...node,
      dimmed: !safeNodeIds.has(node.id),
      highlighted: false,
    })),
    edges: model.edges.map((edge) => ({
      ...edge,
      dimmed: !(
        safeNodeIds.has(edge.from) &&
        safeNodeIds.has(edge.to) &&
        !edge.active
      ),
      highlighted: false,
    })),
    groups: model.groups,
  }
}

