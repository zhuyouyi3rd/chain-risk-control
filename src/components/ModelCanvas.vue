<script setup lang="ts">
import { computed } from 'vue'
import { Hexagon, ShieldAlert, X } from '@lucide/vue'
import GraphCanvas from './graph/GraphCanvas.vue'
import GraphLegend from './graph/GraphLegend.vue'
import SafeViewToggle from './graph/SafeViewToggle.vue'
import ThresholdControl from './graph/ThresholdControl.vue'
import ThreeCanvas from './three/ThreeCanvas.vue'
import { RISK_SOURCE_TYPE_LABELS } from '../core/labels'
import { SCENE_SCALE } from '../render3d/constants'
import { useLayoutStore } from '../stores/layout'
import { useWorkspaceStore } from '../stores/workspace'

const layout = useLayoutStore()
const workspace = useWorkspaceStore()
const hasData = computed(() => workspace.isLoaded)
const is3d = computed(() => layout.viewMode === '3d')
const enterpriseNames = computed(
  () =>
    new Map(
      workspace.data.enterprises.map((enterprise) => [
        enterprise.id,
        enterprise.name,
      ]),
    ),
)
const riskSourceTargetNames = computed(() =>
  (workspace.selectedRiskSource?.targetEnterpriseIds ?? [])
    .map((id) => enterpriseNames.value.get(id) ?? id)
    .join('、'),
)
const riskSourceTypeLabel = computed(() => {
  const source = workspace.selectedRiskSource
  return source ? RISK_SOURCE_TYPE_LABELS[source.type] ?? source.type : ''
})

function handleBackgroundClick(): void {
  workspace.closeRiskSourceDetail()
  workspace.clearEnterpriseFocus()
}
</script>

