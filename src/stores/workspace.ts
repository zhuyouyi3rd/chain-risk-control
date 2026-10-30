import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import {
  applyEnterpriseFocus,
  applyReverseView,
  applyThresholdFilter,
  DEFAULT_THRESHOLD,
  type ThresholdFilter,
  type ThresholdOperator,
  type ThresholdScope,
} from '../core/focus'
import {
  buildPropagation,
  type RiskPropagationPath,
  type RiskSourceReachability,
} from '../core/graph'
import { RISK_LEVEL_LABELS } from '../core/labels'
import { createTestWorkspaceData } from '../core/testData'
import type {
  Enterprise,
  RenderNode,
  RiskLevel,
  WorkspaceData,
} from '../core/types'
import {
  buildControllerGroups,
  cloneWorkspaceData,
  countWorkspaceData,
  createEmptyWorkspaceData,
} from '../core/workspace'

export type WorkspaceSource = 'empty' | 'excel' | 'test'
export type EnterpriseAffectedFilter = 'all' | 'affected' | 'unaffected'
export type EnterpriseLevelFilter = 'all' | 'high' | 'medium' | 'low' | 'none'

export interface RiskSourceFocus {
  riskSourceId: string
  nodeIds: string[]
  edgeIds: string[]
}

export interface EnterpriseRow {
  enterprise: Enterprise
  node: RenderNode
}

export interface WorkspaceSummary {
  total: number
  riskSources: number
  enabledRiskSources: number
  sourceNodes: number
  affected: number
  high: number
  medium: number
  low: number
  none: number
}

export interface WorkspaceRecord {
  id: string
  name: string
  data: WorkspaceData
  source: WorkspaceSource
  sourceName: string
  loadedAt: number | null
  createdAt: number
  updatedAt: number
}

interface StoredWorkspaceState {
  version: number
  activeWorkspaceId: string
  workspaces: WorkspaceRecord[]
}

const STORAGE_KEY = 'chain-risk-control.workspaces.v1'
const STORAGE_VERSION = 1
let workspaceSequence = 0

function createWorkspaceId(): string {
  workspaceSequence += 1
  return `ws-${Date.now().toString(36)}-${workspaceSequence.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`
}

function isWorkspaceData(value: unknown): value is WorkspaceData {
  if (!value || typeof value !== 'object') return false
  const data = value as Partial<WorkspaceData>
  return (
    Array.isArray(data.enterprises) &&
    Array.isArray(data.relations) &&
    Array.isArray(data.riskSources) &&
    Array.isArray(data.groups) &&
    data.riskSources.every((source) =>
      Array.isArray(source.targetEnterpriseIds),
    ) &&
    data.groups.every((group) => Array.isArray(group.members))
  )
}

function normalizeSource(value: unknown): WorkspaceSource {
  return value === 'excel' || value === 'test' || value === 'empty'
    ? value
    : 'empty'
}

function normalizeStoredRecord(value: unknown): WorkspaceRecord | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  if (typeof raw.id !== 'string' || typeof raw.name !== 'string') return null
  if (!isWorkspaceData(raw.data)) return null
  const now = Date.now()
  return {
    id: raw.id,
    name: raw.name.trim() || '未命名工作区',
    data: cloneWorkspaceData(raw.data),
    source: normalizeSource(raw.source),
    sourceName: typeof raw.sourceName === 'string' ? raw.sourceName : '',
    loadedAt: typeof raw.loadedAt === 'number' ? raw.loadedAt : null,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : now,
  }
}

function readStoredState(): StoredWorkspaceState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredWorkspaceState>
    if (
      parsed.version !== STORAGE_VERSION ||
      !Array.isArray(parsed.workspaces)
    ) {
      return null
    }
    const workspaces = parsed.workspaces
      .map((record) => normalizeStoredRecord(record))
      .filter((record): record is WorkspaceRecord => record !== null)
    if (workspaces.length === 0) return null
    const activeWorkspaceId = workspaces.some(
      (record) => record.id === parsed.activeWorkspaceId,
    )
      ? (parsed.activeWorkspaceId as string)
      : workspaces[0].id
    return {
      version: STORAGE_VERSION,
      activeWorkspaceId,
      workspaces,
    }
  } catch {
    return null
  }
}

function createWorkspaceRecord(
  name: string,
  data: WorkspaceData = createEmptyWorkspaceData(),
): WorkspaceRecord {
  const now = Date.now()
  return {
    id: createWorkspaceId(),
    name,
    data: cloneWorkspaceData(data),
    source: 'empty',
    sourceName: '',
    loadedAt: null,
    createdAt: now,
    updatedAt: now,
  }
}

