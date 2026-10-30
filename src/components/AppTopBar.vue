<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  Check,
  ChevronDown,
  FolderKanban,
  Hexagon,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from '@lucide/vue'
import ConfirmDialog from './common/ConfirmDialog.vue'
import type { WorkspaceRecord } from '../stores/workspace'
import { useLayoutStore } from '../stores/layout'
import { useWorkspaceStore } from '../stores/workspace'

const layout = useLayoutStore()
const workspace = useWorkspaceStore()
const workspaceOpen = ref(false)
const workspaceRoot = ref<HTMLElement | null>(null)
const editingWorkspaceId = ref<string | null>(null)
const editingWorkspaceName = ref('')
const confirmMode = ref<'reset' | 'delete' | null>(null)
const deleteTarget = ref<WorkspaceRecord | null>(null)

const allToggleLabel = computed(() =>
  layout.allOpen ? '收回左右功能区' : '展开左右功能区',
)

const confirmOpen = computed(() => confirmMode.value !== null)
const confirmTitle = computed(() =>
  confirmMode.value === 'reset'
    ? `清空“${workspace.activeWorkspaceName}”？`
    : `删除工作区“${deleteTarget.value?.name ?? ''}”？`,
)
const confirmDescription = computed(() =>
  confirmMode.value === 'reset'
    ? '将清空当前工作区的企业、关系、风险源与推演结果。其他工作区不受影响，此操作无法撤销。'
    : '该工作区中的所有数据将一并删除，其他工作区不受影响，此操作无法撤销。',
)
const confirmLabel = computed(() =>
  confirmMode.value === 'reset' ? '清空工作区' : '删除工作区',
)

function toggleWorkspaceMenu() {
  workspaceOpen.value = !workspaceOpen.value
  if (!workspaceOpen.value) cancelRename()
}

function selectWorkspace(workspaceId: string) {
  if (workspace.switchWorkspace(workspaceId)) {
    workspaceOpen.value = false
    cancelRename()
  }
}

async function startRename(record: WorkspaceRecord) {
  editingWorkspaceId.value = record.id
  editingWorkspaceName.value = record.name
  await nextTick()
  const input = document.querySelector<HTMLInputElement>(
    '.workspace__rename-input',
  )
  input?.focus()
  input?.select()
}

function commitRename() {
  const id = editingWorkspaceId.value
  if (!id) return
  const name = editingWorkspaceName.value.trim()
  if (name) workspace.renameWorkspace(id, name)
  editingWorkspaceId.value = null
  editingWorkspaceName.value = ''
}

function cancelRename() {
  editingWorkspaceId.value = null
  editingWorkspaceName.value = ''
}

function handleRenameKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    commitRename()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    cancelRename()
  }
}

function createNewWorkspace() {
  const record = workspace.createWorkspace()
  void startRename(record)
}

function requestDeleteWorkspace(record: WorkspaceRecord) {
  if (workspace.workspaceCount <= 1) return
  deleteTarget.value = record
  confirmMode.value = 'delete'
  workspaceOpen.value = false
  cancelRename()
}

function requestReset() {
  if (!workspace.isLoaded) return
  workspaceOpen.value = false
  confirmMode.value = 'reset'
}

function handleConfirm() {
  if (confirmMode.value === 'reset') {
    workspace.resetActiveWorkspace()
  } else if (confirmMode.value === 'delete' && deleteTarget.value) {
    workspace.deleteWorkspace(deleteTarget.value.id)
    deleteTarget.value = null
  }
  confirmMode.value = null
}

function handleCancel() {
  confirmMode.value = null
  deleteTarget.value = null
}

function handleDocumentPointerDown(event: PointerEvent) {
  if (!workspaceOpen.value) return
  const target = event.target
  if (target instanceof Node && workspaceRoot.value?.contains(target)) return
  if (editingWorkspaceId.value) commitRename()
  workspaceOpen.value = false
}

function handleDocumentKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  if (workspaceOpen.value) {
    if (editingWorkspaceId.value) cancelRename()
    workspaceOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  document.addEventListener('keydown', handleDocumentKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  document.removeEventListener('keydown', handleDocumentKeydown)
})
</script>