<template>
  <section class="model-canvas" aria-label="中央建模展示区">
    <div class="canvas-meta">
      <div class="canvas-meta__left">
        <span class="canvas-meta__status" aria-hidden="true"></span>
        <span class="canvas-meta__label">
          {{ is3d ? '3D 建模区' : '2D 建模区' }}
        </span>
        <span class="canvas-meta__divider" aria-hidden="true"></span>
        <span class="canvas-meta__muted">
          {{ hasData ? (is3d ? '模型场景' : '风险图渲染中') : '等待数据' }}
        </span>
      </div>
      <div class="canvas-meta__right">
        <span>{{ is3d ? `分层网格 · ×${SCENE_SCALE}` : '布局固定' }}</span>
        <span class="canvas-meta__divider" aria-hidden="true"></span>
        <span>{{ is3d ? '可旋转' : '可复现' }}</span>
      </div>
    </div>

    <GraphCanvas
      v-if="hasData && !is3d"
      :model="workspace.renderModel"
      @node-click="workspace.openEnterpriseDetail"
      @background-click="handleBackgroundClick"
    />
    <ThreeCanvas
      v-else-if="hasData"
      :enterprises="workspace.data.enterprises"
      :nodes="workspace.renderModel.nodes"
      :edges="workspace.renderModel.edges"
      :risk-sources="workspace.data.riskSources"
      :risk-source-focus="workspace.riskSourceFocus"
      :selected-enterprise-id="workspace.selectedEnterpriseId"
      :layers="layout.layerVisibility"
      @risk-source-click="workspace.openRiskSourceDetail"
      @enterprise-click="workspace.openEnterpriseDetail"
      @background-click="handleBackgroundClick"
      @overview="layout.setViewMode('2d')"
    />
    <aside
      v-if="hasData && is3d && workspace.selectedRiskSource"
      class="risk-source-detail"
      aria-live="polite"
      aria-label="风险源详情"
    >
      <header class="risk-source-detail__head">
        <span class="risk-source-detail__eyebrow">
          <ShieldAlert :size="12" aria-hidden="true" />
          RISK SOURCE FOCUS
        </span>
        <button
          class="risk-source-detail__close"
          type="button"
          title="关闭风险源详情"
          aria-label="关闭风险源详情"
          @click="workspace.closeRiskSourceDetail"
        >
          <X :size="13" />
        </button>
      </header>
      <strong class="risk-source-detail__name">
        {{ workspace.selectedRiskSource.name }}
      </strong>
      <p class="risk-source-detail__meta">
        {{ riskSourceTypeLabel }} · 目标 {{ riskSourceTargetNames }}
      </p>
      <div class="risk-source-detail__metrics">
        <span>
          可达节点
          <b>{{ workspace.selectedRiskSourceReachability?.reachableNodes.size ?? 0 }}</b>
        </span>
        <span>
          可达边
          <b>{{ workspace.selectedRiskSourceReachability?.reachableEdges.size ?? 0 }}</b>
        </span>
      </div>
      <p class="risk-source-detail__hint">
        仅保留该风险源可达连线 · 点击空白退出
      </p>
    </aside>
    <ThresholdControl
      v-if="hasData && !workspace.reverseView"
      :class="{ 'threshold-control--3d': is3d }"
    />
    <SafeViewToggle v-if="hasData && !is3d" />
    <GraphLegend v-if="hasData && !is3d" />

    <div v-if="!hasData" class="empty-stage">
      <div class="emblem" aria-hidden="true">
        <span class="emblem__orbit emblem__orbit--outer"></span>
        <span class="emblem__orbit emblem__orbit--inner"></span>
        <span class="emblem__node emblem__node--material"></span>
        <span class="emblem__node emblem__node--capital"></span>
        <span class="emblem__node emblem__node--tech"></span>
        <span class="emblem__node emblem__node--guarantee"></span>
        <span class="emblem__core">
          <Hexagon :size="25" :stroke-width="1.25" />
        </span>
      </div>

      <p class="empty-stage__eyebrow">INDUSTRY CHAIN RISK MAP</p>
      <h2>等待产业链数据</h2>
      <p class="empty-stage__description">
        <template v-if="is3d">
          导入企业数据后，系统将加载六类 GLB 模型，<br />
          在黑色网格场景中生成 3D 企业节点。
        </template>
        <template v-else>
          从右侧导入 Excel 或手动录入企业、关系与风险源，<br />
          系统将在这里生成可复现的 2D 风险视图。
        </template>
      </p>

      <div v-if="!is3d" class="capability-row" aria-label="关系类型图例">
        <span class="capability">
          <i class="sample-line sample-line--material"></i>
          物料流
        </span>
        <span class="capability">
          <i class="sample-line sample-line--capital"></i>
          资金账期
        </span>
        <span class="capability">
          <i class="sample-line sample-line--tech"></i>
          技术服务
        </span>
        <span class="capability">
          <i class="sample-line sample-line--guarantee"></i>
          担保
        </span>
        <span class="capability">
          <i class="sample-ring"></i>
          同控色环
        </span>
      </div>
      <div v-else class="capability-row" aria-label="3D 场景能力">
        <span class="capability">
          <i class="sample-3d-mark"></i>
          六类 GLB
        </span>
        <span class="capability">
          <i class="sample-3d-floor"></i>
          网格地面
        </span>
        <span class="capability">
          <i class="sample-ring"></i>
          轨道相机
        </span>
      </div>
    </div>

    <footer class="canvas-footer">
      <div class="canvas-stats">
        <span>企业 <b>{{ workspace.counts.enterprises }}</b></span>
        <span class="canvas-stats__divider" aria-hidden="true"></span>
        <span>关系 <b>{{ workspace.counts.relations }}</b></span>
        <span class="canvas-stats__divider" aria-hidden="true"></span>
        <span>同控组 <b>{{ workspace.counts.groups }}</b></span>
      </div>
      <div v-if="!hasData" class="canvas-legend-hint">
        <span class="canvas-legend-hint__mark" aria-hidden="true"></span>
        {{ is3d ? '模型将在数据载入后加载' : '图例将在数据载入后显示' }}
      </div>
    </footer>
  </section>
</template>

