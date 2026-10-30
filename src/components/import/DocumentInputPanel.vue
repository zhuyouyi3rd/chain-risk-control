<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import * as XLSX from 'xlsx'
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  Sparkles,
  Upload,
} from '@lucide/vue'
import type { ParsedWorkspace } from '../../core/import'
import {
  createTemplateWorkbook,
  parseWorkspaceWorkbook,
  TEMPLATE_FILE_NAME,
} from '../../core/import'
import {
  TEST_DATASET_COUNTS,
  TEST_DATASET_NAME,
} from '../../core/testData'
import { useWorkspaceStore } from '../../stores/workspace'
import ImportPreview from './ImportPreview.vue'

const MAX_FILE_SIZE = 10 * 1024 * 1024

const workspace = useWorkspaceStore()
const fileInput = ref<HTMLInputElement | null>(null)
const preview = ref<ParsedWorkspace | null>(null)
const previewElement = ref<HTMLElement | null>(null)
const previewName = ref('')
const isParsing = ref(false)
const isDragActive = ref(false)
const imported = ref(false)
const fileError = ref('')
const notice = ref('')

const datasetSummary = computed(
  () =>
    `${TEST_DATASET_COUNTS.enterprises} 企业 / ${TEST_DATASET_COUNTS.relations} 关系 / ${TEST_DATASET_COUNTS.riskSources} 风险源`,
)

function summarizeDataset(data: ParsedWorkspace['data']): string {
  return `${data.enterprises.length} 企业 / ${data.relations.length} 关系 / ${data.riskSources.length} 风险源`
}

function openFilePicker() {
  if (isParsing.value) return
  fileInput.value?.click()
}

function handleUploadKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  openFilePicker()
}

function handleFileInput(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) void ingestFile(file)
}

function handleDrop(event: DragEvent) {
  isDragActive.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) void ingestFile(file)
}

function startDrag(event: DragEvent) {
  event.preventDefault()
  if (!isParsing.value) isDragActive.value = true
}

function stopDrag() {
  isDragActive.value = false
}

async function revealPreview() {
  await nextTick()
  previewElement.value?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
}

async function ingestFile(file: File) {
  preview.value = null
  previewName.value = ''
  imported.value = false
  fileError.value = ''
  notice.value = ''

  const extension = file.name.split('.').pop()?.toLowerCase()
  if (!extension || !['xlsx', 'xls'].includes(extension)) {
    fileError.value = '仅支持 .xlsx 或 .xls 格式的 Excel 文件。'
    return
  }
  if (file.size > MAX_FILE_SIZE) {
    fileError.value = '文件超过 10 MB，请精简数据后重新上传。'
    return
  }

  isParsing.value = true
  try {
    await new Promise((resolve) => requestAnimationFrame(resolve))
    const result = parseWorkspaceWorkbook(await file.arrayBuffer())
    preview.value = result
    previewName.value = file.name
    await revealPreview()
  } catch {
    fileError.value =
      '无法读取该工作簿，请确认文件未损坏且包含企业表、关系表、风险源表。'
  } finally {
    isParsing.value = false
  }
}

function downloadTemplate() {
  fileError.value = ''
  try {
    XLSX.writeFile(createTemplateWorkbook(), TEMPLATE_FILE_NAME, {
      compression: true,
    })
    notice.value = 'Excel 模板已开始下载，请按“填写说明”补充数据。'
  } catch {
    fileError.value = '模板生成失败，请稍后重试。'
  }
}

function loadTestData() {
  if (isParsing.value) return
  const data = workspace.loadTestData()
  preview.value = { data, issues: [] }
  previewName.value = TEST_DATASET_NAME
  imported.value = true
  fileError.value = ''
  notice.value = `测试数据集已写入当前工作区：${datasetSummary.value}。`
  void revealPreview()
}

function confirmImport() {
  if (!preview.value || preview.value.issues.length > 0) return
  workspace.loadExcelData(preview.value.data, previewName.value)
  imported.value = true
  notice.value = `已写入当前工作区：${summarizeDataset(preview.value.data)}。`
}

function closePreview() {
  const scrollContainer = previewElement.value?.closest<HTMLElement>('.panel-scroll')
  preview.value = null
  previewName.value = ''
  imported.value = false
  fileError.value = ''
  notice.value = ''
  scrollContainer?.scrollTo({ top: 0, behavior: 'smooth' })
}