<template>
  <header class="topbar">
    <div class="topbar__left">
      <div class="brand" aria-label="产业链风控系统">
        <span class="brand__mark" aria-hidden="true">
          <Hexagon :size="18" :stroke-width="1.6" />
          <span class="brand__spark"></span>
        </span>
        <span class="brand__text">
          <strong class="brand__title">产业链风控系统</strong>
          <span class="brand__subtitle">CHAIN RISK CONTROL</span>
        </span>
      </div>

      <span class="topbar__divider" aria-hidden="true"></span>

      <section class="controller" aria-label="全局控制器">
        <span class="controller__label">全局控制器</span>
        <div class="controller__group">
          <button
            class="controller__button"
            type="button"
            :title="layout.leftOpen ? '收回左侧功能区' : '展开左侧功能区'"
            :aria-label="layout.leftOpen ? '收回左侧功能区' : '展开左侧功能区'"
            :aria-pressed="layout.leftOpen"
            @click="layout.toggleLeft()"
          >
            <PanelLeftClose v-if="layout.leftOpen" :size="15" />
            <PanelLeftOpen v-else :size="15" />
          </button>

          <button
            class="controller__button controller__button--all"
            type="button"
            :title="allToggleLabel"
            :aria-label="allToggleLabel"
            :aria-pressed="layout.allOpen"
            @click="layout.toggleAll()"
          >
            <Minimize2 v-if="layout.allOpen" :size="14" />
            <Maximize2 v-else :size="14" />
          </button>

          <button
            class="controller__button"
            type="button"
            :title="layout.rightOpen ? '收回右侧功能区' : '展开右侧功能区'"
            :aria-label="layout.rightOpen ? '收回右侧功能区' : '展开右侧功能区'"
            :aria-pressed="layout.rightOpen"
            @click="layout.toggleRight()"
          >
            <PanelRightClose v-if="layout.rightOpen" :size="15" />
            <PanelRightOpen v-else :size="15" />
          </button>
        </div>

        <span class="controller__divider" aria-hidden="true"></span>

        <div class="controller__view" role="group" aria-label="视图切换">
          <button
            class="controller__view-button"
            :class="{ 'is-active': layout.viewMode === '2d' }"
            type="button"
            :aria-pressed="layout.viewMode === '2d'"
            title="2D 风险图视图"
            @click="layout.setViewMode('2d')"
          >
            2D
          </button>
          <button
            class="controller__view-button"
            :class="{ 'is-active': layout.viewMode === '3d' }"
            type="button"
            :aria-pressed="layout.viewMode === '3d'"
            title="3D 模型场景视图"
            @click="layout.setViewMode('3d')"
          >
            3D
          </button>
        </div>
      </section>
    </div>

    <div class="topbar__right">
      <div class="view-status" title="当前工作区数据状态">
        <span class="view-status__dot" aria-hidden="true"></span>
        <span>
          {{ workspace.isLoaded ? `${workspace.counts.enterprises} 企业` : '待载入' }}
        </span>
      </div>

      <div
        ref="workspaceRoot"
        class="workspace"
        :class="{ 'is-open': workspaceOpen }"
      >
        <button
          class="workspace__trigger"
          type="button"
          aria-haspopup="menu"
          :aria-expanded="workspaceOpen"
          :title="workspace.activeWorkspaceName"
          @click="toggleWorkspaceMenu"
        >
          <FolderKanban class="workspace__icon" :size="15" aria-hidden="true" />
          <span class="workspace__meta">
            <span class="workspace__caption">当前工作区</span>
            <strong class="workspace__name">
              {{ workspace.activeWorkspaceName }}
            </strong>
          </span>
          <ChevronDown
            class="workspace__chevron"
            :size="14"
            aria-hidden="true"
          />
        </button>

        <Transition name="dropdown">
          <div v-if="workspaceOpen" class="workspace__menu" role="menu">
            <div class="workspace__menu-head">
              <span>工作区</span>
              <span class="workspace__count">{{ workspace.workspaceCount }}</span>
            </div>

            <div class="workspace__rows">
              <div
                v-for="record in workspace.workspaces"
                :key="record.id"
                class="workspace__row"
                :class="{
                  'is-active': record.id === workspace.activeWorkspaceId,
                }"
              >
                <template v-if="editingWorkspaceId === record.id">
                  <span class="workspace__item-mark">
                    <Pencil :size="13" aria-hidden="true" />
                  </span>
                  <input
                    v-model="editingWorkspaceName"
                    class="workspace__rename-input"
                    type="text"
                    maxlength="30"
                    aria-label="工作区名称"
                    @keydown="handleRenameKeydown"
                    @blur="commitRename"
                  />
                </template>
                <template v-else>
                  <button
                    class="workspace__switch"
                    type="button"
                    role="menuitemradio"
                    :aria-checked="record.id === workspace.activeWorkspaceId"
                    @click="selectWorkspace(record.id)"
                  >
                    <span class="workspace__item-mark">
                      <Check
                        v-if="record.id === workspace.activeWorkspaceId"
                        :size="13"
                        aria-hidden="true"
                      />
                    </span>
                    <span class="workspace__item-copy">
                      <strong>{{ record.name }}</strong>
                      <small>
                        {{ record.data.enterprises.length }} 企业 ·
                        {{ record.data.relations.length }} 关系
                      </small>
                    </span>
                  </button>
                  <div class="workspace__actions">
                    <button
                      type="button"
                      title="重命名工作区"
                      aria-label="重命名工作区"
                      @click="startRename(record)"
                    >
                      <Pencil :size="12" />
                    </button>
                    <button
                      type="button"
                      title="删除工作区"
                      aria-label="删除工作区"
                      :disabled="workspace.workspaceCount <= 1"
                      @click="requestDeleteWorkspace(record)"
                    >
                      <Trash2 :size="12" />
                    </button>
                  </div>
                </template>
              </div>
            </div>

            <div class="workspace__separator" aria-hidden="true"></div>

            <button
              class="workspace__create"
              type="button"
              @click="createNewWorkspace"
            >
              <Plus :size="13" aria-hidden="true" />
              新建工作区
              <span>独立数据</span>
            </button>

            <div class="workspace__menu-foot">
              数据自动保存在本机 · 当前 {{ workspace.workspaceCount }} 个工作区
            </div>
          </div>
        </Transition>
      </div>

      <button
        class="reset-button"
        type="button"
        :disabled="!workspace.isLoaded"
        title="清空当前工作区"
        @click="requestReset"
      >
        <RotateCcw :size="14" aria-hidden="true" />
        <span>重置</span>
      </button>
    </div>

    <ConfirmDialog
      :open="confirmOpen"
      :title="confirmTitle"
      :description="confirmDescription"
      :confirm-label="confirmLabel"
      @confirm="handleConfirm"
      @cancel="handleCancel"
    />
  </header>
