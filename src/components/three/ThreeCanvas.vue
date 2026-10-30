<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ENTERPRISE_TYPE_LABELS, RISK_LEVEL_LABELS } from '../../core/labels'
import type {
  Enterprise,
  EnterpriseType,
  RelationCategory,
  RenderEdge,
  RenderNode,
  RiskSource,
} from '../../core/types'
import type { RiskSourceFocus } from '../../stores/workspace'
import type { RelationLayer } from '../../stores/layout'
import {
  ThreeScene,
  type EnterpriseHoverPayload,
  type RelationHoverPayload,
  type ThreeSceneProgress,
} from '../../render3d/ThreeScene'

const ENTERPRISE_TYPE_DETAIL_LABELS: Record<EnterpriseType, string> = {
  raw_material: '原料坊（原材料企业）',
  warehouse: '仓储（仓储物流企业）',
  workshop: '工坊（生产加工企业）',
  trading: '商行（商贸企业）',
  service: '驿站（服务企业）',
  finance: '金融机构（金融服务企业）',
}

const props = defineProps<{
  enterprises: Enterprise[]
  nodes: RenderNode[]
  edges: RenderEdge[]
  riskSources: RiskSource[]
  riskSourceFocus: RiskSourceFocus | null
  selectedEnterpriseId?: string | null
  layers: Record<RelationLayer, boolean>
}>()

const emit = defineEmits<{
  (event: 'risk-source-click', riskSourceId: string): void
  (event: 'enterprise-click', enterpriseId: string): void
  (event: 'background-click'): void
  (event: 'overview'): void
}>()

const RELATION_DISPLAY_LABELS: Record<RelationCategory, string> = {
  material: '物料流',
  capital: '资金流',
  tech: '技术/服务流',
  guarantee: '担保',
}

const RELATION_MIDDLE_LABELS: Record<RelationCategory, string> = {
  material: '原材料供应',
  capital: '资金往来',
  tech: '技术服务',
  guarantee: '担保关系',
}

const host = ref<HTMLDivElement | null>(null)
const ready = ref(false)
const errorMessage = ref('')
const progress = ref<ThreeSceneProgress>({
  loaded: 0,
  total: 0,
  type: 'raw_material',
  fileProgress: 0,
})
const bridgeLog = ref<string[]>([])
const hoveredRelation = ref<RelationHoverPayload | null>(null)
const hoveredNode = ref<EnterpriseHoverPayload | null>(null)

let scene: ThreeScene | null = null
let mounted = false
let generation = 0

const enterpriseNames = computed(
  () =>
    new Map(
      props.enterprises.map((enterprise) => [
        enterprise.id,
        enterprise.name,
      ]),
    ),
)

const enterpriseById = computed(
  () =>
    new Map(
      props.enterprises.map((enterprise) => [
        enterprise.id,
        enterprise,
      ]),
    ),
)

const nodeById = computed(
  () => new Map(props.nodes.map((node) => [node.id, node])),
)

const enterpriseImpacts = computed(
  () =>
    new Map(
      props.nodes.map((node) => [node.id, node.impact]),
    ),
)

const hoveredEdge = computed(() => {
  const hover = hoveredRelation.value
  if (!hover) return null
  return props.edges.find((edge) => edge.id === hover.edgeId) ?? null
})

const tooltip = computed(() => {
  const edge = hoveredEdge.value
  if (!edge) return null
  const fromName = enterpriseNames.value.get(edge.from) ?? edge.from
  const toName = enterpriseNames.value.get(edge.to) ?? edge.to
  const impact = enterpriseImpacts.value.get(edge.to) ?? 0
  const category = RELATION_DISPLAY_LABELS[edge.category]
  const middle =
    edge.category === 'guarantee' && edge.mutual
      ? '互保'
      : RELATION_MIDDLE_LABELS[edge.category]
  return {
    title: `${category} · ${middle}`,
    route: `${fromName} → ${toName}`,
    association: edge.association.toFixed(2),
    risk: edge.active
      ? `风险传导：高风险（impact ${impact.toFixed(2)}）`
      : '无风险传导',
    safe: !edge.active,
  }
})