export const useWorkspaceStore = defineStore('workspace', () => {
  const stored = readStoredState()
  const workspaces = ref<WorkspaceRecord[]>(
    stored?.workspaces ?? [createWorkspaceRecord('默认工作区')],
  )
  const activeWorkspaceId = ref(
    stored?.activeWorkspaceId ?? workspaces.value[0].id,
  )

  const enterpriseQuery = ref('')
  const affectedFilter = ref<EnterpriseAffectedFilter>('all')
  const levelFilter = ref<EnterpriseLevelFilter>('all')
  const selectedEnterpriseId = ref<string | null>(null)
  const detailEnterpriseId = ref<string | null>(null)
  const selectedRiskSourceId = ref<string | null>(null)
  const thresholdEnabled = ref(DEFAULT_THRESHOLD.enabled)
  const thresholdValue = ref(DEFAULT_THRESHOLD.value)
  const thresholdOperator = ref<ThresholdOperator>(DEFAULT_THRESHOLD.operator)
  const thresholdScope = ref<ThresholdScope>(DEFAULT_THRESHOLD.scope)
  const reverseView = ref(false)

  const activeWorkspace = computed<WorkspaceRecord>(
    () =>
      workspaces.value.find(
        (workspace) => workspace.id === activeWorkspaceId.value,
      ) ?? workspaces.value[0],
  )
  const activeWorkspaceName = computed(() => activeWorkspace.value.name)
  const workspaceCount = computed(() => workspaces.value.length)
  const data = computed(() => activeWorkspace.value.data)
  const source = computed(() => activeWorkspace.value.source)
  const sourceName = computed(() => activeWorkspace.value.sourceName)
  const loadedAt = computed(() => activeWorkspace.value.loadedAt)

  const counts = computed(() => countWorkspaceData(data.value))
  const isLoaded = computed(
    () =>
      data.value.enterprises.length > 0 ||
      data.value.relations.length > 0 ||
      data.value.riskSources.length > 0,
  )
  const sourceLabel = computed(() => {
    if (source.value === 'excel') return 'Excel 导入'
    if (source.value === 'test') return '测试数据集'
    return '尚未载入'
  })

  const activeRiskSourceIds = computed(() =>
    data.value.riskSources
      .filter((riskSource) => riskSource.enabled)
      .map((riskSource) => riskSource.id),
  )

  const thresholdFilter = computed<ThresholdFilter>(() => ({
    enabled: thresholdEnabled.value,
    value: thresholdValue.value,
    operator: thresholdOperator.value,
    scope: thresholdScope.value,
  }))

  const propagation = computed(() =>
    buildPropagation(data.value, activeRiskSourceIds.value),
  )

  const baseRenderModel = computed(() => propagation.value.renderModel)

  // 交互状态 -> RenderModel：先聚焦，再叠加阈值虚化。图组件保持被动。
  const focusedRenderModel = computed(() =>
    applyEnterpriseFocus(baseRenderModel.value, selectedEnterpriseId.value),
  )
  const thresholdRenderModel = computed(() =>
    applyThresholdFilter(focusedRenderModel.value, thresholdFilter.value),
  )
  const reverseRenderModel = computed(() =>
    applyEnterpriseFocus(
      applyReverseView(baseRenderModel.value),
      selectedEnterpriseId.value,
    ),
  )
  const renderModel = computed(() =>
    reverseView.value
      ? reverseRenderModel.value
      : thresholdRenderModel.value,
  )

  const selectedRiskSource = computed(
    () =>
      data.value.riskSources.find(
        (riskSource) => riskSource.id === selectedRiskSourceId.value,
      ) ?? null,
  )

  const selectedRiskSourceReachability =
    computed<RiskSourceReachability | null>(() => {
      if (!selectedRiskSourceId.value) return null
      return (
        propagation.value.reachabilityByRiskSource.get(
          selectedRiskSourceId.value,
        ) ?? null
      )
    })

  const riskSourceFocus = computed<RiskSourceFocus | null>(() => {
    const reachability = selectedRiskSourceReachability.value
    if (!selectedRiskSourceId.value || !reachability) return null
    return {
      riskSourceId: selectedRiskSourceId.value,
      nodeIds: [...reachability.reachableNodes].sort(),
      edgeIds: [...reachability.reachableEdges].sort(),
    }
  })

  const allEnterpriseRows = computed<EnterpriseRow[]>(() => {
    const nodesById = new Map(
      renderModel.value.nodes.map((node) => [node.id, node]),
    )
    return data.value.enterprises.flatMap((enterprise) => {
      const node = nodesById.get(enterprise.id)
      return node ? [{ enterprise, node }] : []
    })
  })

  const filteredEnterpriseRows = computed<EnterpriseRow[]>(() => {
    const query = enterpriseQuery.value.trim().toLowerCase()

    return allEnterpriseRows.value.filter(({ enterprise, node }) => {
      const hasRisk = node.level !== 'none'
      if (affectedFilter.value === 'affected' && !hasRisk) return false
      if (affectedFilter.value === 'unaffected' && hasRisk) return false
      if (levelFilter.value !== 'all' && node.level !== levelFilter.value) {
        return false
      }

      if (!query) return true
      const levelText =
        `${RISK_LEVEL_LABELS[node.level]} ${RISK_LEVEL_LABELS[node.level]}风险 ${node.level}`.toLowerCase()
      return (
        enterprise.name.toLowerCase().includes(query) ||
        enterprise.id.toLowerCase().includes(query) ||
        levelText.includes(query)
      )
    })
  })

  const riskEnterpriseRows = computed<EnterpriseRow[]>(() =>
    allEnterpriseRows.value
      .filter(({ node }) => node.level !== 'none')
      .sort(
        (left, right) =>
          right.node.impact - left.node.impact ||
          left.enterprise.id.localeCompare(right.enterprise.id),
      ),
  )

  const safeEnterpriseRows = computed<EnterpriseRow[]>(() =>
    allEnterpriseRows.value.filter(({ node }) => node.level === 'none'),
  )

  const summary = computed<WorkspaceSummary>(() => {
    const nodes = renderModel.value.nodes
    const levels: Record<RiskLevel, number> = {
      none: 0,
      low: 0,
      medium: 0,
      high: 0,
      source: 0,
    }
    for (const node of nodes) levels[node.level] += 1

    return {
      total: nodes.length,
      riskSources: counts.value.riskSources,
      enabledRiskSources: counts.value.enabledRiskSources,
      sourceNodes: levels.source,
      affected: levels.low + levels.medium + levels.high + levels.source,
      high: levels.high,
      medium: levels.medium,
      low: levels.low,
      none: levels.none,
    }
  })

  const selectedEnterpriseName = computed(
    () =>
      data.value.enterprises.find(
        (enterprise) => enterprise.id === selectedEnterpriseId.value,
      )?.name ?? '',
  )

  const detailRow = computed<EnterpriseRow | null>(
    () =>
      allEnterpriseRows.value.find(
        (row) => row.enterprise.id === detailEnterpriseId.value,
      ) ?? null,
  )

  const detailPaths = computed<RiskPropagationPath[]>(() => {
    if (!detailEnterpriseId.value) return []
    const paths = propagation.value.pathsByEnterprise.get(
      detailEnterpriseId.value,
    ) ?? []
    return [...paths].sort(
      (left, right) =>
        right.impact - left.impact ||
        left.riskSourceId.localeCompare(right.riskSourceId),
    )
  })

  if (typeof window !== 'undefined') {
    watch(
      [workspaces, activeWorkspaceId],
      () => {
        try {
          const payload: StoredWorkspaceState = {
            version: STORAGE_VERSION,
            activeWorkspaceId: activeWorkspaceId.value,
            workspaces: workspaces.value,
          }
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
        } catch {
          // Storage may be unavailable or full; the in-memory workspace still works.
        }
      },
      { deep: true, immediate: true },
    )
  }

  function resetViewState() {
    enterpriseQuery.value = ''
    affectedFilter.value = 'all'
    levelFilter.value = 'all'
    selectedEnterpriseId.value = null
    detailEnterpriseId.value = null
    selectedRiskSourceId.value = null
    thresholdEnabled.value = DEFAULT_THRESHOLD.enabled
    thresholdValue.value = DEFAULT_THRESHOLD.value
    thresholdOperator.value = DEFAULT_THRESHOLD.operator
    thresholdScope.value = DEFAULT_THRESHOLD.scope
    reverseView.value = false
  }

  function nextWorkspaceName(): string {
    let index = workspaces.value.length + 1
    const names = new Set(workspaces.value.map((workspace) => workspace.name))
    while (names.has(`工作区 ${index}`)) index += 1
    return `工作区 ${index}`
  }

  function replaceActiveData(
    next: WorkspaceData,
    meta: { source: WorkspaceSource; sourceName: string },
  ) {
    const workspace = activeWorkspace.value
    workspace.data = cloneWorkspaceData(next)
    workspace.source = meta.source
    workspace.sourceName = meta.sourceName
    workspace.loadedAt = Date.now()
    workspace.updatedAt = Date.now()
    resetViewState()
  }

  function loadExcelData(next: WorkspaceData, fileName: string) {
    replaceActiveData(next, { source: 'excel', sourceName: fileName })
  }

  function loadTestData() {
    const next = createTestWorkspaceData()
    replaceActiveData(next, { source: 'test', sourceName: '内置测试数据集' })
    return next
  }

  function clearData() {
    const workspace = activeWorkspace.value
    workspace.data = createEmptyWorkspaceData()
    workspace.source = 'empty'
    workspace.sourceName = ''
    workspace.loadedAt = null
    workspace.updatedAt = Date.now()
    resetViewState()
  }

  const resetActiveWorkspace = clearData

  function createWorkspace(name?: string): WorkspaceRecord {
    const record = createWorkspaceRecord(name?.trim() || nextWorkspaceName())
    workspaces.value.push(record)
    activeWorkspaceId.value = record.id
    resetViewState()
    return record
  }

  function switchWorkspace(workspaceId: string): boolean {
    if (workspaceId === activeWorkspaceId.value) return true
    if (!workspaces.value.some((workspace) => workspace.id === workspaceId)) {
      return false
    }
    activeWorkspaceId.value = workspaceId
    resetViewState()
    return true
  }

  function renameWorkspace(workspaceId: string, name: string): boolean {
    const workspace = workspaces.value.find(
      (item) => item.id === workspaceId,
    )
    const trimmed = name.trim()
    if (!workspace || !trimmed) return false
    workspace.name = trimmed
    workspace.updatedAt = Date.now()
    return true
  }

  function deleteWorkspace(workspaceId: string): boolean {
    if (workspaces.value.length <= 1) return false
    const index = workspaces.value.findIndex(
      (workspace) => workspace.id === workspaceId,
    )
    if (index < 0) return false

    workspaces.value.splice(index, 1)
    if (activeWorkspaceId.value === workspaceId) {
      const nextWorkspace =
        workspaces.value[Math.min(index, workspaces.value.length - 1)]
      activeWorkspaceId.value = nextWorkspace.id
      resetViewState()
    }
    return true
  }

  function setRiskSourceEnabled(riskSourceId: string, enabled: boolean) {
    const riskSource = data.value.riskSources.find(
      (source) => source.id === riskSourceId,
    )
    if (!riskSource || riskSource.enabled === enabled) return
    riskSource.enabled = enabled
    if (!enabled && selectedRiskSourceId.value === riskSourceId) {
      selectedRiskSourceId.value = null
    }
    activeWorkspace.value.updatedAt = Date.now()
  }

  function toggleRiskSource(riskSourceId: string) {
    const riskSource = data.value.riskSources.find(
      (source) => source.id === riskSourceId,
    )
    if (!riskSource) return
    riskSource.enabled = !riskSource.enabled
    if (!riskSource.enabled && selectedRiskSourceId.value === riskSourceId) {
      selectedRiskSourceId.value = null
    }
    activeWorkspace.value.updatedAt = Date.now()
  }

  function setEnterpriseQuery(value: string) {
    enterpriseQuery.value = value
  }

  function setAffectedFilter(value: EnterpriseAffectedFilter) {
    affectedFilter.value = value
  }

  function setLevelFilter(value: EnterpriseLevelFilter) {
    levelFilter.value = value
  }

  function resetEnterpriseFilters() {
    enterpriseQuery.value = ''
    affectedFilter.value = 'all'
    levelFilter.value = 'all'
  }

  function toggleEnterpriseFocus(enterpriseId: string) {
    const node = baseRenderModel.value.nodes.find(
      (item) => item.id === enterpriseId,
    )
    if (!node) return
    if (reverseView.value && node.impact > 0) return
    selectedRiskSourceId.value = null
    if (selectedEnterpriseId.value === enterpriseId) {
      selectedEnterpriseId.value = null
      if (detailEnterpriseId.value === enterpriseId) {
        detailEnterpriseId.value = null
      }
      return
    }
    selectedEnterpriseId.value = enterpriseId
    if (
      detailEnterpriseId.value &&
      detailEnterpriseId.value !== enterpriseId
    ) {
      detailEnterpriseId.value = null
    }
  }

  function clearEnterpriseFocus() {
    selectedEnterpriseId.value = null
    detailEnterpriseId.value = null
    selectedRiskSourceId.value = null
  }

  function openRiskSourceDetail(riskSourceId: string): boolean {
    const riskSource = data.value.riskSources.find(
      (source) => source.id === riskSourceId,
    )
    if (!riskSource) return false
    selectedRiskSourceId.value = riskSourceId
    selectedEnterpriseId.value = null
    detailEnterpriseId.value = null
    reverseView.value = false
    return true
  }

  function closeRiskSourceDetail() {
    selectedRiskSourceId.value = null
  }

  function openEnterpriseDetail(enterpriseId: string) {
    const node = baseRenderModel.value.nodes.find(
      (item) => item.id === enterpriseId,
    )
    if (!node) return
    if (reverseView.value && node.impact > 0) return
    selectedRiskSourceId.value = null
    detailEnterpriseId.value = enterpriseId
    selectedEnterpriseId.value = enterpriseId
  }

  function closeEnterpriseDetail() {
    detailEnterpriseId.value = null
    selectedEnterpriseId.value = null
  }

  function setThresholdEnabled(enabled: boolean) {
    if (enabled && reverseView.value) return
    thresholdEnabled.value = enabled
  }

  function setThresholdValue(value: number) {
    thresholdValue.value = Math.min(1, Math.max(0, value))
  }

  function setThresholdOperator(operator: ThresholdOperator) {
    thresholdOperator.value = operator
  }

  function setThresholdScope(scope: ThresholdScope) {
    thresholdScope.value = scope
  }

  function setReverseView(enabled: boolean) {
    if (enabled === reverseView.value) return
    reverseView.value = enabled
    if (enabled) {
      selectedEnterpriseId.value = null
      detailEnterpriseId.value = null
      selectedRiskSourceId.value = null
      thresholdEnabled.value = false
    }
  }

  function toggleReverseView() {
    setReverseView(!reverseView.value)
  }

  /**
   * 删除企业时同步清理：
   * - 以该企业为起终点的关系；
   * - 以该企业为 target 的风险源（按需求整条删除）；
   * - 重新生成同控组；
   * - 清空已被删除企业的聚焦/详情状态。
   */
  function deleteEnterprise(enterpriseId: string) {
    if (!data.value.enterprises.some((enterprise) => enterprise.id === enterpriseId)) {
      return
    }

    const enterprises = data.value.enterprises.filter(
      (enterprise) => enterprise.id !== enterpriseId,
    )
    activeWorkspace.value.data = {
      enterprises,
      relations: data.value.relations.filter(
        (relation) =>
          relation.from !== enterpriseId && relation.to !== enterpriseId,
      ),
      riskSources: data.value.riskSources.filter(
        (riskSource) =>
          !riskSource.targetEnterpriseIds.includes(enterpriseId),
      ),
      groups: buildControllerGroups(enterprises),
    }
    activeWorkspace.value.updatedAt = Date.now()

    if (selectedEnterpriseId.value === enterpriseId) {
      selectedEnterpriseId.value = null
    }
    if (detailEnterpriseId.value === enterpriseId) {
      detailEnterpriseId.value = null
    }
    if (
      selectedRiskSourceId.value &&
      !data.value.riskSources.some(
        (source) => source.id === selectedRiskSourceId.value,
      )
    ) {
      selectedRiskSourceId.value = null
    }
  }

  return {
    workspaces,
    activeWorkspaceId,
    activeWorkspaceName,
    workspaceCount,
    data,
    source,
    sourceName,
    loadedAt,
    counts,
    isLoaded,
    sourceLabel,
    activeRiskSourceIds,
    propagation,
    renderModel,
    enterpriseQuery,
    affectedFilter,
    levelFilter,
    selectedEnterpriseId,
    selectedEnterpriseName,
    detailEnterpriseId,
    detailRow,
    detailPaths,
    selectedRiskSourceId,
    selectedRiskSource,
    selectedRiskSourceReachability,
    riskSourceFocus,
    thresholdEnabled,
    thresholdValue,
    thresholdOperator,
    thresholdScope,
    reverseView,
    allEnterpriseRows,
    filteredEnterpriseRows,
    riskEnterpriseRows,
    safeEnterpriseRows,
    summary,
    loadExcelData,
    loadTestData,
    clearData,
    resetActiveWorkspace,
    createWorkspace,
    switchWorkspace,
    renameWorkspace,
    deleteWorkspace,
    setRiskSourceEnabled,
    toggleRiskSource,
    setEnterpriseQuery,
    setAffectedFilter,
    setLevelFilter,
    resetEnterpriseFilters,
    toggleEnterpriseFocus,
    clearEnterpriseFocus,
    openRiskSourceDetail,
    closeRiskSourceDetail,
    openEnterpriseDetail,
    closeEnterpriseDetail,
    setThresholdEnabled,
    setThresholdValue,
    setThresholdOperator,
    setThresholdScope,
    setReverseView,
    toggleReverseView,
    deleteEnterprise,
  }
})
