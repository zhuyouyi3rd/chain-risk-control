<script setup lang="ts">
import { computed } from 'vue'
import {
  Activity,
  Building2,
  Crosshair,
  PanelLeftClose,
  Search,
  Trash2,
  X,
} from '@lucide/vue'
import EnterpriseTypeIcon from './common/EnterpriseTypeIcon.vue'
import CollapseButton from './common/CollapseButton.vue'
import {
  ENTERPRISE_TYPE_LABELS,
  RISK_LEVEL_LABELS,
} from '../core/labels'
import type { EnterpriseType, RiskLevel } from '../core/types'
import type {
  EnterpriseAffectedFilter,
  EnterpriseLevelFilter,
  EnterpriseRow,
} from '../stores/workspace'
import { useLayoutStore } from '../stores/layout'
import { useWorkspaceStore } from '../stores/workspace'

const layout = useLayoutStore()
const workspace = useWorkspaceStore()

const affectedOptions: Array<{
  value: EnterpriseAffectedFilter
  label: string
}> = [
  { value: 'all', label: '全部' },
  { value: 'affected', label: '受影响' },
  { value: 'unaffected', label: '不受影响' },
]

const levelOptions: Array<{
  value: EnterpriseLevelFilter
  label: string
}> = [
  { value: 'all', label: '全部' },
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
  { value: 'none', label: '无' },
]

const riskLevelColors: Record<RiskLevel, string> = {
  none: '#5AA8C0',
  low: '#FFB74D',
  medium: '#FF8C42',
  high: '#E53935',
  source: '#B71C1C',
}

const hasFilters = computed(
  () =>
    workspace.enterpriseQuery.length > 0 ||
    workspace.affectedFilter !== 'all' ||
    workspace.levelFilter !== 'all',
)

const affectedPercent = computed(() => {
  if (workspace.summary.total === 0) return 0
  return Math.round(
    (workspace.summary.affected / workspace.summary.total) * 100,
  )
})

const distributionSegments = computed(() => [
  {
    key: 'high',
    label: '高',
    count: workspace.summary.high,
    color: '#E53935',
  },
  {
    key: 'medium',
    label: '中',
    count: workspace.summary.medium,
    color: '#FF8C42',
  },
  {
    key: 'low',
    label: '低',
    count: workspace.summary.low,
    color: '#FFB74D',
  },
  {
    key: 'none',
    label: '无',
    count: workspace.summary.none,
    color: '#5AA8C0',
  },
  {
    key: 'source',
    label: '源',
    count: workspace.summary.sourceNodes,
    color: '#B71C1C',
  },
])

function onSearchInput(event: Event) {
  workspace.setEnterpriseQuery((event.target as HTMLInputElement).value)
}

function clearSearch() {
  workspace.setEnterpriseQuery('')
}

function formatScore(value: number): string {
  return value.toFixed(2)
}

function exactScore(value: number): string {
  return Number(value.toFixed(5)).toString()
}

function levelLabel(level: RiskLevel): string {
  return RISK_LEVEL_LABELS[level]
}

function levelColor(level: RiskLevel): string {
  return riskLevelColors[level]
}

function typeLabel(type: EnterpriseType): string {
  return ENTERPRISE_TYPE_LABELS[type]
}

function segmentWidth(count: number): string {
  if (workspace.summary.total === 0) return '0%'
  return `${(count / workspace.summary.total) * 100}%`
}

function toggleFocus(row: EnterpriseRow) {
  workspace.toggleEnterpriseFocus(row.enterprise.id)
}

function removeEnterprise(row: EnterpriseRow) {
  workspace.deleteEnterprise(row.enterprise.id)
}
</script>