const tooltipStyle = computed(() => {
  const hover = hoveredRelation.value
  if (!hover || typeof window === 'undefined') return {}
  const width = 300
  const height = 142
  const offset = 12
  let x = hover.clientX + offset
  let y = hover.clientY + offset
  if (x + width > window.innerWidth - 8) {
    x = hover.clientX - offset - width
  }
  if (y + height > window.innerHeight - 8) {
    y = hover.clientY - offset - height
  }
  return {
    left: `${Math.max(8, x)}px`,
    top: `${Math.max(8, y)}px`,
  }
})

const nodeTooltip = computed(() => {
  const hover = hoveredNode.value
  if (!hover) return null
  const enterprise = enterpriseById.value.get(hover.enterpriseId)
  const node = nodeById.value.get(hover.enterpriseId)
  if (!enterprise || !node) return null
  const controller = node.controllerGroup
    ? `${enterprise.controllerName ?? '同控'}（${node.controllerGroup}）`
    : null
  return {
    name: node.name || enterprise.name,
    type:
      ENTERPRISE_TYPE_DETAIL_LABELS[enterprise.type] ??
      ENTERPRISE_TYPE_LABELS[enterprise.type],
    level: RISK_LEVEL_LABELS[node.level],
    impact: node.impact.toFixed(2),
    controller,
  }
})

const nodeTooltipStyle = computed(() => {
  const hover = hoveredNode.value
  if (!hover || typeof window === 'undefined') return {}
  const width = 300
  const height = 160
  const offset = 12
  let x = hover.clientX + offset
  let y = hover.clientY + offset
  if (x + width > window.innerWidth - 8) {
    x = hover.clientX - offset - width
  }
  if (y + height > window.innerHeight - 8) {
    y = hover.clientY - offset - height
  }
  return {
    left: `${Math.max(8, x)}px`,
    top: `${Math.max(8, y)}px`,
  }
})

const signature = computed(() =>
  props.enterprises.map((enterprise) => `${enterprise.id}:${enterprise.type}`).join('|'),
)

const relationCount = computed(
  () =>
    props.edges.filter(
      (edge) =>
        edge.category === 'material' || edge.category === 'capital',
    ).length,
)

const percent = computed(() => {
  if (progress.value.total <= 0) return 0
  return Math.min(
    100,
    Math.round(
      ((progress.value.loaded + progress.value.fileProgress) /
        progress.value.total) *
        100,
    ),
  )
})

const progressLabel = computed(() => {
  if (progress.value.total <= 0) return '正在初始化 WebGL 场景'
  const typeLabel = ENTERPRISE_TYPE_LABELS[progress.value.type]
  return `正在加载${typeLabel}模型 · ${progress.value.loaded}/${progress.value.total}`
})

function resetView(): void {
  hoveredNode.value = null
  hoveredRelation.value = null
  scene?.resetView()
}

function showOverview(): void {
  emit('overview')
}

async function initialize() {
  const token = ++generation
  scene?.dispose()
  scene = null
  ready.value = false
  errorMessage.value = ''
  bridgeLog.value = []
  hoveredRelation.value = null
  hoveredNode.value = null
  progress.value = {
    loaded: 0,
    total: 0,
    type: 'raw_material',
    fileProgress: 0,
  }

  await nextTick()
  if (token !== generation || !host.value) return

  let nextScene: ThreeScene | null = null
  try {
    nextScene = new ThreeScene({
      container: host.value,
      onProgress: (nextProgress) => {
        if (token !== generation) return
        progress.value = nextProgress
      },
      onRelationHover: (payload) => {
        if (token !== generation) return
        if (payload) hoveredNode.value = null
        hoveredRelation.value = payload
      },
      onEnterpriseHover: (payload) => {
        if (token !== generation) return
        hoveredNode.value = payload
        if (payload) hoveredRelation.value = null
      },
      onEnterpriseClick: (enterpriseId) => {
        if (token !== generation) return
        const source = props.riskSources.find((riskSource) =>
          riskSource.targetEnterpriseIds.includes(enterpriseId),
        )
        if (source) emit('risk-source-click', source.id)
        else emit('enterprise-click', enterpriseId)
      },
      onBackgroundClick: () => {
        if (token !== generation) return
        emit('background-click')
      },
    })
    scene = nextScene
    await nextScene.load(props.enterprises, props.edges, props.nodes)
    if (token !== generation) {
      nextScene.dispose()
      return
    }
    nextScene.updateRelations(props.edges)
    nextScene.setLayerVisibility(props.layers)
    nextScene.setEnterpriseFocus(props.selectedEnterpriseId ?? null)
    if (props.riskSourceFocus) {
      nextScene.setRiskSourceFilter(
        props.riskSourceFocus.nodeIds,
        props.riskSourceFocus.edgeIds,
      )
    }
    bridgeLog.value = [...nextScene.getRelationBridgeLog()]
    ready.value = true
    if (import.meta.env.DEV) {
      ;(
        window as Window & { __DSH_THREE_SCENE__?: ThreeScene }
      ).__DSH_THREE_SCENE__ = nextScene
    }
  } catch (error) {
    if (token !== generation) return
    nextScene?.dispose()
    if (scene === nextScene) scene = null
    errorMessage.value =
      error instanceof Error
        ? error.message
        : '无法加载 3D 模型，请检查 GLB 文件是否可访问。'
  }
}