</template>

<style scoped>
.topbar {
  position: relative;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  height: var(--topbar-height);
  padding: 0 14px 0 16px;
  background: var(--topbar);
  border-bottom: 1px solid #303030;
}

.topbar__left,
.topbar__right {
  display: flex;
  align-items: center;
  min-width: 0;
}

.topbar__left {
  gap: 16px;
}

.topbar__right {
  gap: 8px;
}

.brand {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.brand__mark {
  position: relative;
  display: grid;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  place-items: center;
  color: var(--accent);
  background: #242424;
  border: 1px solid #3b4245;
  border-radius: 7px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
}

.brand__spark {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 3px;
  height: 3px;
  background: var(--accent);
  border-radius: 50%;
  box-shadow: 0 0 7px rgba(130, 201, 224, 0.9);
}

.brand__text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  line-height: 1;
}

.brand__title {
  overflow: hidden;
  color: #e6e7e8;
  font-size: 12.5px;
  font-weight: 650;
  letter-spacing: 0.045em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.brand__subtitle {
  color: #666e73;
  font-size: 7px;
  font-weight: 650;
  letter-spacing: 0.19em;
  white-space: nowrap;
}

.topbar__divider {
  width: 1px;
  height: 22px;
  flex: 0 0 auto;
  background: #333333;
}

.controller {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.controller__label {
  color: #7f878b;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.08em;
  white-space: nowrap;
}

.controller__group {
  display: flex;
  gap: 1px;
  padding: 2px;
  background: #252525;
  border: 1px solid #383838;
  border-radius: 6px;
}

.controller__button {
  display: grid;
  width: 28px;
  height: 27px;
  padding: 0;
  place-items: center;
  color: #8d969b;
  background: transparent;
  border: 0;
  border-radius: 4px;
  cursor: pointer;
  transition:
    color 150ms ease,
    background 150ms ease;
}

.controller__button:hover {
  color: #e0e0e0;
  background: #333333;
}

.controller__button[aria-pressed="true"] {
  color: #bedee8;
}

.controller__button--all {
  color: #788186;
}

.controller__divider {
  width: 1px;
  height: 17px;
  background: #3b3b3b;
}

.controller__view {
  display: flex;
  padding: 2px;
  gap: 1px;
  background: #252525;
  border: 1px solid #383838;
  border-radius: 5px;
}

.controller__view-button {
  width: 28px;
  height: 24px;
  padding: 0;
  color: #6f777b;
  font-size: 8px;
  font-weight: 600;
  background: transparent;
  border: 0;
  border-radius: 3px;
}

.controller__view-button.is-active {
  color: #c7e9f1;
  background: rgba(130, 201, 224, 0.11);
}

.controller__view-button:disabled {
  color: #4f5659;
  cursor: not-allowed;
}

.view-status {
  display: flex;
  align-items: center;
  height: 30px;
  padding: 0 10px;
  gap: 7px;
  color: #90989c;
  font-size: 9.5px;
  white-space: nowrap;
  background: #191919;
  border: 1px solid #333333;
  border-radius: 999px;
}

.view-status__dot {
  width: 5px;
  height: 5px;
  background: var(--accent);
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(130, 201, 224, 0.8);
}

.view-status__divider {
  width: 1px;
  height: 10px;
  margin: 0 1px;
  background: #383838;
}

.view-status__hint {
  color: #686f73;
}

.workspace {
  position: relative;
}

.workspace__trigger {
  display: flex;
  align-items: center;
  width: 184px;
  height: 38px;
  padding: 0 9px 0 10px;
  gap: 8px;
  text-align: left;
  background: #272727;
  border: 1px solid #3a3a3a;
  border-radius: 6px;
  cursor: pointer;
  transition:
    background 160ms ease,
    border-color 160ms ease;
}

.workspace__trigger:hover {
  background: #2c2c2c;
  border-color: #484848;
}

.workspace.is-open .workspace__trigger {
  background: #2c2c2c;
  border-color: #4d5a5e;
}

.workspace__icon {
  flex: 0 0 auto;
  color: var(--accent);
}

.workspace__meta {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  gap: 2px;
  line-height: 1;
}

.workspace__caption {
  color: #7f878b;
  font-size: 7.5px;
  font-weight: 600;
  letter-spacing: 0.1em;
}

.workspace__name {
  overflow: hidden;
  color: #e0e0e0;
  font-size: 11.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace__chevron {
  flex: 0 0 auto;
  color: #798186;
  transition: transform 180ms ease;
}

.workspace.is-open .workspace__chevron {
  transform: rotate(180deg);
}

.workspace__menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 50;
  width: 300px;
  padding: 6px;
  background: #252525;
  border: 1px solid #404040;
  border-radius: 8px;
  box-shadow:
    0 18px 48px rgba(0, 0, 0, 0.58),
    0 2px 10px rgba(0, 0, 0, 0.35);
}

.workspace__menu-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 8px 8px;
  color: #7f878b;
  font-size: 8.5px;
  font-weight: 600;
  letter-spacing: 0.12em;
}

.workspace__count {
  display: grid;
  min-width: 17px;
  height: 17px;
  padding: 0 5px;
  place-items: center;
  color: #9ba3a7;
  font-size: 8.5px;
  background: #333333;
  border-radius: 999px;
}

.workspace__rows {
  max-height: 236px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #474747 transparent;
}

.workspace__rows::-webkit-scrollbar {
  width: 4px;
}

.workspace__rows::-webkit-scrollbar-thumb {
  background: #474747;
  border-radius: 999px;
}

.workspace__row {
  display: flex;
  align-items: center;
  min-height: 44px;
  border-radius: 5px;
  transition: background 150ms ease;
}

.workspace__row:hover {
  background: #303030;
}

.workspace__row.is-active {
  background: rgba(130, 201, 224, 0.075);
}

.workspace__switch {
  display: flex;
  flex: 1;
  align-items: center;
  min-width: 0;
  min-height: 44px;
  padding: 6px 2px 6px 8px;
  gap: 8px;
  text-align: left;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.workspace__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  padding-right: 4px;
  gap: 1px;
  opacity: 0.55;
  transition: opacity 150ms ease;
}

.workspace__row:hover .workspace__actions,
.workspace__row:focus-within .workspace__actions {
  opacity: 1;
}

.workspace__actions button {
  display: grid;
  width: 23px;
  height: 23px;
  padding: 0;
  place-items: center;
  color: #858d91;
  background: transparent;
  border: 0;
  border-radius: 3px;
  cursor: pointer;
}

.workspace__actions button:hover {
  color: #e0e0e0;
  background: #3a3a3a;
}

.workspace__actions button:last-child:hover {
  color: #f09a9a;
}

.workspace__actions button:disabled {
  color: #4f5659;
  cursor: not-allowed;
  opacity: 0.55;
}

.workspace__actions button:disabled:hover {
  background: transparent;
  color: #4f5659;
}

.workspace__rename-input {
  min-width: 0;
  height: 26px;
  flex: 1;
  margin-right: 6px;
  padding: 0 7px;
  color: #e0e0e0;
  font-size: 10px;
  background: #1c1c1c;
  border: 1px solid rgba(130, 201, 224, 0.5);
  border-radius: 4px;
  outline: 0;
}

.workspace__create {
  display: flex;
  align-items: center;
  width: 100%;
  height: 31px;
  padding: 0 8px;
  gap: 7px;
  color: #aeb5b8;
  font-size: 9px;
  background: #2a2a2a;
  border: 1px solid #3b3b3b;
  border-radius: 4px;
  cursor: pointer;
}

.workspace__create:hover {
  color: #e0e0e0;
  background: #323232;
  border-color: #4a4a4a;
}

.workspace__create svg {
  color: var(--accent);
}

.workspace__create span {
  margin-left: auto;
  color: #6f777b;
  font-size: 7px;
}

.workspace__item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 8px;
  gap: 9px;
  text-align: left;
  color: #d0d3d5;
  background: transparent;
  border: 0;
  border-radius: 5px;
  cursor: pointer;
  transition: background 150ms ease;
}

