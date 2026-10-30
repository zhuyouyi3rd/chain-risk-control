<script setup lang="ts">
import { computed } from 'vue'
import {
  Building2,
  FileSpreadsheet,
  Link2,
  PanelRightClose,
  Plus,
  ShieldAlert,
} from '@lucide/vue'
import { RISK_SOURCE_TYPE_LABELS } from '../core/labels'
import type { RiskSourceType } from '../core/types'
import DocumentInputPanel from './import/DocumentInputPanel.vue'
import CollapseButton from './common/CollapseButton.vue'
import { useLayoutStore } from '../stores/layout'
import { useWorkspaceStore } from '../stores/workspace'

const layout = useLayoutStore()
const workspace = useWorkspaceStore()

const RELATION_LAYERS = [
  { key: 'material', label: '物料流', color: '#5BB8D4' },
  { key: 'capital', label: '资金流', color: '#2E86AB' },
  { key: 'tech', label: '技术流', color: '#3DD6C4' },
  { key: 'guarantee', label: '担保', color: '#2E7D32' },
] as const

const enterpriseNames = computed(
  () =>
    new Map(
      workspace.data.enterprises.map((enterprise) => [
        enterprise.id,
        enterprise.name,
      ]),
    ),
)

function riskTypeLabel(type: RiskSourceType): string {
  return RISK_SOURCE_TYPE_LABELS[type] ?? type
}

function targetNames(targetIds: string[]): string {
  return targetIds
    .map((id) => enterpriseNames.value.get(id) ?? id)
    .join('、')
}

function openRiskSource(riskSourceId: string) {
  workspace.openRiskSourceDetail(riskSourceId)
  layout.setViewMode('3d')
}
</script>

