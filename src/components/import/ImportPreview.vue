<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  ShieldCheck,
} from '@lucide/vue'
import type { ImportIssue, ImportScope, ParsedWorkspace } from '../../core/import'
import {
  ENTERPRISE_TYPE_LABELS,
  RELATION_CATEGORY_LABELS,
  RISK_SOURCE_TYPE_LABELS,
} from '../../core/labels'
import type {
  EnterpriseType,
  RelationCategory,
  RiskSourceType,
} from '../../core/types'
import CollapseButton from '../common/CollapseButton.vue'

type PreviewTab = 'enterprises' | 'relations' | 'riskSources'

interface TabDefinition {
  key: PreviewTab
  label: string
  count: number
  errors: number
}

const props = defineProps<{
  result: ParsedWorkspace
  fileName: string
  imported: boolean
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const activeTab = ref<PreviewTab>('enterprises')
const collapsed = ref(false)

const errorCount = computed(() => props.result.issues.length)
const hasErrors = computed(
  () =>
    props.result.issues.length > 0 ||
    (props.result.data.enterprises.length === 0 &&
      props.result.data.relations.length === 0 &&
      props.result.data.riskSources.length === 0),
)
const fileIssues = computed(() =>
  props.result.issues.filter((issue) => issue.scope === 'file'),
)

const tabs = computed<TabDefinition[]>(() => [
  {
    key: 'enterprises',
    label: '企业',
    count: props.result.data.enterprises.length,
    errors: issuesForScope('enterprise').length,
  },
  {
    key: 'relations',
    label: '关系',
    count: props.result.data.relations.length,
    errors: issuesForScope('relation').length,
  },
  {
    key: 'riskSources',
    label: '风险源',
    count: props.result.data.riskSources.length,
    errors: issuesForScope('riskSource').length,
  },
])

const activeRowCount = computed(() => {
  if (activeTab.value === 'enterprises') {
    return props.result.data.enterprises.length
  }
  if (activeTab.value === 'relations') {
    return props.result.data.relations.length
  }
  return props.result.data.riskSources.length
})

watch(
  () => props.result,
  (result) => {
    collapsed.value = false
    if (result.data.enterprises.length > 0) {
      activeTab.value = 'enterprises'
    } else if (result.data.relations.length > 0) {
      activeTab.value = 'relations'
    } else if (result.data.riskSources.length > 0) {
      activeTab.value = 'riskSources'
    } else {
      activeTab.value = 'enterprises'
    }
  },
  { immediate: true },
)

function toggleCollapsed() {
  collapsed.value = !collapsed.value
}

function issuesFor(scope: ImportScope, index: number): ImportIssue[] {
  return props.result.issues.filter(
    (issue) => issue.scope === scope && issue.index === index,
  )
}

function issuesForScope(scope: ImportScope): ImportIssue[] {
  return props.result.issues.filter((issue) => issue.scope === scope)
}

function hasFieldError(
  scope: Exclude<ImportScope, 'file'>,
  index: number,
  field: string,
): boolean {
  return issuesFor(scope, index).some((issue) => issue.field === field)
}

function enterpriseTypeLabel(type: EnterpriseType): string {
  return ENTERPRISE_TYPE_LABELS[type] ?? (type || '未填写')
}

function relationCategoryLabel(category: RelationCategory): string {
  return RELATION_CATEGORY_LABELS[category] ?? (category || '未填写')
}

function riskSourceTypeLabel(type: RiskSourceType): string {
  return RISK_SOURCE_TYPE_LABELS[type] ?? (type || '未填写')
}

function formatDecimal(value: number, scope: Exclude<ImportScope, 'file'>, index: number, field: string) {
  return hasFieldError(scope, index, field) ? '—' : value.toFixed(2)
}

function statusLabel(hasRowErrors: boolean): string {
  return hasRowErrors ? '错误' : '通过'
}

function selectTab(tab: PreviewTab) {
  activeTab.value = tab
}
</script>

<template>
  <section
    class="preview"
    :class="{ 'is-collapsed': collapsed }"
    aria-label="Excel 导入预览"
  >
    <header class="preview__header">
      <div class="preview__file">
        <span class="preview__file-icon" aria-hidden="true">
          <FileSpreadsheet :size="15" />
        </span>
        <div class="preview__file-copy">
          <span class="preview__kicker">IMPORT PREVIEW</span>
          <strong :title="fileName">{{ fileName }}</strong>
        </div>
      </div>
      <div class="preview__head-actions">
        <span
          class="preview__status"
          :class="{
            'is-error': hasErrors,
            'is-success': imported && !hasErrors,
          }"
        >
          <span class="preview__status-dot" aria-hidden="true"></span>
          {{ imported ? '已写入' : hasErrors ? '待修正' : '待确认' }}
        </span>
        <CollapseButton
          :collapsed="collapsed"
          label="测试集预览"
          controls="import-preview-body"
          @toggle="toggleCollapsed"
        />
      </div>
    </header>

    <div v-show="!collapsed" id="import-preview-body">
    <div v-if="fileIssues.length > 0" class="file-errors" role="alert">
      <AlertCircle :size="13" aria-hidden="true" />
      <div>
        <strong>文件结构校验失败</strong>
        <p v-for="issue in fileIssues" :key="`${issue.row}-${issue.message}`">
          {{ issue.message }}
        </p>
      </div>
    </div>

    <div class="preview__tabs" role="tablist" aria-label="预览数据分类">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="preview__tab"
        :class="{ 'is-active': activeTab === tab.key }"
        type="button"
        role="tab"
        :aria-selected="activeTab === tab.key"
        @click="selectTab(tab.key)"
      >
        {{ tab.label }}
        <span class="preview__tab-count">{{ tab.count }}</span>
        <span
          v-if="tab.errors > 0"
          class="preview__tab-errors"
          :title="`${tab.errors} 处错误`"
        >
          {{ tab.errors }}
        </span>
      </button>
    </div>

    <div v-if="activeRowCount === 0" class="preview__empty">
      当前分类没有可预览的数据行
    </div>

    <div v-else class="preview__table-wrap">
      <table
        v-if="activeTab === 'enterprises'"
        class="preview__table preview__table--enterprise"
      >
        <colgroup>
          <col class="col-id" />
          <col />
          <col class="col-type" />
          <col class="col-state" />
        </colgroup>
        <thead>
          <tr>
            <th>ID</th>
            <th>企业 / 控制组</th>
            <th>类型</th>
            <th>校验</th>
          </tr>
        </thead>
        <tbody>
          <template
            v-for="(enterprise, index) in result.data.enterprises"
            :key="`enterprise-${enterprise.id || 'row'}-${index}`"
          >
            <tr
              :class="{
                'is-invalid': issuesFor('enterprise', index).length > 0,
              }"
            >
              <td class="cell-id">{{ enterprise.id || '—' }}</td>
              <td>
                <span class="cell-main" :title="enterprise.name">
                  {{ enterprise.name || '未填写' }}
                </span>
                <span
                  v-if="enterprise.controllerGroup"
                  class="cell-sub"
                  :title="`同控组 ${enterprise.controllerGroup}`"
                >
                  同控 {{ enterprise.controllerGroup }}
                </span>
              </td>
              <td>
                <span class="cell-main">
                  {{ enterpriseTypeLabel(enterprise.type) }}
                </span>
                <span class="cell-sub">{{ enterprise.type || '—' }}</span>
              </td>
              <td>
                <span
                  class="row-state"
                  :class="{
                    'is-error': issuesFor('enterprise', index).length > 0,
                  }"
                >
                  {{ statusLabel(issuesFor('enterprise', index).length > 0) }}
                </span>
              </td>
            </tr>
            <tr
              v-if="issuesFor('enterprise', index).length > 0"
              class="error-detail"
            >
              <td colspan="4">
                <div class="error-detail__inner">
                  <AlertCircle :size="10" aria-hidden="true" />
                  <span>
                    {{
                      issuesFor('enterprise', index)
                        .map((issue) => issue.message)
                        .join('；')
                    }}
                  </span>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <table
        v-else-if="activeTab === 'relations'"
        class="preview__table preview__table--relation"
      >
        <colgroup>
          <col class="col-id" />
          <col />
          <col class="col-type" />
          <col class="col-state" />
        </colgroup>
        <thead>
          <tr>
            <th>ID</th>
            <th>起点 → 终点</th>
            <th>类型 / 关联</th>
            <th>校验</th>
          </tr>
        </thead>
        <tbody>
          <template
            v-for="(relation, index) in result.data.relations"
            :key="`relation-${relation.id || 'row'}-${index}`"
          >
            <tr
              :class="{ 'is-invalid': issuesFor('relation', index).length > 0 }"
            >
              <td class="cell-id">{{ relation.id || '—' }}</td>
              <td>
                <span class="cell-main cell-main--mono">
                  {{ relation.from || '—' }}
                  <span class="cell-arrow">→</span>
                  {{ relation.to || '—' }}
                </span>
                <span v-if="relation.mutual" class="cell-sub">互保</span>
              </td>
              <td>
                <span class="cell-main">
                  {{ relationCategoryLabel(relation.category) }}
                </span>
                <span class="cell-sub">
                  {{
                    formatDecimal(
                      relation.association,
                      'relation',
                      index,
                      'association',
                    )
                  }}
                </span>
              </td>
              <td>
                <span
                  class="row-state"
                  :class="{
                    'is-error': issuesFor('relation', index).length > 0,
                  }"
                >
                  {{ statusLabel(issuesFor('relation', index).length > 0) }}
                </span>
              </td>
            </tr>
            <tr
              v-if="issuesFor('relation', index).length > 0"
              class="error-detail"
            >
              <td colspan="4">
                <div class="error-detail__inner">
                  <AlertCircle :size="10" aria-hidden="true" />
                  <span>
                    {{
                      issuesFor('relation', index)
                        .map((issue) => issue.message)
                        .join('；')
                    }}
                  </span>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <table
        v-else
        class="preview__table preview__table--risk"
      >
        <colgroup>
          <col class="col-id" />
          <col />
          <col class="col-target" />
          <col class="col-state" />
        </colgroup>
        <thead>
          <tr>
            <th>ID</th>
            <th>风险源</th>
            <th>目标 / 强度</th>
            <th>校验</th>
          </tr>
        </thead>
        <tbody>
          <template
            v-for="(source, index) in result.data.riskSources"
            :key="`risk-${source.id || 'row'}-${index}`"
          >
            <tr
              :class="{
                'is-invalid': issuesFor('riskSource', index).length > 0,
              }"
            >
              <td class="cell-id">{{ source.id || '—' }}</td>
              <td>
                <span class="cell-main" :title="source.name">
                  {{ source.name || '未填写' }}
                </span>
                <span class="cell-sub">
                  {{ riskSourceTypeLabel(source.type) }}
                  <span class="source-state" :class="{ 'is-off': !source.enabled }">
                    {{ source.enabled ? '启用' : '停用' }}
                  </span>
                </span>
              </td>
              <td>
                <span
                  class="cell-main cell-main--mono"
                  :title="source.targetEnterpriseIds.join(', ')"
                >
                  {{ source.targetEnterpriseIds.join(', ') || '—' }}
                </span>
                <span class="cell-sub">
                  {{
                    formatDecimal(source.score, 'riskSource', index, 'score')
                  }}
                </span>
              </td>
              <td>
                <span
                  class="row-state"
                  :class="{
                    'is-error': issuesFor('riskSource', index).length > 0,
                  }"
                >
                  {{ statusLabel(issuesFor('riskSource', index).length > 0) }}
                </span>
              </td>
            </tr>
            <tr
              v-if="issuesFor('riskSource', index).length > 0"
              class="error-detail"
            >
              <td colspan="4">
                <div class="error-detail__inner">
                  <AlertCircle :size="10" aria-hidden="true" />
                  <span>
                    {{
                      issuesFor('riskSource', index)
                        .map((issue) => issue.message)
                        .join('；')
                    }}
                  </span>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <div class="preview__summary">
      <span><b>企业</b> {{ result.data.enterprises.length }}</span>
      <span><b>关系</b> {{ result.data.relations.length }}</span>
      <span><b>风险源</b> {{ result.data.riskSources.length }}</span>
      <span class="preview__summary-groups">
        同控 {{ result.data.groups.length }} 组
      </span>
    </div>

    <div
      v-if="hasErrors"
      class="preview__message is-error"
      role="alert"
    >
      <AlertCircle :size="12" aria-hidden="true" />
      发现 {{ errorCount }} 处数据错误，错误行已标红，修正后重新上传。
    </div>
    <div
      v-else-if="imported"
      class="preview__message is-success"
    >
      <CheckCircle2 :size="12" aria-hidden="true" />
      已写入当前工作区，可切换 2D / 3D 查看。
    </div>
    <div v-else class="preview__message is-ready">
      <ShieldCheck :size="12" aria-hidden="true" />
      校验通过，确认后写入当前工作区。
    </div>

    <div class="preview__actions">
      <button
        class="preview__confirm"
        type="button"
        :disabled="hasErrors || imported"
        @click="emit('confirm')"
      >
        {{ imported ? '已写入工作区' : hasErrors ? '修正错误后可导入' : '确认导入' }}
      </button>
      <button class="preview__cancel" type="button" @click="emit('cancel')">
        {{ imported ? '关闭预览' : '取消' }}
      </button>
    </div>
    </div>
  </section>