watch(signature, () => {
  if (mounted) void initialize()
})

watch(
  () => props.edges,
  (edges) => {
    if (ready.value && scene) {
      hoveredRelation.value = null
      hoveredNode.value = null
      scene.updateRelations(edges)
      bridgeLog.value = [...scene.getRelationBridgeLog()]
    }
  },
  { deep: true },
)

watch(
  () => props.nodes,
  (nodes) => {
    if (ready.value && scene) {
      scene.updateNodeLevels(nodes)
    }
  },
  { deep: true },
)

watch(
  () => props.riskSourceFocus,
  (focus) => {
    if (ready.value && scene) {
      scene.setRiskSourceFilter(
        focus?.nodeIds ?? null,
        focus?.edgeIds ?? null,
      )
    }
  },
  { deep: true },
)

watch(
  () => props.selectedEnterpriseId,
  (enterpriseId) => {
    if (ready.value && scene) {
      scene.setEnterpriseFocus(enterpriseId ?? null)
    }
  },
)

watch(
  () => props.layers,
  (layers) => {
    if (ready.value && scene) {
      scene.setLayerVisibility(layers)
    }
  },
  { deep: true },
)

onMounted(() => {
  mounted = true
  void initialize()
})

onBeforeUnmount(() => {
  mounted = false
  generation += 1
  hoveredRelation.value = null
  hoveredNode.value = null
  scene?.dispose()
  scene = null
})
</script>

<template>
  <div
    ref="host"
    class="three-canvas"
    :class="{
      'is-hovering-relation': Boolean(hoveredRelation),
      'is-hovering-node': Boolean(hoveredNode),
    }"
    :data-three-ready="ready ? 'true' : 'false'"
    :data-three-node-count="enterprises.length"
    :data-three-relation-count="relationCount"
    :data-three-progress="percent"
  >
    <div v-if="!ready" class="three-loading" aria-live="polite">
      <span class="three-loading__orbit" aria-hidden="true">
        <span></span>
      </span>
      <strong>
        {{ errorMessage ? '3D 场景加载失败' : '正在加载 3D 场景' }}
      </strong>
      <p v-if="errorMessage" class="three-loading__error">
        {{ errorMessage }}
      </p>
      <p v-else class="three-loading__status">{{ progressLabel }}</p>
      <div
        v-if="!errorMessage"
        class="three-loading__track"
        role="progressbar"
        :aria-valuenow="percent"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <span :style="{ width: `${percent}%` }"></span>
      </div>
      <small v-if="!errorMessage">首次加载六类 GLB 模型，请稍候</small>
    </div>

    <div v-else class="three-hint">
      <span class="three-hint__mark" aria-hidden="true"></span>
      左键旋转 · 中键/右键平移 · 滚轮缩放
      <span
        v-if="bridgeLog.length > 0"
        class="three-hint__bridge"
        :title="bridgeLog.join('\n')"
      >
        上跨避让 {{ bridgeLog.length }} 段</span>
    </div>

    <button
      v-if="ready"
      type="button"
      class="three-overview"
      @click.stop="showOverview"
    >
      俯视图
    </button>

    <button
      v-if="ready"
      type="button"
      class="three-reset-view"
      @click.stop="resetView"
    >
      重置视角
    </button>

    <div
      v-if="nodeTooltip && hoveredNode"
      class="three-tooltip three-tooltip--node"
      :style="nodeTooltipStyle"
      :data-node-id="hoveredNode.enterpriseId"
      role="tooltip"
    >
      <div class="three-tooltip__title">{{ nodeTooltip.name }}</div>
      <div class="three-tooltip__row">
        企业类型：{{ nodeTooltip.type }}
      </div>
      <div class="three-tooltip__row">
        风险等级：{{ nodeTooltip.level }}
      </div>
      <div class="three-tooltip__row">
        风险分值：{{ nodeTooltip.impact }}
      </div>
      <div v-if="nodeTooltip.controller" class="three-tooltip__row">
        同控：{{ nodeTooltip.controller }}
      </div>
    </div>

    <div
      v-else-if="tooltip && hoveredRelation"
      class="three-tooltip"
      :class="{ 'is-safe': tooltip.safe }"
      :style="tooltipStyle"
      :data-edge-id="hoveredRelation.edgeId"
      role="tooltip"
    >
      <div class="three-tooltip__title">{{ tooltip.title }}</div>
      <div class="three-tooltip__route">{{ tooltip.route }}</div>
      <div class="three-tooltip__meta">
        关联值：<span>{{ tooltip.association }}</span>
      </div>
      <div class="three-tooltip__risk">{{ tooltip.risk }}</div>
    </div>
  </div>
