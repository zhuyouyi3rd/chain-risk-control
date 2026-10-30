<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import {
  Activity,
  Building2,
  Info,
  ShieldAlert,
  X,
} from '@lucide/vue'
import EnterpriseTypeIcon from '../common/EnterpriseTypeIcon.vue'
import {
  ENTERPRISE_TYPE_LABELS,
  RELATION_CATEGORY_LABELS,
  RISK_LEVEL_LABELS,
} from '../../core/labels'
import type { RiskLevel } from '../../core/types'
import { useWorkspaceStore } from '../../stores/workspace'

const workspace = useWorkspaceStore()

const open = computed(() => Boolean(workspace.detailRow))
const row = computed(() => workspace.detailRow)
const paths = computed(() => workspace.detailPaths)

const namesById = computed(
  () =>
    new Map(
      workspace.data.enterprises.map((enterprise) => [
        enterprise.id,
        enterprise.name,
      ]),
    ),
)

const controllerGroup = computed(() => {
  const id = row.value?.enterprise.id
  if (!id) return null
  return (
    workspace.data.groups.find((group) => group.members.includes(id)) ?? null
  )
})

const levelColors: Record<RiskLevel, string> = {
  none: '#5AA8C0',
  low: '#FFB74D',
  medium: '#FF8C42',
  high: '#E53935',
  source: '#B71C1C',
}

function nameFor(id: string): string {
  return namesById.value.get(id) ?? id
}

function formatImpact(value: number): string {
  return Number(value.toFixed(5)).toString()
}

function levelLabel(level: RiskLevel): string {
  return RISK_LEVEL_LABELS[level]
}

function levelColor(level: RiskLevel): string {
  return levelColors[level]
}

function categoryLabel(category: keyof typeof RELATION_CATEGORY_LABELS): string {
  return RELATION_CATEGORY_LABELS[category]
}

function close() {
  workspace.closeEnterpriseDetail()
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) close()
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="detail-drawer">
      <aside
        v-if="open && row"
        class="detail-drawer"
        role="dialog"
        aria-modal="false"
        aria-labelledby="enterprise-detail-title"
      >
        <header class="detail-drawer__head">
          <div class="detail-drawer__head-copy">
            <p class="eyebrow">ENTERPRISE DETAIL</p>
            <h2 id="enterprise-detail-title">企业详情</h2>
          </div>
          <button
            class="detail-drawer__close"
            type="button"
            title="关闭详情"
            aria-label="关闭详情"
            @click="close"
          >
            <X :size="16" />
          </button>
        </header>

        <div class="detail-drawer__body">
          <section class="enterprise-hero">
            <div class="enterprise-hero__top">
              <span
                class="enterprise-hero__icon"
                :style="{ color: levelColor(row.node.level) }"
                aria-hidden="true"
              >
                <EnterpriseTypeIcon
                  :type="row.enterprise.type"
                  :size="22"
                />
              </span>
              <div class="enterprise-hero__name">
                <h3>{{ row.enterprise.name }}</h3>
                <p>
                  {{ row.enterprise.id }} ·
                  {{ ENTERPRISE_TYPE_LABELS[row.enterprise.type] }}
                </p>
              </div>
              <span
                class="enterprise-hero__level"
                :style="{
                  color: levelColor(row.node.level),
                  borderColor: levelColor(row.node.level),
                }"
              >
                {{ levelLabel(row.node.level) }}
              </span>
            </div>

            <div class="impact-line">
              <div class="impact-line__label">
                <Activity :size="13" aria-hidden="true" />
                风险冲击 impact
              </div>
              <strong :style="{ color: levelColor(row.node.level) }">
                {{ formatImpact(row.node.impact) }}
              </strong>
            </div>
          </section>

          <section class="detail-section">
            <div class="detail-section__title">
              <Building2 :size="13" aria-hidden="true" />
              企业信息
            </div>
            <dl class="info-grid">
              <div>
                <dt>企业类型</dt>
                <dd>{{ ENTERPRISE_TYPE_LABELS[row.enterprise.type] }}</dd>
              </div>
              <div>
                <dt>地区</dt>
                <dd>{{ row.enterprise.region || '未填写' }}</dd>
              </div>
              <div>
                <dt>控制组</dt>
                <dd>
                  {{
                    controllerGroup
                      ? `${controllerGroup.controllerId} · ${
                          controllerGroup.controllerName ?? '未命名'
                        } · ${controllerGroup.members.length} 家`
                      : '无'
                  }}
                </dd>
              </div>
              <div>
                <dt>经营指标</dt>
                <dd>{{ row.enterprise.metrics || '未填写' }}</dd>
              </div>
            </dl>
          </section>

          <section class="detail-section detail-section--paths">
            <div class="detail-section__title">
              <ShieldAlert :size="13" aria-hidden="true" />
              风险传导路径
              <span class="detail-section__count">{{ paths.length }}</span>
            </div>

            <div v-if="paths.length > 0" class="path-list">
              <article
                v-for="(path, pathIndex) in paths"
                :key="`${path.riskSourceId}-${pathIndex}`"
                class="path-card"
              >
                <header class="path-card__head">
                  <span class="path-card__source">
                    <i aria-hidden="true"></i>
                    {{ path.riskSourceName }}
                  </span>
                  <span
                    class="path-card__final"
                    :style="{ color: levelColor(path.level) }"
                  >
                    最终 {{ formatImpact(path.impact) }} ·
                    {{ levelLabel(path.level) }}
                  </span>
                </header>

                <div class="path-steps">
                  <div class="path-node">
                    <span class="path-node__dot is-source" aria-hidden="true"></span>
                    <div class="path-node__copy">
                      <strong>{{ nameFor(path.startEnterpriseId) }}</strong>
                      <span>风险源起点 · impact 1</span>
                    </div>
                  </div>

                  <template
                    v-for="hop in path.hops"
                    :key="`${path.riskSourceId}-${hop.edgeId}-${hop.from}-${hop.to}`"
                  >
                    <div class="path-hop">
                      <span
                        class="path-hop__line"
                        :style="{ background: levelColor(hop.riskLevel) }"
                        aria-hidden="true"
                      ></span>
                      <div class="path-hop__copy">
                        <span>
                          {{ categoryLabel(hop.category) }} · {{ hop.edgeId }}
                        </span>
                        <small>
                          关联值 {{ formatImpact(hop.association) }} · 累计
                          {{ formatImpact(hop.toImpact) }}
                        </small>
                      </div>
                    </div>

                    <div class="path-node">
                      <span
                        class="path-node__dot"
                        :style="{ background: levelColor(hop.riskLevel) }"
                        aria-hidden="true"
                      ></span>
                      <div class="path-node__copy">
                        <strong>{{ nameFor(hop.to) }}</strong>
                        <span>
                          {{ levelLabel(hop.riskLevel) }} · impact
                          {{ formatImpact(hop.toImpact) }}
                        </span>
                      </div>
                    </div>
                  </template>
                </div>

                <p v-if="path.hops.length === 0" class="path-card__zero">
                  该企业本身是此风险源的起点，无中间传导边。
                </p>
              </article>
            </div>

            <div v-else class="path-empty">
              <Info :size="14" aria-hidden="true" />
              <span>当前没有风险源传导到该企业。</span>
            </div>
          </section>
        </div>

        <footer class="detail-drawer__foot">
          <Info :size="12" aria-hidden="true" />
          决策辅助，不替代人工判断
        </footer>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