</template>

<style scoped>
.preview {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #3b3b3b;
}

.preview__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.preview__head-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 5px;
}

.preview__file {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 7px;
}

.preview__file-icon {
  display: grid;
  width: 26px;
  height: 26px;
  flex: 0 0 auto;
  place-items: center;
  color: var(--accent);
  background: #222222;
  border: 1px solid #404040;
  border-radius: 4px;
}

.preview__file-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.preview__kicker {
  color: #6d7579;
  font-size: 6.5px;
  font-weight: 600;
  letter-spacing: 0.16em;
}

.preview__file-copy strong {
  overflow: hidden;
  color: #c9ced0;
  font-size: 9.5px;
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview__status {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  height: 19px;
  padding: 0 6px;
  gap: 4px;
  color: #94a0a4;
  font-size: 7.5px;
  background: #222222;
  border: 1px solid #3e3e3e;
  border-radius: 999px;
}

.preview__status-dot {
  width: 4px;
  height: 4px;
  background: #8b9498;
  border-radius: 50%;
}

.preview__status.is-error {
  color: #e6a2a2;
  border-color: rgba(229, 57, 53, 0.38);
}

.preview__status.is-error .preview__status-dot {
  background: var(--risk-high);
}

.preview__status.is-success {
  color: #a8d8c1;
  border-color: rgba(46, 125, 50, 0.5);
}

.preview__status.is-success .preview__status-dot {
  background: #4caf7d;
}

.file-errors {
  display: flex;
  margin-top: 9px;
  padding: 8px;
  gap: 7px;
  color: #e0a5a5;
  background: rgba(183, 28, 28, 0.12);
  border: 1px solid rgba(229, 57, 53, 0.28);
  border-radius: 4px;
}

.file-errors > svg {
  flex: 0 0 auto;
  margin-top: 1px;
}

.file-errors strong {
  display: block;
  margin-bottom: 3px;
  font-size: 8.5px;
  font-weight: 600;
}

.file-errors p {
  margin: 0 0 2px;
  font-size: 8px;
  line-height: 1.5;
}

.preview__tabs {
  display: flex;
  margin-top: 10px;
  padding: 2px;
  gap: 2px;
  background: #232323;
  border: 1px solid #3a3a3a;
  border-radius: 4px;
}

.preview__tab {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  height: 24px;
  padding: 0 4px;
  gap: 4px;
  color: #848c90;
  font-size: 8.5px;
  background: transparent;
  border: 0;
  border-radius: 3px;
  cursor: pointer;
  transition:
    color 150ms ease,
    background 150ms ease;
}

.preview__tab:hover {
  color: #d6d9da;
  background: #2c2c2c;
}

.preview__tab.is-active {
  color: #c5e8f0;
  background: rgba(130, 201, 224, 0.1);
}

.preview__tab-count {
  color: #727b7f;
  font-size: 7.5px;
  font-variant-numeric: tabular-nums;
}

.preview__tab.is-active .preview__tab-count {
  color: #8db9c5;
}

.preview__tab-errors {
  display: grid;
  min-width: 12px;
  height: 12px;
  padding: 0 3px;
  place-items: center;
  color: #ffe1e1;
  font-size: 6.5px;
  background: #9b2c2c;
  border-radius: 999px;
}

.preview__table-wrap {
  max-height: 232px;
  margin-top: 7px;
  overflow: auto;
  background: #232323;
  border: 1px solid #3b3b3b;
  border-radius: 4px;
}

.preview__empty {
  display: grid;
  min-height: 70px;
  margin-top: 7px;
  place-items: center;
  color: #70787c;
  font-size: 8px;
  background: #232323;
  border: 1px dashed #3f3f3f;
  border-radius: 4px;
}

.preview__table {
  width: 100%;
  table-layout: fixed;
  border-spacing: 0;
  border-collapse: separate;
  font-size: 8px;
}

.preview__table .col-id {
  width: 34px;
}

.preview__table .col-type {
  width: 66px;
}

.preview__table .col-target {
  width: 74px;
}

.preview__table .col-state {
  width: 38px;
}

.preview__table th {
  position: sticky;
  top: 0;
  z-index: 1;
  height: 23px;
  padding: 0 5px;
  color: #7f878b;
  font-size: 7px;
  font-weight: 600;
  text-align: left;
  letter-spacing: 0.05em;
  background: #292929;
  border-bottom: 1px solid #3b3b3b;
}

.preview__table td {
  padding: 6px 5px;
  color: #b8bfc1;
  line-height: 1.35;
  vertical-align: top;
  border-bottom: 1px solid #343434;
}

.preview__table tbody tr:last-child td {
  border-bottom: 0;
}

.preview__table tbody tr.is-invalid {
  background: rgba(229, 57, 53, 0.07);
}

.preview__table tbody tr.is-invalid td:first-child {
  box-shadow: inset 2px 0 0 rgba(229, 57, 53, 0.82);
}

.cell-id {
  color: #83b7c5 !important;
  font-family: "Cascadia Mono", "Consolas", monospace;
  font-size: 7.5px;
  font-variant-numeric: tabular-nums;
}

.cell-main {
  display: block;
  overflow: hidden;
  color: #c7ccce;
  font-size: 8.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell-main--mono {
  font-family: "Cascadia Mono", "Consolas", monospace;
  font-size: 7.8px;
}

.cell-arrow {
  color: #717a7e;
  font-size: 7px;
}

.cell-sub {
  display: flex;
  align-items: center;
  margin-top: 2px;
  gap: 4px;
  overflow: hidden;
  color: #6f777b;
  font-size: 7px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-state {
  padding: 0 3px;
  color: #a6c7b4;
  font-size: 6.5px;
  border: 1px solid rgba(76, 175, 125, 0.28);
  border-radius: 2px;
}

.source-state.is-off {
  color: #7f878b;
  border-color: #444444;
}

.row-state {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: #82b596;
  font-size: 7px;
  white-space: nowrap;
}

.row-state::before {
  width: 3px;
  height: 3px;
  content: "";
  background: #4caf7d;
  border-radius: 50%;
}

.row-state.is-error {
  color: #e09696;
}

.row-state.is-error::before {
  background: var(--risk-high);
}

.error-detail td {
  padding: 5px 6px 6px;
  color: #db9d9d;
  font-size: 7.5px;
  line-height: 1.55;
  background: rgba(183, 28, 28, 0.13);
  border-bottom: 1px solid rgba(229, 57, 53, 0.22);
}

.error-detail__inner {
  display: flex;
  align-items: flex-start;
  gap: 4px;
}

.error-detail svg {
  flex: 0 0 auto;
  margin-top: 1px;
}

.preview__summary {
  display: flex;
  align-items: center;
  margin-top: 7px;
  gap: 9px;
  color: #747c80;
  font-size: 7.5px;
}

.preview__summary b {
  color: #a6aeb1;
  font-weight: 550;
}

.preview__summary-groups {
  margin-left: auto;
  color: #6b7377;
}

.preview__message {
  display: flex;
  align-items: flex-start;
  margin-top: 8px;
  padding: 7px;
  gap: 6px;
  font-size: 8px;
  line-height: 1.5;
  border: 1px solid transparent;
  border-radius: 4px;
}

.preview__message svg {
  flex: 0 0 auto;
  margin-top: 1px;
}

.preview__message.is-error {
  color: #e0a5a5;
  background: rgba(183, 28, 28, 0.1);
  border-color: rgba(229, 57, 53, 0.24);
}

.preview__message.is-success {
  color: #a8ceb9;
  background: rgba(46, 125, 50, 0.1);
  border-color: rgba(76, 175, 125, 0.24);
}

.preview__message.is-ready {
  color: #a2c6cf;
  background: rgba(130, 201, 224, 0.07);
  border-color: rgba(130, 201, 224, 0.22);
}

.preview__actions {
  display: flex;
  margin-top: 8px;
  gap: 6px;
}

.preview__confirm {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  height: 30px;
  color: #d6f4fa;
  font-size: 8.5px;
  background: rgba(130, 201, 224, 0.15);
  border: 1px solid rgba(130, 201, 224, 0.4);
  border-radius: 4px;
  cursor: pointer;
  transition:
    background 150ms ease,
    border-color 150ms ease;
}

.preview__confirm:hover:not(:disabled) {
  background: rgba(130, 201, 224, 0.23);
  border-color: rgba(130, 201, 224, 0.62);
}

.preview__confirm:disabled {
  color: #71797d;
  background: #262626;
  border-color: #3d3d3d;
  cursor: not-allowed;
}

.preview__cancel {
  height: 30px;
  padding: 0 10px;
  color: #899195;
  font-size: 8.5px;
  background: #232323;
  border: 1px solid #3d3d3d;
  border-radius: 4px;
  cursor: pointer;
  transition:
    color 150ms ease,
    background 150ms ease;
}

.preview__cancel:hover {
  color: #d4d8d9;
  background: #2b2b2b;
}

@media (prefers-reduced-motion: reduce) {
  .preview__tab,
  .preview__confirm,
  .preview__cancel {
    transition: none;
  }
}
</style>