<template>
  <div class="side-surface">
    <header class="panel-head">
      <div class="panel-head__copy">
        <p class="eyebrow">DATA INPUT</p>
        <h1>数据输入</h1>
      </div>
      <button
        class="icon-button"
        type="button"
        title="收回右侧功能区"
        aria-label="收回右侧功能区"
        @click="layout.closeRight()"
      >
        <PanelRightClose :size="15" />
      </button>
    </header>

    <div class="panel-scroll">
      <section class="panel-card" aria-labelledby="document-input-title">
        <div class="section-heading">
          <div class="section-title" id="document-input-title">
            <FileSpreadsheet :size="14" aria-hidden="true" />
            <span>文档输入</span>
          </div>
          <span class="source-tag">Excel</span>
        </div>

        <DocumentInputPanel />
      </section>

      <section class="panel-card" aria-labelledby="manual-input-title">
        <div class="section-heading">
          <div class="section-title" id="manual-input-title">
            <Plus :size="14" aria-hidden="true" />
            <span>手动输入区</span>
          </div>
          <span class="count-badge">3</span>
        </div>

        <div class="manual-list">
          <div class="manual-item">
            <span class="manual-item__icon manual-item__icon--enterprise">
              <Building2 :size="15" aria-hidden="true" />
            </span>
            <span class="manual-item__copy">
              <strong>新增企业</strong>
              <small>名称 / 类型 / 控制人</small>
            </span>
            <Plus class="manual-item__plus" :size="13" aria-hidden="true" />
          </div>

          <div class="manual-item">
            <span class="manual-item__icon manual-item__icon--relation">
              <Link2 :size="15" aria-hidden="true" />
            </span>
            <span class="manual-item__copy">
              <strong>新增关系</strong>
              <small>物料 / 资金 / 技术 / 担保</small>
            </span>
            <Plus class="manual-item__plus" :size="13" aria-hidden="true" />
          </div>

          <div class="manual-item">
            <span class="manual-item__icon manual-item__icon--risk">
              <ShieldAlert :size="15" aria-hidden="true" />
            </span>
            <span class="manual-item__copy">
              <strong>新增风险源</strong>
              <small>目标企业 / 风险类型 / 强度</small>
            </span>
            <Plus class="manual-item__plus" :size="13" aria-hidden="true" />
          </div>
        </div>

        <p class="manual-note">表单交互将在后续步骤接入</p>
      </section>

      <section
        class="panel-card"
        :class="{ 'is-collapsed': layout.riskSourceCollapsed }"
        aria-labelledby="risk-source-title"
      >
        <div class="section-heading">
          <div class="section-title" id="risk-source-title">
            <ShieldAlert :size="14" aria-hidden="true" />
            <span>风险源控制</span>
          </div>
          <div class="section-heading__actions">
            <span class="count-badge">{{ workspace.counts.riskSources }}</span>
            <CollapseButton
              :collapsed="layout.riskSourceCollapsed"
              label="风险源控制"
              controls="risk-source-section-body"
              @toggle="layout.toggleRiskSourceSection()"
            />
          </div>
        </div>

        <div
          v-show="!layout.riskSourceCollapsed"
          id="risk-source-section-body"
          class="section-body"
        >
        <div v-if="workspace.counts.riskSources === 0" class="risk-empty">
          <span class="risk-empty__orbit" aria-hidden="true">
            <span class="risk-empty__ring risk-empty__ring--outer"></span>
            <span class="risk-empty__ring risk-empty__ring--inner"></span>
            <ShieldAlert :size="17" :stroke-width="1.5" />
          </span>
          <strong>暂无风险源</strong>
          <p>开启的风险源将在此显示，并标记对应企业</p>
        </div>
        <div v-else class="risk-loaded">
          <span class="risk-loaded__icon" aria-hidden="true">
            <ShieldAlert :size="16" :stroke-width="1.5" />
          </span>
          <div class="risk-loaded__copy">
            <strong>{{ workspace.counts.riskSources }} 个风险源已载入</strong>
            <p>
              {{ workspace.counts.enabledRiskSources }} 个启用 ·
              {{ workspace.counts.riskSources - workspace.counts.enabledRiskSources }}
              个停用
            </p>
          </div>
          <span class="risk-live">
            <i aria-hidden="true"></i>
            实时
          </span>
        </div>

        <div
          v-if="workspace.counts.riskSources > 0"
          class="risk-switches"
          aria-label="风险源开关"
        >
          <div
            v-for="source in workspace.data.riskSources"
            :key="source.id"
            class="risk-switch"
            :class="{
              'is-on': source.enabled,
              'is-detail': workspace.selectedRiskSourceId === source.id,
            }"
            role="button"
            tabindex="0"
            :aria-pressed="workspace.selectedRiskSourceId === source.id"
            :aria-label="`查看风险源详情：${source.name}`"
            @click="openRiskSource(source.id)"
            @keydown.enter.prevent="openRiskSource(source.id)"
            @keydown.space.prevent="openRiskSource(source.id)"
          >
            <span class="risk-switch__signal" aria-hidden="true"></span>
            <span class="risk-switch__copy">
              <strong>{{ source.name }}</strong>
              <small
                :title="`${riskTypeLabel(source.type)} · ${targetNames(
                  source.targetEnterpriseIds,
                )} · ${source.score.toFixed(2)}`"
              >
                {{ riskTypeLabel(source.type) }} ·
                {{ targetNames(source.targetEnterpriseIds) }} ·
                {{ source.score.toFixed(2) }}
              </small>
            </span>
            <button
              class="switch-track"
              type="button"
              role="switch"
              :aria-checked="source.enabled"
              :aria-label="`${source.enabled ? '关闭' : '开启'}风险源：${source.name}`"
              @click.stop="workspace.toggleRiskSource(source.id)"
            >
              <span class="switch-knob"></span>
            </button>
          </div>
        </div>

        <p
          v-if="workspace.counts.riskSources > 0"
          class="risk-note"
        >
          开关即时驱动当前工作区推演；风险源编辑 / 删除暂未接入
        </p>

        <button class="risk-add" type="button" disabled>
          <Plus :size="13" aria-hidden="true" />
          新增风险源
          <span>后续接入</span>
        </button>
        </div>
      </section>

      <section class="panel-card" aria-labelledby="layer-visibility-title">
        <div class="section-heading">
          <div class="section-title" id="layer-visibility-title">
            <Link2 :size="14" aria-hidden="true" />
            <span>关系层显隐</span>
          </div>
          <span class="count-badge">
            {{ Object.values(layout.layerVisibility).filter(Boolean).length }}/4
          </span>
        </div>

        <div class="layer-list">
          <button
            v-for="layer in RELATION_LAYERS"
            :key="layer.key"
            class="layer-row"
            :class="{ 'is-off': !layout.layerVisibility[layer.key] }"
            type="button"
            role="switch"
            :aria-checked="layout.layerVisibility[layer.key]"
            :aria-label="`${layout.layerVisibility[layer.key] ? '隐藏' : '显示'}${layer.label}`"
            @click="layout.toggleLayer(layer.key)"
          >
            <span
              class="layer-row__dot"
              :style="{ background: layer.color }"
              aria-hidden="true"
            ></span>
            <span class="layer-row__label">{{ layer.label }}</span>
            <span class="layer-row__state">
              {{ layout.layerVisibility[layer.key] ? '显示' : '隐藏' }}
            </span>
          </button>
        </div>

        <p class="layer-note">仅控制 3D 关系线图层，不改变推演结果</p>
      </section>
    </div>

    <footer class="panel-foot">
      <span>{{ layout.viewMode === '3d' ? '3D 模型工作台' : '2D 数据工作台' }}</span>
      <span class="panel-foot__divider" aria-hidden="true"></span>
      <span>Excel 优先</span>
      <span class="panel-foot__state">
        {{ layout.viewMode === '3d' ? '3D 场景已接入' : '2D 图已接入' }}
      </span>
    </footer>
  </div>
</template>

<style scoped>
.side-surface {
  display: flex;
  flex-direction: column;
  width: var(--right-open-width);
  height: 100%;
  margin-left: auto;
  overflow: hidden;
  background: var(--panel);
  border-left: 1px solid var(--border);
}

.panel-head {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  min-height: 74px;
  padding: 13px 13px 12px 16px;
  background: #1e1e1e;
  border-bottom: 1px solid #333333;
}

.panel-head__copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.panel-head h1 {
  margin: 0;
  color: #e4e6e7;
  font-size: 15.5px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0.022em;
}

.panel-scroll {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  padding: 12px;
  gap: 12px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.panel-card {
  padding: 13px;
  background: var(--card);
  border: 1px solid #383838;
  border-radius: var(--radius);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.018);
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 18px;
  margin-bottom: 11px;
}

.section-heading__actions {
  display: flex;
  align-items: center;
  gap: 5px;
}

.panel-card.is-collapsed {
  padding-top: 10px;
  padding-bottom: 10px;
}

.panel-card.is-collapsed .section-heading {
  margin-bottom: 0;
}

.section-body {
  min-width: 0;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #dfe1e2;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.015em;
}

.section-title svg {
  color: var(--accent);
}

.source-tag {
  padding: 2px 6px;
  color: #9da5a9;
  font-size: 7.5px;
  letter-spacing: 0.08em;
  background: #222222;
  border: 1px solid #3c3c3c;
  border-radius: 3px;
}

.count-badge {
  display: grid;
  min-width: 20px;
  height: 18px;
  padding: 0 6px;
  place-items: center;
  color: #8f979b;
  font-size: 9px;
  font-weight: 600;
  background: #222222;
  border: 1px solid #3c3c3c;
  border-radius: 999px;
}

.manual-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.manual-item {
  display: flex;
  align-items: center;
  min-height: 43px;
  padding: 6px 9px;
  gap: 8px;
  background: #232323;
  border: 1px solid #3a3a3a;
  border-radius: 5px;
  transition:
    background 150ms ease,
    border-color 150ms ease;
}

.manual-item:hover {
  background: #282828;
  border-color: #4a4a4a;
}

.manual-item__icon {
  display: grid;
  width: 26px;
  height: 26px;
  flex: 0 0 auto;
  place-items: center;
  background: #1d1d1d;
  border: 1px solid #3a3a3a;
  border-radius: 4px;
}

.manual-item__icon--enterprise {
  color: var(--accent);
}

.manual-item__icon--relation {
  color: var(--material);
}

.manual-item__icon--risk {
  color: #cf5d5d;
}

.manual-item__copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  gap: 3px;
  line-height: 1;
}

.manual-item__copy strong {
  color: #c8ccce;
  font-size: 9.5px;
  font-weight: 550;
}

.manual-item__copy small {
  overflow: hidden;
  color: #71797d;
  font-size: 7.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.manual-item__plus {
  flex: 0 0 auto;
  color: #687074;
}

.manual-note {
  margin: 8px 0 0;
  color: #6b7377;
  font-size: 7.5px;
  text-align: right;
}

.risk-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 119px;
  padding: 12px;
  flex-direction: column;
  text-align: center;
  background: #242424;
  border: 1px dashed #434343;
  border-radius: 5px;
}

.risk-empty__orbit {
  position: relative;
  display: grid;
  width: 44px;
  height: 44px;
  margin-bottom: 10px;
  place-items: center;
  color: #cf6565;
}

.risk-empty__ring {
  position: absolute;
  border: 1px solid rgba(183, 28, 28, 0.45);
  border-radius: 50%;
}

.risk-empty__ring--outer {
  inset: 0;
  box-shadow: 0 0 18px rgba(183, 28, 28, 0.1);
}

.risk-empty__ring--inner {
  inset: 7px;
  border-color: rgba(229, 57, 53, 0.2);
}

.risk-empty strong {
  margin-bottom: 4px;
  color: #b8bec1;
  font-size: 10px;
  font-weight: 550;
}

.risk-empty p {
  max-width: 200px;
  margin: 0;
  color: #71797d;
  font-size: 8px;
  line-height: 1.55;
}

.risk-loaded {
  display: flex;
  align-items: center;
  min-height: 58px;
  padding: 9px;
  gap: 8px;
  background: #242424;
  border: 1px solid #3e3e3e;
  border-left: 2px solid rgba(183, 28, 28, 0.68);
  border-radius: 5px;
}

.risk-loaded__icon {
  display: grid;
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  place-items: center;
  color: #cf6565;
  background: #1d1d1d;
  border: 1px solid #3d3d3d;
  border-radius: 50%;
}

.risk-loaded__copy {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.risk-loaded__copy strong {
  color: #c2c7c9;
  font-size: 9.5px;
  font-weight: 550;
}

.risk-loaded__copy p {
  margin: 0;
  color: #747c80;
  font-size: 7.5px;
}

.risk-live {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  height: 19px;
  padding: 0 6px;
  gap: 4px;
  color: #9ec9af;
  font-size: 6.5px;
  border: 1px solid rgba(76, 175, 125, 0.28);
  border-radius: 999px;
}

.risk-live i {
  width: 4px;
  height: 4px;
  background: #4caf7d;
  border-radius: 50%;
  box-shadow: 0 0 6px rgba(76, 175, 125, 0.6);
}

.risk-switches {
  display: flex;
  margin-top: 8px;
  flex-direction: column;
  gap: 5px;
}

.risk-switch {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 41px;
  padding: 6px 8px;
  gap: 7px;
  text-align: left;
  background: #242424;
  border: 1px solid #3a3a3a;
  border-radius: 4px;
  cursor: pointer;
  transition:
    background 150ms ease,
    border-color 150ms ease;
}

.risk-switch:hover {
  background: #282828;
  border-color: #4b4b4b;
}

.risk-switch.is-on {
  background: rgba(183, 28, 28, 0.055);
  border-color: rgba(183, 28, 28, 0.3);
}

.risk-switch.is-detail {
  border-color: rgba(142, 124, 195, 0.72);
  box-shadow: inset 0 0 0 1px rgba(142, 124, 195, 0.18);
}

.risk-switch__signal {
  width: 5px;
  height: 5px;
  flex: 0 0 auto;
  background: #5f676b;
  border-radius: 50%;
}

.risk-switch.is-on .risk-switch__signal {
  background: #e05252;
  box-shadow: 0 0 8px rgba(229, 57, 53, 0.52);
}

.risk-switch__copy {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.risk-switch__copy strong {
  color: #c3c8ca;
  font-size: 8.5px;
  font-weight: 550;
}

.risk-switch__copy small {
  overflow: hidden;
  color: #70787c;
  font-size: 7px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.switch-track {
  display: flex;
  width: 26px;
  height: 14px;
  flex: 0 0 auto;
  align-items: center;
  padding: 2px;
  background: #3b3b3b;
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  transition: background 160ms ease;
}

.switch-knob {
  display: block;
  width: 10px;
  height: 10px;
  background: #8b9296;
  border-radius: 50%;
  transition:
    transform 160ms ease,
    background 160ms ease,
    box-shadow 160ms ease;
}

.risk-switch.is-on .switch-track {
  background: rgba(130, 201, 224, 0.2);
}

.risk-switch.is-on .switch-knob {
  background: #82c9e0;
  box-shadow: 0 0 6px rgba(130, 201, 224, 0.55);
  transform: translateX(12px);
}

.risk-note {
  margin: 7px 0 0;
  color: #697175;
  font-size: 7px;
  line-height: 1.5;
}

.risk-add {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 30px;
  margin-top: 8px;
  gap: 5px;
  color: #747c80;
  font-size: 8.5px;
  background: #252525;
  border: 1px solid #3c3c3c;
  border-radius: 4px;
  cursor: not-allowed;
  opacity: 0.72;
}

.risk-add span {
  margin-left: 2px;
  padding-left: 6px;
  color: #5f676b;
  font-size: 7px;
  border-left: 1px solid #414141;
}

.layer-list {
  display: grid;
  gap: 5px;
  margin-top: 10px;
}

.layer-row {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 8px;
  color: #c7d2d6;
  font: inherit;
  font-size: 9px;
  text-align: left;
  cursor: pointer;
  background: #171717;
  border: 1px solid #303030;
  border-radius: 4px;
}

.layer-row:hover {
  border-color: #4a5b62;
}

.layer-row.is-off {
  color: #687176;
  background: #131313;
}

.layer-row__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  box-shadow: 0 0 6px currentColor;
}

.layer-row.is-off .layer-row__dot {
  opacity: 0.28;
}

.layer-row__label {
  flex: 1;
}

.layer-row__state {
  color: #7f8b90;
  font-size: 8px;
}

.layer-row.is-off .layer-row__state {
  color: #50595d;
}

.layer-note {
  margin: 7px 0 0;
  color: #5f696d;
  font-size: 7.5px;
  line-height: 1.5;
}

.panel-foot {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  height: 30px;
  padding: 0 14px 0 16px;
  gap: 7px;
  color: #697175;
  font-size: 7.5px;
  letter-spacing: 0.04em;
  background: #1b1b1b;
  border-top: 1px solid #303030;
}

.panel-foot__divider {
  width: 1px;
  height: 8px;
  background: #3c3c3c;
}

.panel-foot__state {
  margin-left: auto;
  color: #61696d;
}

@media (max-height: 760px) {
  .panel-head {
    min-height: 66px;
  }

  .risk-empty {
    min-height: 100px;
  }
}
</style>