<template>
  <div class="side-surface">
    <header class="panel-head">
      <div class="panel-head__copy">
        <p class="eyebrow">RISK OVERVIEW</p>
        <h1>风险视图</h1>
      </div>
      <button
        class="icon-button"
        type="button"
        title="收回左侧功能区"
        aria-label="收回左侧功能区"
        @click="layout.closeLeft()"
      >
        <PanelLeftClose :size="15" />
      </button>
    </header>

    <div class="panel-scroll">
      <div v-if="workspace.selectedEnterpriseId" class="focus-banner">
        <span class="focus-banner__text">
          <Crosshair :size="12" aria-hidden="true" />
          聚焦：<b>{{ workspace.selectedEnterpriseName }}</b>
        </span>
        <button
          class="focus-banner__close"
          type="button"
          title="取消聚焦"
          aria-label="取消聚焦"
          @click="workspace.clearEnterpriseFocus()"
        >
          <X :size="12" />
        </button>
      </div>

      <section
        class="panel-card"
        :class="{ 'is-collapsed': layout.enterpriseCollapsed }"
        aria-labelledby="enterprise-list-title"
      >
        <div class="section-heading">
          <div class="section-title" id="enterprise-list-title">
            <Building2 :size="14" aria-hidden="true" />
            <span>企业列表</span>
          </div>
          <div class="section-heading__actions">
            <span class="count-badge">
              {{ workspace.filteredEnterpriseRows.length }}/{{ workspace.summary.total }}
            </span>
            <CollapseButton
              :collapsed="layout.enterpriseCollapsed"
              label="企业列表"
              controls="enterprise-section-body"
              @toggle="layout.toggleEnterpriseSection()"
            />
          </div>
        </div>

        <div
          v-show="!layout.enterpriseCollapsed"
          id="enterprise-section-body"
          class="section-body"
        >
          <label class="search-field">
          <Search :size="13" aria-hidden="true" />
          <input
            type="search"
            aria-label="搜索企业名称或风险等级"
            placeholder="搜索企业名称 / 等级"
            autocomplete="off"
            :value="workspace.enterpriseQuery"
            @input="onSearchInput"
          />
          <button
            v-if="workspace.enterpriseQuery"
            class="search-clear"
            type="button"
            title="清空搜索"
            aria-label="清空搜索"
            @click.prevent="clearSearch"
          >
            <X :size="11" />
          </button>
        </label>

        <div class="filter-block" aria-label="企业筛选">
          <div class="filter-row">
            <button
              v-for="option in affectedOptions"
              :key="option.value"
              class="chip"
              :class="{ 'is-active': workspace.affectedFilter === option.value }"
              type="button"
              @click="workspace.setAffectedFilter(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
          <div class="filter-row filter-row--level">
            <span class="filter-label">等级</span>
            <button
              v-for="option in levelOptions"
              :key="option.value"
              class="chip chip--level"
              :class="{ 'is-active': workspace.levelFilter === option.value }"
              type="button"
              @click="workspace.setLevelFilter(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
        </div>

        <div
          v-if="workspace.filteredEnterpriseRows.length > 0"
          class="enterprise-list"
        >
          <div
            v-for="row in workspace.filteredEnterpriseRows"
            :key="row.enterprise.id"
            class="enterprise-row"
            :class="{
              'is-selected':
                workspace.selectedEnterpriseId === row.enterprise.id,
            }"
          >
            <button
              class="enterprise-row__main"
              type="button"
              :aria-pressed="
                workspace.selectedEnterpriseId === row.enterprise.id
              "
              :title="`${row.enterprise.name} · ${typeLabel(
                row.enterprise.type,
              )} · ${levelLabel(row.node.level)} · ${exactScore(
                row.node.impact,
              )}`"
              @click="toggleFocus(row)"
            >
              <span class="enterprise-row__icon" aria-hidden="true">
                <EnterpriseTypeIcon
                  :type="row.enterprise.type"
                  :size="16"
                />
              </span>
              <span class="enterprise-row__copy">
                <strong>{{ row.enterprise.name }}</strong>
                <small>
                  {{ typeLabel(row.enterprise.type) }} · {{ row.enterprise.id }}
                </small>
              </span>
              <span class="enterprise-row__metrics">
                <span
                  class="level-text"
                  :style="{ color: levelColor(row.node.level) }"
                >
                  <i
                    :style="{ background: levelColor(row.node.level) }"
                    aria-hidden="true"
                  ></i>
                  {{ levelLabel(row.node.level) }}
                </span>
                <b>{{ formatScore(row.node.impact) }}</b>
              </span>
            </button>
            <button
              class="enterprise-row__delete"
              type="button"
              :title="`删除 ${row.enterprise.name}（同步删除关联关系和风险源）`"
              :aria-label="`删除 ${row.enterprise.name}`"
              @click="removeEnterprise(row)"
            >
              <Trash2 :size="12" />
            </button>
          </div>
        </div>

        <div v-else class="empty-list">
          <span class="empty-list__icon" aria-hidden="true">
            <Building2 :size="17" :stroke-width="1.5" />
          </span>
          <p>
            {{
              workspace.enterpriseQuery || hasFilters
                ? '没有匹配的企业'
                : '暂无企业节点'
            }}
          </p>
          <span>
            {{
              workspace.enterpriseQuery || hasFilters
                ? '调整筛选或搜索条件'
                : '导入 Excel 或手动新增后显示'
            }}
          </span>
        </div>

        <div class="section-foot">
          <span>
            {{ workspace.filteredEnterpriseRows.length }} / {{ workspace.summary.total }}
            家
          </span>
          <button
            v-if="hasFilters"
            class="section-reset"
            type="button"
            @click="workspace.resetEnterpriseFilters()"
          >
            清除筛选
          </button>
          <span v-else>点击行聚焦</span>
        </div>
        </div>
      </section>

      <section
        class="panel-card"
        :class="{ 'is-collapsed': layout.resultCollapsed }"
        aria-labelledby="result-title"
      >
        <div class="section-heading">
          <div class="section-title" id="result-title">
            <Activity :size="14" aria-hidden="true" />
            <span>结果展示区</span>
          </div>
          <div class="section-heading__actions">
            <span class="run-tag" :class="{ 'is-ready': workspace.isLoaded }">
              <span class="run-tag__dot" aria-hidden="true"></span>
              {{ workspace.isLoaded ? '已推演' : '待数据' }}
            </span>
            <CollapseButton
              :collapsed="layout.resultCollapsed"
              label="结果展示区"
              controls="result-section-body"
              @toggle="layout.toggleResultSection()"
            />
          </div>
        </div>

        <div
          v-show="!layout.resultCollapsed"
          id="result-section-body"
          class="section-body"
        >
          <div class="summary-grid">
          <article class="summary-card">
            <div class="summary-card__label">
              <i
                class="summary-dot"
                style="background: #b71c1c"
                aria-hidden="true"
              ></i>
              风险源
            </div>
            <strong>{{ workspace.summary.riskSources }}</strong>
            <span>{{ workspace.summary.enabledRiskSources }} 启用</span>
          </article>

          <article class="summary-card">
            <div class="summary-card__label">
              <i
                class="summary-dot"
                style="background: #ff8c42"
                aria-hidden="true"
              ></i>
              受影响
            </div>
            <strong>
              {{ workspace.summary.affected }}
              <small>/{{ workspace.summary.total }}</small>
            </strong>
            <span>{{ affectedPercent }}%</span>
          </article>

          <article class="summary-card">
            <div class="summary-card__label">
              <i
                class="summary-dot"
                style="background: #e53935"
                aria-hidden="true"
              ></i>
              高风险
            </div>
            <strong>{{ workspace.summary.high }}</strong>
            <span>≥ 0.65</span>
          </article>

          <article class="summary-card">
            <div class="summary-card__label">
              <i
                class="summary-dot"
                style="background: #ff8c42"
                aria-hidden="true"
              ></i>
              中风险
            </div>
            <strong>{{ workspace.summary.medium }}</strong>
            <span>0.35 – 0.65</span>
          </article>

          <article class="summary-card">
            <div class="summary-card__label">
              <i
                class="summary-dot"
                style="background: #ffb74d"
                aria-hidden="true"
              ></i>
              低风险
            </div>
            <strong>{{ workspace.summary.low }}</strong>
            <span>0 – 0.35</span>
          </article>

          <article class="summary-card">
            <div class="summary-card__label">
              <i
                class="summary-dot"
                style="background: #5aa8c0"
                aria-hidden="true"
              ></i>
              无风险
            </div>
            <strong>{{ workspace.summary.none }}</strong>
            <span>impact 0</span>
          </article>
        </div>

        <div class="distribution">
          <div class="distribution__head">
            <span>等级分布</span>
            <span>共 {{ workspace.summary.total }} 家</span>
          </div>
          <div class="distribution__track" aria-hidden="true">
            <span
              v-for="segment in distributionSegments"
              :key="segment.key"
              class="distribution__segment"
              :style="{
                width: segmentWidth(segment.count),
                background: segment.color,
              }"
            ></span>
          </div>
          <div class="distribution__legend">
            <span
              v-for="segment in distributionSegments"
              :key="segment.key"
            >
              <i
                :style="{ background: segment.color }"
                aria-hidden="true"
              ></i>
              {{ segment.label }} <b>{{ segment.count }}</b>
            </span>
          </div>
        </div>

        <div class="result-list-block">
          <div class="result-list-head">
            <span>有风险企业</span>
            <b>{{ workspace.riskEnterpriseRows.length }}</b>
          </div>
          <div
            v-if="workspace.riskEnterpriseRows.length > 0"
            class="result-chips"
          >
            <button
              v-for="row in workspace.riskEnterpriseRows"
              :key="row.enterprise.id"
              class="result-chip"
              :class="{
                'is-selected':
                  workspace.selectedEnterpriseId === row.enterprise.id,
              }"
              type="button"
              :title="`${row.enterprise.name} · ${levelLabel(
                row.node.level,
              )} · ${exactScore(row.node.impact)}`"
              @click="toggleFocus(row)"
            >
              <i
                :style="{ background: levelColor(row.node.level) }"
                aria-hidden="true"
              ></i>
              <span>{{ row.enterprise.name }}</span>
              <small>{{ formatScore(row.node.impact) }}</small>
            </button>
          </div>
          <p v-else class="result-empty">暂无风险企业</p>
        </div>

        <div class="result-list-block result-list-block--safe">
          <div class="result-list-head">
            <span>无风险企业</span>
            <b>{{ workspace.safeEnterpriseRows.length }}</b>
          </div>
          <div
            v-if="workspace.safeEnterpriseRows.length > 0"
            class="result-chips"
          >
            <button
              v-for="row in workspace.safeEnterpriseRows"
              :key="row.enterprise.id"
              class="result-chip"
              :class="{
                'is-selected':
                  workspace.selectedEnterpriseId === row.enterprise.id,
              }"
              type="button"
              :title="`${row.enterprise.name} · 无风险 · 0`"
              @click="toggleFocus(row)"
            >
              <i style="background: #5aa8c0" aria-hidden="true"></i>
              <span>{{ row.enterprise.name }}</span>
              <small>0.00</small>
            </button>
          </div>
          <p v-else class="result-empty">暂无企业</p>
        </div>
        </div>
      </section>
    </div>

    <footer class="panel-foot">
      <span>{{ layout.viewMode === '3d' ? '3D 模型视图' : '2D 风险视图' }}</span>
      <span class="panel-foot__divider" aria-hidden="true"></span>
      <span>{{ layout.viewMode === '3d' ? '分层布局' : '固定布局' }}</span>
      <span class="panel-foot__state">
        {{ workspace.isLoaded ? '数据已载入' : '数据未载入' }}
      </span>
    </footer>
  </div>
</template>

<style scoped>
.side-surface {
  display: flex;
  flex-direction: column;
  width: var(--left-open-width);
  height: 100%;
  overflow: hidden;
  background: var(--panel);
  border-right: 1px solid var(--border);
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

.focus-banner {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  height: 32px;
  padding: 0 7px 0 9px;
  color: #b9dce5;
  background: rgba(130, 201, 224, 0.08);
  border: 1px solid rgba(130, 201, 224, 0.28);
  border-radius: 5px;
}

.focus-banner__text {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 5px;
  font-size: 8.5px;
  white-space: nowrap;
}

.focus-banner__text b {
  overflow: hidden;
  color: #e3f7fb;
  font-weight: 600;
  text-overflow: ellipsis;
}

.focus-banner__close {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  color: #80a1a9;
  background: transparent;
  border: 0;
  border-radius: 3px;
  cursor: pointer;
}

.focus-banner__close:hover {
  color: #d8f4fa;
  background: rgba(130, 201, 224, 0.1);
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

.count-badge {
  display: grid;
  min-width: 27px;
  height: 18px;
  padding: 0 6px;
  place-items: center;
  color: #8f979b;
  font-size: 8.5px;
  font-weight: 600;
  background: #222222;
  border: 1px solid #3c3c3c;
  border-radius: 999px;
  font-variant-numeric: tabular-nums;
}

.search-field {
  display: flex;
  align-items: center;
  height: 34px;
  padding: 0 8px 0 9px;
  gap: 7px;
  color: #7f878b;
  background: #212121;
  border: 1px solid #3d3d3d;
  border-radius: 5px;
  cursor: text;
  transition:
    border-color 160ms ease,
    background 160ms ease;
}

.search-field:focus-within {
  background: #232323;
  border-color: #53656b;
}

.search-field input {
  width: 100%;
  min-width: 0;
  padding: 0;
  color: #d9dcdd;
  font-size: 10px;
  background: transparent;
  border: 0;
  outline: 0;
}

.search-field input::placeholder {
  color: #777f83;
}

.search-clear {
  display: grid;
  width: 17px;
  height: 17px;
  flex: 0 0 auto;
  place-items: center;
  color: #7f878b;
  background: #2b2b2b;
  border: 0;
  border-radius: 3px;
  cursor: pointer;
}

.search-clear:hover {
  color: #e0e0e0;
}

.filter-block {
  display: flex;
  margin-top: 8px;
  flex-direction: column;
  gap: 5px;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.filter-row--level {
  padding-top: 4px;
  border-top: 1px solid #3a3a3a;
}

.filter-label {
  margin-right: 3px;
  color: #7e868a;
  font-size: 7.5px;
  white-space: nowrap;
}

.chip {
  height: 23px;
  padding: 0 7px;
  color: #969ea2;
  font-size: 8.5px;
  background: #232323;
  border: 1px solid #3d3d3d;
  border-radius: 4px;
  cursor: pointer;
  transition:
    color 150ms ease,
    background 150ms ease,
    border-color 150ms ease;
}

.chip:hover {
  color: #d8dbdc;
  background: #2f2f2f;
}

.chip.is-active {
  color: #bde2ec;
  background: rgba(130, 201, 224, 0.1);
  border-color: rgba(130, 201, 224, 0.38);
}

.chip--level {
  min-width: 27px;
  height: 21px;
  padding: 0 6px;
  font-size: 8px;
}

.enterprise-list {
  max-height: 268px;
  margin-top: 8px;
  overflow-y: auto;
  background: #242424;
  border: 1px solid #3b3b3b;
  border-radius: 4px;
  scrollbar-width: thin;
  scrollbar-color: #444444 transparent;
}

.enterprise-list::-webkit-scrollbar {
  width: 4px;
}

.enterprise-list::-webkit-scrollbar-thumb {
  background: #444444;
  border-radius: 999px;
}

.enterprise-row {
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid #363636;
  border-left: 2px solid transparent;
  transition:
    background 150ms ease,
    border-color 150ms ease;
}

.enterprise-row:last-child {
  border-bottom: 0;
}

.enterprise-row:hover {
  background: #292929;
}

.enterprise-row.is-selected {
  background: rgba(130, 201, 224, 0.075);
  border-left-color: var(--accent);
}

.enterprise-row__main {
  display: flex;
  flex: 1;
  align-items: center;
  min-width: 0;
  height: 42px;
  padding: 0 3px 0 6px;
  gap: 7px;
  text-align: left;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.enterprise-row__icon {
  display: grid;
  width: 23px;
  height: 23px;
  flex: 0 0 auto;
  place-items: center;
  color: var(--accent);
  background: #1d1d1d;
  border: 1px solid #3a3a3a;
  border-radius: 4px;
}

.enterprise-row__copy {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
  line-height: 1;
}

.enterprise-row__copy strong {
  overflow: hidden;
  color: #cbd0d2;
  font-size: 9.5px;
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.enterprise-row__copy small {
  overflow: hidden;
  color: #71797d;
  font-size: 7px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.enterprise-row__metrics {
  display: flex;
  width: 42px;
  flex: 0 0 auto;
  align-items: flex-end;
  flex-direction: column;
  gap: 3px;
}

.enterprise-row__metrics b {
  color: #8e999d;
  font-size: 7.5px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.level-text {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 7.5px;
  white-space: nowrap;
}

.level-text i {
  width: 4px;
  height: 4px;
  flex: 0 0 auto;
  border-radius: 50%;
}

.enterprise-row__delete {
  display: grid;
  width: 23px;
  flex: 0 0 auto;
  place-items: center;
  color: #6f777b;
  background: transparent;
  border: 0;
  opacity: 0.55;
  cursor: pointer;
  transition:
    color 150ms ease,
    opacity 150ms ease;
}

.enterprise-row__delete:hover {
  color: #e57373;
  opacity: 1;
}

.empty-list {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 106px;
  margin-top: 8px;
  padding: 12px;
  flex-direction: column;
  text-align: center;
  background: #242424;
  border: 1px dashed #454545;
  border-radius: 5px;
}

.empty-list__icon {
  display: grid;
  width: 34px;
  height: 34px;
  margin-bottom: 8px;
  place-items: center;
  color: #849397;
  background: #1d1d1d;
  border: 1px solid #3d3d3d;
  border-radius: 50%;
}

.empty-list p {
  margin: 0 0 4px;
  color: #aeb5b8;
  font-size: 10px;
  font-weight: 550;
}

.empty-list > span:last-child {
  color: #737b7f;
  font-size: 8.5px;
}

.section-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  color: #737b7f;
  font-size: 8.5px;
}

.section-reset {
  padding: 0;
  color: #8db7c1;
  font-size: 8px;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.section-reset:hover {
  color: #c7ebf2;
}

.run-tag {
  display: flex;
  align-items: center;
  height: 19px;
  padding: 0 7px;
  gap: 5px;
  color: #9aa2a5;
  font-size: 8px;
  background: #222222;
  border: 1px solid #3a3a3a;
  border-radius: 999px;
}

.run-tag__dot {
  width: 4px;
  height: 4px;
  background: #70787c;
  border-radius: 50%;
}

.run-tag.is-ready {
  color: #a8cdbd;
  border-color: rgba(76, 175, 125, 0.32);
}

.run-tag.is-ready .run-tag__dot {
  background: #4caf7d;
  box-shadow: 0 0 6px rgba(76, 175, 125, 0.5);
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.summary-card {
  display: flex;
  min-height: 57px;
  padding: 7px 7px 6px;
  flex-direction: column;
  justify-content: space-between;
  background: #232323;
  border: 1px solid #3b3b3b;
  border-radius: 4px;
}

.summary-card__label {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #949c9f;
  font-size: 7.5px;
  white-space: nowrap;
}

.summary-dot {
  width: 4px;
  height: 4px;
  flex: 0 0 auto;
  border-radius: 50%;
}

.summary-card strong {
  color: #e0e3e4;
  font-size: 17px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}

.summary-card strong small {
  color: #70787c;
  font-size: 9px;
  font-weight: 500;
}

.summary-card > span {
  color: #71797d;
  font-size: 6.5px;
  line-height: 1;
  white-space: nowrap;
}

.distribution {
  margin-top: 11px;
  padding-top: 10px;
  border-top: 1px solid #3a3a3a;
}

.distribution__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  color: #929a9e;
  font-size: 8.5px;
}

.distribution__head span:last-child {
  color: #70787c;
}

.distribution__track {
  display: flex;
  height: 6px;
  overflow: hidden;
  background: #1e1e1e;
  border: 1px solid #3b3b3b;
  border-radius: 999px;
}

.distribution__segment {
  height: 100%;
  min-width: 0;
  transition: width 300ms ease;
}

.distribution__legend {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 7px;
  gap: 3px;
  color: #7a8286;
  font-size: 7.5px;
}

.distribution__legend span {
  display: flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
}

.distribution__legend i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
}

.distribution__legend b {
  color: #aab1b4;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.result-list-block {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid #3a3a3a;
}

.result-list-block--safe {
  margin-top: 8px;
}

.result-list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  color: #a7afb2;
  font-size: 8.5px;
}

.result-list-head b {
  display: grid;
  min-width: 18px;
  height: 16px;
  padding: 0 5px;
  place-items: center;
  color: #8f979b;
  font-size: 7.5px;
  font-weight: 600;
  background: #232323;
  border: 1px solid #3b3b3b;
  border-radius: 999px;
}

.result-chips {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
  max-height: 146px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #444444 transparent;
}

.result-chip {
  display: flex;
  align-items: center;
  min-width: 0;
  height: 25px;
  padding: 0 6px;
  gap: 5px;
  text-align: left;
  color: #aeb5b8;
  background: #232323;
  border: 1px solid #3a3a3a;
  border-radius: 4px;
  cursor: pointer;
  transition:
    color 150ms ease,
    background 150ms ease,
    border-color 150ms ease;
}

.result-chip:hover {
  color: #dfe2e3;
  background: #2a2a2a;
}

.result-chip.is-selected {
  color: #d4f0f6;
  background: rgba(130, 201, 224, 0.08);
  border-color: rgba(130, 201, 224, 0.38);
}

.result-chip i {
  width: 4px;
  height: 4px;
  flex: 0 0 auto;
  border-radius: 50%;
}

.result-chip span {
  overflow: hidden;
  flex: 1;
  font-size: 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-chip small {
  color: #737b7f;
  font-size: 7px;
  font-variant-numeric: tabular-nums;
}

.result-empty {
  margin: 0;
  color: #6d7579;
  font-size: 8px;
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

@media (max-height: 780px) {
  .panel-head {
    min-height: 66px;
  }

  .enterprise-list {
    max-height: 216px;
  }

  .summary-card {
    min-height: 52px;
  }

  .result-chips {
    max-height: 116px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .enterprise-row,
  .result-chip,
  .distribution__segment {
    transition: none;
  }
}
</style>