function discardStalePreview() {
  if (!preview.value) return
  const parsed = preview.value.data
  const current = workspace.data
  const stillSame =
    parsed.enterprises.length === current.enterprises.length &&
    parsed.relations.length === current.relations.length &&
    parsed.riskSources.length === current.riskSources.length
  if (!stillSame) {
    preview.value = null
    previewName.value = ''
    imported.value = false
    fileError.value = ''
    notice.value = ''
  }
}

watch(
  () => workspace.activeWorkspaceId,
  () => {
    preview.value = null
    previewName.value = ''
    imported.value = false
    fileError.value = ''
    notice.value = ''
  },
)

watch(
  () => [
    workspace.data.enterprises.length,
    workspace.data.relations.length,
    workspace.data.riskSources.length,
  ],
  discardStalePreview,
)
</script>

<template>
  <div class="document-input">
    <input
      ref="fileInput"
      class="file-input"
      type="file"
      accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
      @change="handleFileInput"
    />

    <div
      class="upload-zone"
      :class="{ 'is-dragging': isDragActive, 'is-busy': isParsing }"
      role="button"
      tabindex="0"
      :aria-busy="isParsing"
      aria-label="上传 Excel 文件"
      @click="openFilePicker"
      @keydown="handleUploadKeydown"
      @dragenter="startDrag"
      @dragover="startDrag"
      @dragleave="stopDrag"
      @drop.prevent="handleDrop"
    >
      <span class="upload-zone__icon" aria-hidden="true">
        <LoaderCircle v-if="isParsing" class="spin" :size="18" />
        <Upload v-else :size="18" :stroke-width="1.6" />
      </span>
      <strong>{{ isParsing ? '正在解析工作簿…' : '拖入 Excel 文件' }}</strong>
      <span class="upload-zone__hint">
        .xlsx / .xls · 单文件不超过 10 MB
      </span>
    </div>

    <div class="upload-actions">
      <button
        class="button button--primary"
        type="button"
        :disabled="isParsing"
        @click="openFilePicker"
      >
        <FileSpreadsheet :size="13" aria-hidden="true" />
        选择文件
      </button>
      <button class="button button--quiet" type="button" @click="downloadTemplate">
        <Download :size="13" aria-hidden="true" />
        下载模板
      </button>
    </div>

    <div class="format-row">
      <span class="format-pill is-supported">
        <CheckCircle2 :size="10" aria-hidden="true" />
        Excel 已支持
      </span>
      <span class="format-pill">
        <FileText :size="10" aria-hidden="true" />
        PDF / Word 后续
      </span>
    </div>

    <button
      class="quick-load"
      type="button"
      :disabled="isParsing"
      @click="loadTestData"
    >
      <span class="quick-load__icon" aria-hidden="true">
        <Sparkles :size="13" />
      </span>
      <span class="quick-load__copy">
        <strong>加载测试数据集</strong>
        <small>{{ datasetSummary }}</small>
      </span>
      <span class="quick-load__action">一键写入</span>
    </button>

    <div v-if="fileError" class="feedback is-error" role="alert">
      <AlertCircle :size="12" aria-hidden="true" />
      <span>{{ fileError }}</span>
    </div>
    <div v-if="notice" class="feedback is-success" role="status">
      <CheckCircle2 :size="12" aria-hidden="true" />
      <span>{{ notice }}</span>
    </div>

    <div v-if="preview" ref="previewElement" class="preview-anchor">
      <ImportPreview
        :result="preview"
        :file-name="previewName"
        :imported="imported"
        @confirm="confirmImport"
        @cancel="closePreview"
      />
    </div>
  </div>
</template>

<style scoped>
.document-input {
  min-width: 0;
}

.preview-anchor {
  scroll-margin-top: 12px;
}

.file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
}