.detail-drawer {
  position: fixed;
  top: var(--topbar-height);
  right: 0;
  bottom: 0;
  z-index: 60;
  display: flex;
  width: min(390px, calc(100vw - 28px));
  flex-direction: column;
  background: #1e1e1e;
  border-left: 1px solid #454545;
  box-shadow: -22px 0 64px rgba(0, 0, 0, 0.5);
}

.detail-drawer__head {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  min-height: 72px;
  padding: 13px 14px 12px 17px;
  background: #202020;
  border-bottom: 1px solid #363636;
}

.detail-drawer__head-copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail-drawer__head h2 {
  margin: 0;
  color: #e5e7e8;
  font-size: 15.5px;
  font-weight: 600;
  line-height: 1;
}

.detail-drawer__close {
  display: grid;
  width: 29px;
  height: 29px;
  place-items: center;
  color: #8c9599;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
}

.detail-drawer__close:hover {
  color: #e0e0e0;
  background: #2d2d2d;
  border-color: #414141;
}

.detail-drawer__body {
  flex: 1;
  min-height: 0;
  padding: 13px 14px 18px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #454545 transparent;
}

.detail-drawer__body::-webkit-scrollbar {
  width: 5px;
}

.detail-drawer__body::-webkit-scrollbar-thumb {
  background: #454545;
  border-radius: 999px;
}

.enterprise-hero {
  padding: 13px;
  background: #252525;
  border: 1px solid #3b3b3b;
  border-radius: 6px;
}

.enterprise-hero__top {
  display: flex;
  align-items: center;
  gap: 9px;
}

.enterprise-hero__icon {
  display: grid;
  width: 37px;
  height: 37px;
  flex: 0 0 auto;
  place-items: center;
  background: #1c1c1c;
  border: 1px solid #404040;
  border-radius: 5px;
}

.enterprise-hero__name {
  flex: 1;
  min-width: 0;
}