<style scoped>
.model-canvas {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: #000000;
}

.canvas-meta {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 17px 20px;
  pointer-events: none;
}

.canvas-meta__left,
.canvas-meta__right {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #747c80;
  font-size: 8.5px;
  font-weight: 500;
  letter-spacing: 0.06em;
}

.canvas-meta__status {
  width: 5px;
  height: 5px;
  background: var(--accent);
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(130, 201, 224, 0.68);
}

.canvas-meta__label {
  color: #a6b0b4;
  font-weight: 550;
}

.canvas-meta__muted {
  color: #656d71;
}

.canvas-meta__divider {
  width: 1px;
  height: 8px;
  background: #303030;
}

.canvas-meta__right span:last-child {
  color: #5e666a;
}

.model-canvas :deep(.threshold-control--3d) {
  top: auto;
  bottom: 56px;
  left: 16px;
}

.risk-source-detail {
  position: absolute;
  top: 54px;
  left: 20px;
  z-index: 5;
  width: 258px;
  padding: 11px 12px 10px;
  color: #e0e0e0;
  background: rgba(25, 25, 25, 0.94);
  border: 1px solid #3a3a3a;
  border-radius: 6px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.38);
  backdrop-filter: blur(8px);
}

.risk-source-detail__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.risk-source-detail__eyebrow {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #b98282;
  font-size: 7.5px;
  letter-spacing: 0.08em;
}

.risk-source-detail__close {
  display: grid;
  width: 20px;
  height: 20px;
  padding: 0;
  color: #9ca4a8;
  background: transparent;
  border: 1px solid #3a3a3a;
  border-radius: 3px;
  cursor: pointer;
  place-items: center;
}

.risk-source-detail__close:hover {
  color: #e0e0e0;
  border-color: #595959;
}

.risk-source-detail__name {
  display: block;
  margin-top: 8px;
  color: #e8eef0;
  font-size: 13px;
  font-weight: 600;
}

.risk-source-detail__meta {
  margin: 4px 0 0;
  color: #7f8a8e;
  font-size: 8px;
  line-height: 1.5;
}

.risk-source-detail__metrics {
  display: flex;
  margin-top: 8px;
  gap: 12px;
  padding-top: 7px;
  color: #8c979b;
  font-size: 8px;
  border-top: 1px solid #303030;
}

.risk-source-detail__metrics b {
  margin-left: 3px;
  color: #d9e4e7;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.risk-source-detail__hint {
  margin: 7px 0 0;
  color: #69757a;
  font-size: 7.5px;
  line-height: 1.5;
}

.empty-stage {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  width: min(500px, calc(100% - 48px));
  flex-direction: column;
  align-items: center;
  text-align: center;
  transform: translate(-50%, -52%);
}

.emblem {
  position: relative;
  display: grid;
  width: 132px;
  height: 132px;
  margin-bottom: 28px;
  place-items: center;
}

.emblem__orbit {
  position: absolute;
  border-radius: 50%;
}

.emblem__orbit--outer {
  inset: 0;
  border: 1px solid rgba(130, 201, 224, 0.13);
  box-shadow: inset 0 0 38px rgba(130, 201, 224, 0.018);
}

.emblem__orbit--inner {
  inset: 21px;
  border: 1px dashed rgba(130, 201, 224, 0.17);
  animation: emblem-spin 48s linear infinite;
}

.emblem__core {
  position: relative;
  z-index: 2;
  display: grid;
  width: 58px;
  height: 58px;
  place-items: center;
  color: var(--accent);
  background: #050505;
  border: 1px solid rgba(130, 201, 224, 0.46);
  border-radius: 50%;
  box-shadow:
    0 0 0 8px rgba(130, 201, 224, 0.022),
    0 0 44px rgba(130, 201, 224, 0.1);
}

.emblem__node {
  position: absolute;
  z-index: 3;
  width: 6px;
  height: 6px;
  border: 1px solid #000000;
  border-radius: 50%;
}