.upload-zone {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 128px;
  padding: 14px 12px;
  flex-direction: column;
  text-align: center;
  background: #242424;
  border: 1px dashed #494949;
  border-radius: 5px;
  cursor: pointer;
  transition:
    background 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.upload-zone:hover,
.upload-zone.is-dragging {
  background: #262626;
  border-color: #5d747a;
  box-shadow: inset 0 0 0 1px rgba(130, 201, 224, 0.08);
}

.upload-zone.is-dragging {
  background: rgba(130, 201, 224, 0.05);
  border-color: rgba(130, 201, 224, 0.58);
}

.upload-zone.is-busy {
  cursor: progress;
}

.upload-zone__icon {
  display: grid;
  width: 35px;
  height: 35px;
  margin-bottom: 8px;
  place-items: center;
  color: var(--accent);
  background: #1d1d1d;
  border: 1px solid #414141;
  border-radius: 50%;
}

.upload-zone strong {
  margin-bottom: 4px;
  color: #c7ccce;
  font-size: 10.5px;
  font-weight: 550;
}

.upload-zone__hint {
  color: #737b7f;
  font-size: 8px;
}

.upload-actions {
  display: flex;
  margin-top: 7px;
  gap: 6px;
}

.button {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  height: 29px;
  padding: 0 9px;
  gap: 5px;
  font-size: 9px;
  border-radius: 4px;
  cursor: pointer;
  transition:
    color 150ms ease,
    background 150ms ease,
    border-color 150ms ease;
}

.button:disabled {
  cursor: progress;
  opacity: 0.58;
}

.button--primary {
  color: #c8edf5;
  background: rgba(130, 201, 224, 0.11);
  border: 1px solid rgba(130, 201, 224, 0.38);
}

.button--primary:hover:not(:disabled) {
  color: #e5f8fc;
  background: rgba(130, 201, 224, 0.18);
  border-color: rgba(130, 201, 224, 0.6);
}

.button--quiet {
  color: #8e969a;
  background: #202020;
  border: 1px solid #404040;
}

.button--quiet:hover {
  color: #d3d7d9;
  background: #2b2b2b;
  border-color: #515151;
}

.format-row {
  display: flex;
  align-items: center;
  margin-top: 8px;
  gap: 5px;
}

.format-pill {
  display: flex;
  align-items: center;
  height: 20px;
  padding: 0 6px;
  gap: 4px;
  color: #737b7f;
  font-size: 7.5px;
  background: #232323;
  border: 1px solid #3a3a3a;
  border-radius: 3px;
}

.format-pill.is-supported {
  color: #9cb8bf;
  border-color: #425053;
}

.quick-load {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 38px;
  margin-top: 8px;
  padding: 6px 8px;
  gap: 7px;
  text-align: left;
  background: #232323;
  border: 1px solid #3d3d3d;
  border-radius: 4px;
  cursor: pointer;
  transition:
    background 150ms ease,
    border-color 150ms ease;
}

.quick-load:hover:not(:disabled) {
  background: #282828;
  border-color: #4c5a5e;
}

.quick-load:disabled {
  cursor: progress;
  opacity: 0.6;
}

.quick-load__icon {
  display: grid;
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  place-items: center;
  color: var(--accent);
  background: #1d1d1d;
  border: 1px solid #3c3c3c;
  border-radius: 4px;
}

.quick-load__copy {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
  line-height: 1;
}

.quick-load__copy strong {
  color: #bdc4c6;
  font-size: 9px;
  font-weight: 550;
}

.quick-load__copy small {
  overflow: hidden;
  color: #6f777b;
  font-size: 7px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-load__action {
  flex: 0 0 auto;
  color: #7b9ca4;
  font-size: 7px;
  letter-spacing: 0.02em;
}

.feedback {
  display: flex;
  align-items: flex-start;
  margin-top: 8px;
  padding: 7px;
  gap: 6px;
  font-size: 8px;
  line-height: 1.55;
  border: 1px solid transparent;
  border-radius: 4px;
}

.feedback svg {
  flex: 0 0 auto;
  margin-top: 1px;
}

.feedback.is-error {
  color: #e0a5a5;
  background: rgba(183, 28, 28, 0.1);
  border-color: rgba(229, 57, 53, 0.24);
}

.feedback.is-success {
  color: #a8ceb9;
  background: rgba(46, 125, 50, 0.1);
  border-color: rgba(76, 175, 125, 0.24);
}

.spin {
  animation: spin 900ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .upload-zone,
  .button,
  .quick-load {
    transition: none;
  }

  .spin {
    animation: none;
  }
}
</style>