</template>

<style scoped>
.three-canvas {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #000000;
}

.three-canvas :deep(canvas) {
  position: absolute;
  inset: 0;
  z-index: 0;
  display: block;
  width: 100%;
  height: 100%;
  outline: none;
}

.three-loading {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30px;
  flex-direction: column;
  text-align: center;
  background: rgba(0, 0, 0, 0.78);
  pointer-events: none;
}

.three-loading__orbit {
  position: relative;
  display: grid;
  width: 58px;
  height: 58px;
  margin-bottom: 18px;
  place-items: center;
  border: 1px solid rgba(130, 201, 224, 0.28);
  border-radius: 50%;
  animation: three-orbit 2.2s linear infinite;
}

.three-loading__orbit::before,
.three-loading__orbit::after {
  position: absolute;
  content: '';
  border: 1px solid rgba(130, 201, 224, 0.12);
  border-radius: 50%;
}

.three-loading__orbit::before {
  inset: 8px;
}

.three-loading__orbit::after {
  width: 5px;
  height: 5px;
  background: #a0e3f2;
  border: 0;
  box-shadow: 0 0 12px rgba(160, 227, 242, 0.8);
}

.three-loading strong {
  color: #d8e6e9;
  font-size: 12px;
  font-weight: 550;
  letter-spacing: 0.04em;
}

.three-loading__status,
.three-loading__error {
  margin: 7px 0 0;
  color: #7e8d92;
  font-size: 8.5px;
  line-height: 1.6;
}

.three-loading__error {
  max-width: 440px;
  color: #d99494;
}

.three-loading__track {
  width: 210px;
  height: 2px;
  margin-top: 14px;
  overflow: hidden;
  background: #262626;
  border-radius: 999px;
}

.three-loading__track span {
  display: block;
  height: 100%;
  background: #82c9e0;
  border-radius: inherit;
  box-shadow: 0 0 10px rgba(130, 201, 224, 0.55);
  transition: width 180ms ease;
}

.three-loading small {
  margin-top: 9px;
  color: #59666a;
  font-size: 7.5px;
}

.three-hint {
  position: absolute;
  bottom: 43px;
  left: 20px;
  z-index: 3;
  display: flex;
  align-items: center;
  height: 25px;
  padding: 0 8px;
  gap: 6px;
  color: #77868a;
  font-size: 7.5px;
  background: rgba(18, 18, 18, 0.72);
  border: 1px solid #303a3d;
  border-radius: 4px;
  pointer-events: none;
  backdrop-filter: blur(6px);
}

.three-hint__mark {
  width: 4px;
  height: 4px;
  background: #82c9e0;
  border-radius: 50%;
  box-shadow: 0 0 7px rgba(130, 201, 224, 0.65);
}