.enterprise-hero__name h3 {
  overflow: hidden;
  margin: 0 0 4px;
  color: #e3e6e7;
  font-size: 16px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.enterprise-hero__name p {
  margin: 0;
  color: #7f878b;
  font-size: 9px;
}

.enterprise-hero__level {
  flex: 0 0 auto;
  padding: 3px 7px;
  font-size: 8px;
  background: rgba(0, 0, 0, 0.12);
  border: 1px solid;
  border-radius: 999px;
}

.impact-line {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-top: 15px;
  padding-top: 11px;
  border-top: 1px solid #3a3a3a;
}

.impact-line__label {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #8f979b;
  font-size: 8.5px;
}

.impact-line__label svg {
  color: var(--accent);
}

.impact-line strong {
  font-family: "Cascadia Mono", "Consolas", monospace;
  font-size: 26px;
  font-weight: 600;
  line-height: 0.9;
  letter-spacing: -0.05em;
  font-variant-numeric: tabular-nums;
}

.detail-section {
  margin-top: 12px;
  padding-top: 11px;
  border-top: 1px solid #383838;
}

.detail-section__title {
  display: flex;
  align-items: center;
  margin-bottom: 9px;
  gap: 6px;
  color: #b8c0c3;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.03em;
}

.detail-section__title svg {
  color: var(--accent);
}

.detail-section__count {
  display: grid;
  min-width: 18px;
  height: 16px;
  margin-left: auto;
  padding: 0 5px;
  place-items: center;
  color: #899195;
  font-size: 7.5px;
  background: #272727;
  border: 1px solid #3e3e3e;
  border-radius: 999px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 0;
  gap: 8px;
}

.info-grid div {
  min-width: 0;
  padding: 7px 8px;
  background: #242424;
  border: 1px solid #373737;
  border-radius: 4px;
}

.info-grid dt {
  margin-bottom: 4px;
  color: #71797d;
  font-size: 7.5px;
}

.info-grid dd {
  overflow: hidden;
  margin: 0;
  color: #bfc5c7;
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-section--paths {
  margin-top: 14px;
}

.path-list {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.path-card {
  padding: 9px 9px 8px;
  background: #242424;
  border: 1px solid #3a3a3a;
  border-radius: 5px;
}

.path-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 7px;
  gap: 8px;
  border-bottom: 1px solid #353535;
}

.path-card__source {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 5px;
  overflow: hidden;
  color: #d0d4d6;
  font-size: 9px;
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.path-card__source i {
  width: 5px;
  height: 5px;
  flex: 0 0 auto;
  background: #b71c1c;
  border-radius: 50%;
  box-shadow: 0 0 7px rgba(183, 28, 28, 0.55);
}

.path-card__final {
  flex: 0 0 auto;
  font-size: 7.5px;
  white-space: nowrap;
}

.path-steps {
  display: flex;
  padding-top: 8px;
  flex-direction: column;
}

.path-node {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.path-node__dot {
  width: 7px;
  height: 7px;
  margin-top: 3px;
  flex: 0 0 auto;
  background: #5aa8c0;
  border: 1px solid #1e1e1e;
  border-radius: 50%;
}

.path-node__dot.is-source {
  width: 9px;
  height: 9px;
  margin-top: 2px;
  background: #b71c1c;
  box-shadow: 0 0 8px rgba(183, 28, 28, 0.55);
}

.path-node__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.path-node__copy strong {
  overflow: hidden;
  color: #cbd0d2;
  font-size: 9px;
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.path-node__copy span {
  color: #777f83;
  font-size: 7.5px;
}

.path-hop {
  display: flex;
  min-height: 36px;
  margin-left: 3px;
  padding: 4px 0 4px 10px;
  gap: 9px;
  border-left: 1px solid #444444;
}

.path-hop__line {
  width: 16px;
  height: 1px;
  margin-top: 6px;
  flex: 0 0 auto;
  border-radius: 999px;
}

.path-hop__copy {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.path-hop__copy span {
  color: #a6aeb1;
  font-size: 8px;
}

.path-hop__copy small {
  color: #71797d;
  font-size: 7.5px;
}

.path-card__zero {
  margin: 8px 0 0 15px;
  color: #788084;
  font-size: 7.5px;
  line-height: 1.5;
}

.path-empty {
  display: flex;
  align-items: center;
  padding: 13px 10px;
  gap: 7px;
  color: #788084;
  font-size: 8.5px;
  background: #242424;
  border: 1px dashed #3d3d3d;
  border-radius: 4px;
}

.detail-drawer__foot {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  min-height: 34px;
  padding: 8px 14px;
  gap: 6px;
  color: #737b7f;
  font-size: 8px;
  background: #1b1b1b;
  border-top: 1px solid #353535;
}

.detail-drawer__foot svg {
  color: #8e969a;
}

.detail-drawer-enter-active,
.detail-drawer-leave-active {
  transition:
    transform 220ms cubic-bezier(0.22, 0.72, 0.24, 1),
    opacity 180ms ease;
}

.detail-drawer-enter-from,
.detail-drawer-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

@media (prefers-reduced-motion: reduce) {
  .detail-drawer-enter-active,
  .detail-drawer-leave-active {
    transition: none;
  }
}
</style>
