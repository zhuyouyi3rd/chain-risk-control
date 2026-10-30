/**
 * 数据层、渲染层与推演层共用的类型契约。
 * 本文件只包含类型，不依赖 Vue、ECharts 或任何渲染库。
 * 企业 / 关系 / 风险源为 Step 2 导入结构；RenderModel 为后续渲染契约。
 */

export type EnterpriseType =
  | 'raw_material'
  | 'warehouse'
  | 'workshop'
  | 'trading'
  | 'service'
  | 'finance'

export type RiskLevel = 'none' | 'low' | 'medium' | 'high' | 'source'

export type RelationCategory = 'material' | 'capital' | 'tech' | 'guarantee'

export type RiskSourceType = RelationCategory | 'control'

/** 企业原始档案，与 RenderNode 的 id/name/type/controllerGroup 对齐。 */
export interface Enterprise {
  id: string
  name: string
  type: EnterpriseType
  region?: string
  metrics?: string
  controllerGroup?: string
  controllerName?: string
}

/** 企业间关系，与 RenderEdge 的 id/from/to/category/association 对齐。 */
export interface Relation {
  id: string
  from: string
  to: string
  category: RelationCategory
  association: number
  subtype?: string
  mutual: boolean
}

export interface RiskSource {
  id: string
  name: string
  type: RiskSourceType
  targetEnterpriseIds: string[]
  score: number
  enabled: boolean
}

export interface ControllerGroup {
  controllerId: string
  controllerName?: string
  members: string[]
}

/** 一个工作区对应一个完整产业链实例。 */
export interface WorkspaceData {
  enterprises: Enterprise[]
  relations: Relation[]
  riskSources: RiskSource[]
  groups: ControllerGroup[]
}

export interface RenderNode {
  id: string
  name: string
  type: EnterpriseType
  impact: number
  level: RiskLevel
  controllerGroup?: string
  dimmed: boolean
  highlighted: boolean
}

export interface RenderEdge {
  id: string
  from: string
  to: string
  category: RelationCategory
  association: number
  active: boolean
  riskLevel: RiskLevel
  /** 互保关系需要双箭头或双向曲线；仅渲染层使用。 */
  mutual?: boolean
  dimmed: boolean
  highlighted: boolean
}

export interface RenderModel {
  nodes: RenderNode[]
  edges: RenderEdge[]
  groups: ControllerGroup[]
  /** 渲染视图：默认风险视图 / 反选安全企业视图。 */
  viewMode?: 'default' | 'reverse'
}