.three-hint__bridge {
  margin-left: 5px;
  padding-left: 8px;
  color: #d1b174;
  border-left: 1px solid #3e3729;
}

.three-canvas.is-hovering-relation :deep(canvas) {
  cursor: pointer;
}

.three-canvas.is-hovering-node :deep(canvas) {
  cursor: pointer;
}

.three-canvas :deep(.three-label-layer) {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}

.three-canvas :deep(.three-label) {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2px 5px;
  color: #e0e0e0;
  font-size: 9px;
  line-height: 1.35;
  white-space: nowrap;
  pointer-events: none;
  background: rgba(10, 16, 19, 0.82);
  border: 1px solid #3a4b52;
  border-radius: 3px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
}

.three-canvas :deep(.three-label__name) {
  font-weight: 600;
}

.three-canvas :deep(.three-label__meta) {
  display: none;
  color: #aab8bd;
  font-size: 8px;
}

.three-canvas :deep(.three-label.is-dimmed) {
  opacity: 0.28;
}

.three-canvas :deep(.three-label.is-focused) {
  opacity: 1;
  border-color: #82c9e0;
  box-shadow: 0 0 10px rgba(130, 201, 224, 0.38);
}

.three-canvas :deep(.three-label.is-near) {
  padding: 3px 6px;
  font-size: 10px;
  background: rgba(10, 16, 19, 0.94);
}

.three-canvas :deep(.three-label.is-near .three-label__meta) {
  display: block;
}

.three-canvas :deep(.three-label--low) {
  border-color: #9a7940;
}

.three-canvas :deep(.three-label--medium) {
  border-color: #a65f32;
}

.three-canvas :deep(.three-label--high) {
  border-color: #b53a34;
}

.three-canvas :deep(.three-label--source) {
  border-color: #b71c1c;
  box-shadow: 0 0 10px rgba(183, 28, 28, 0.32);
}

.three-reset-view {
  position: absolute;
  right: 18px;
  bottom: 18px;
  z-index: 24;
  padding: 6px 10px;
  color: #e0e0e0;
  font: inherit;
  font-size: 11px;
  line-height: 1.4;
  cursor: pointer;
  background: #1e1e1e;
  border: 1px solid #3a3a3a;
  border-radius: 6px;
  pointer-events: auto;
}

.three-overview {
  position: absolute;
  right: 96px;
  bottom: 18px;
  z-index: 24;
  padding: 6px 10px;
  color: #e0e0e0;
  font: inherit;
  font-size: 11px;
  line-height: 1.4;
  cursor: pointer;
  background: #1e1e1e;
  border: 1px solid #3a3a3a;
  border-radius: 6px;
  pointer-events: auto;
}

.three-overview:hover,
.three-reset-view:hover {
  color: #ffffff;
  border-color: #6c8b95;
}

.three-overview:focus-visible,
.three-reset-view:focus-visible {
  outline: 2px solid #82c9e0;
  outline-offset: 2px;
}

.three-tooltip {
  position: fixed;
  z-index: 80;
  box-sizing: border-box;
  width: max-content;
  max-width: 300px;
  padding: 8px 12px;
  color: #e0e0e0;
  font-size: 11px;
  line-height: 1.65;
  pointer-events: none;
  background: #1e1e1e;
  border: 1px solid #3a3a3a;
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
}

.three-tooltip__title {
  color: #e0e0e0;
  font-weight: 600;
  white-space: nowrap;
}

.three-tooltip--node .three-tooltip__title {
  font-weight: 700;
}

.three-tooltip__row {
  margin-top: 2px;
  color: #e0e0e0;
  white-space: nowrap;
}

.three-tooltip__route {
  margin-top: 3px;
  color: #e0e0e0;
  white-space: nowrap;
}

.three-tooltip__meta {
  margin-top: 2px;
  color: #e0e0e0;
}

.three-tooltip__meta span {
  font-variant-numeric: tabular-nums;
}

.three-tooltip__risk {
  margin-top: 2px;
  color: #e0e0e0;
}

.three-tooltip.is-safe .three-tooltip__risk {
  color: #b8c4c8;
}

@keyframes three-orbit {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .three-loading__orbit {
    animation: none;
  }

  .three-loading__track span {
    transition: none;
  }
}
</style>