.emblem__node--material {
  top: 9px;
  left: calc(50% - 3px);
  background: var(--material);
  box-shadow: 0 0 8px rgba(74, 144, 217, 0.55);
}

.emblem__node--capital {
  top: calc(50% - 3px);
  right: 8px;
  background: var(--capital);
  box-shadow: 0 0 8px rgba(155, 89, 182, 0.5);
}

.emblem__node--tech {
  bottom: 17px;
  right: 27px;
  background: var(--tech);
  box-shadow: 0 0 8px rgba(26, 188, 156, 0.42);
}

.emblem__node--guarantee {
  bottom: 17px;
  left: 27px;
  background: var(--guarantee);
  box-shadow: 0 0 8px rgba(46, 125, 50, 0.52);
}

.empty-stage__eyebrow {
  margin: 0 0 10px;
  color: #5e686d;
  font-size: 7.5px;
  font-weight: 600;
  letter-spacing: 0.24em;
}

.empty-stage h2 {
  margin: 0 0 10px;
  color: #e1e4e5;
  font-size: 20px;
  font-weight: 550;
  line-height: 1.2;
  letter-spacing: 0.035em;
}

.empty-stage__description {
  margin: 0;
  color: #737c80;
  font-size: 10px;
  line-height: 1.85;
  letter-spacing: 0.015em;
}

.capability-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  margin-top: 24px;
  padding-top: 15px;
  gap: 8px 15px;
  border-top: 1px solid #1b1b1b;
}

.capability {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #626b6f;
  font-size: 8px;
  white-space: nowrap;
}

.sample-line {
  display: inline-block;
  width: 15px;
  height: 0;
  border-top: 1px solid currentColor;
}

.sample-line--material {
  color: var(--material);
}

.sample-line--capital {
  color: var(--capital);
  border-top-style: dashed;
}

.sample-line--tech {
  color: var(--tech);
  border-top-style: dotted;
}

.sample-line--guarantee {
  color: var(--guarantee);
  border-top-width: 2px;
}

.sample-ring {
  display: inline-block;
  width: 7px;
  height: 7px;
  border: 1px solid #8e7cc3;
  border-radius: 50%;
}

.sample-3d-mark {
  display: inline-block;
  width: 9px;
  height: 9px;
  background: rgba(160, 227, 242, 0.58);
  border: 1px solid #a0e3f2;
  border-radius: 2px;
  transform: rotate(30deg) skewY(-18deg);
}

.sample-3d-floor {
  display: inline-block;
  width: 15px;
  height: 7px;
  background:
    linear-gradient(90deg, transparent 46%, #2a2a2a 47%, #2a2a2a 53%, transparent 54%),
    linear-gradient(0deg, transparent 46%, #2a2a2a 47%, #2a2a2a 53%, transparent 54%);
  border: 1px solid #303030;
  border-radius: 1px;
}

.canvas-footer {
  position: absolute;
  right: 20px;
  bottom: 16px;
  left: 20px;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  color: #5f676b;
  font-size: 8px;
  letter-spacing: 0.035em;
  pointer-events: none;
}

.canvas-stats {
  display: flex;
  align-items: center;
  gap: 8px;
}

.canvas-stats b {
  color: #899296;
  font-weight: 550;
  font-variant-numeric: tabular-nums;
}

.canvas-stats__divider {
  width: 1px;
  height: 8px;
  background: #262626;
}

.canvas-legend-hint {
  display: flex;
  align-items: center;
  gap: 7px;
}

.canvas-legend-hint__mark {
  width: 12px;
  height: 8px;
  border: 1px solid #303030;
  border-radius: 2px;
}

@keyframes emblem-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 900px) {
  .canvas-meta {
    padding: 14px 16px;
  }

  .canvas-meta__right {
    display: none;
  }

  .canvas-footer {
    right: 16px;
    bottom: 13px;
    left: 16px;
  }

  .canvas-legend-hint {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .emblem__orbit--inner {
    animation: none;
  }
}
</style>