.workspace__item:hover {
  background: #303030;
}

.workspace__item.is-active {
  background: rgba(130, 201, 224, 0.075);
}

.workspace__item.is-disabled {
  cursor: default;
  opacity: 0.52;
}

.workspace__item.is-disabled:hover {
  background: transparent;
}

.workspace__item-mark {
  display: grid;
  width: 19px;
  height: 19px;
  flex: 0 0 auto;
  place-items: center;
  color: #8d969b;
}

.workspace__item.is-active .workspace__item-mark {
  color: var(--accent);
}

.workspace__item-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  gap: 3px;
  line-height: 1;
}

.workspace__item-copy strong {
  overflow: hidden;
  font-size: 10.5px;
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace__item-copy small {
  color: #7e8589;
  font-size: 8.5px;
}

.workspace__soon {
  padding: 2px 5px;
  color: #737a7e;
  font-size: 7.5px;
  border: 1px solid #454545;
  border-radius: 3px;
}

.workspace__separator {
  height: 1px;
  margin: 5px 8px;
  background: #383838;
}

.workspace__menu-foot {
  margin-top: 5px;
  padding: 8px;
  color: #6c7377;
  font-size: 8px;
  line-height: 1.5;
  border-top: 1px solid #383838;
}

.reset-button {
  display: flex;
  align-items: center;
  height: 38px;
  padding: 0 12px;
  gap: 6px;
  color: #b7bdc0;
  font-size: 10.5px;
  background: transparent;
  border: 1px solid #3a3a3a;
  border-radius: 6px;
  cursor: pointer;
  transition:
    color 150ms ease,
    background 150ms ease,
    border-color 150ms ease;
}

.reset-button:hover {
  color: #f0f0f0;
  background: #292929;
  border-color: #505050;
}

.reset-button:disabled {
  color: #5a6165;
  background: transparent;
  border-color: #303030;
  cursor: not-allowed;
}

.reset-button:disabled:hover {
  color: #5a6165;
  background: transparent;
  border-color: #303030;
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition:
    opacity 160ms ease,
    transform 160ms ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-5px) scale(0.985);
}

@media (max-width: 1240px) {
  .view-status {
    display: none;
  }
}

@media (max-width: 1080px) {
  .controller__label {
    display: none;
  }

  .topbar__left {
    gap: 12px;
  }
}

@media (max-width: 900px) {
  .brand__subtitle {
    display: none;
  }

  .workspace__trigger {
    width: 164px;
  }

  .topbar__divider {
    display: none;
  }
}

@media (max-width: 720px) {
  .topbar {
    padding-right: 10px;
    padding-left: 10px;
  }

  .brand__text {
    display: none;
  }

  .workspace__trigger {
    width: 150px;
  }

  .reset-button {
    padding: 0 9px;
  }

  .reset-button span {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .workspace__chevron,
  .dropdown-enter-active,
  .dropdown-leave-active {
    transition: none;
  }
}
</style>
