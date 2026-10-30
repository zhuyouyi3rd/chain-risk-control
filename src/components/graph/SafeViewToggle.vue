<script setup lang="ts">
import { ShieldCheck } from '@lucide/vue'
import { useWorkspaceStore } from '../../stores/workspace'

const workspace = useWorkspaceStore()
</script>

<template>
  <button
    class="safe-view-toggle"
    :class="{ 'is-active': workspace.reverseView }"
    type="button"
    :aria-pressed="workspace.reverseView"
    :title="
      workspace.reverseView
        ? '关闭反选视图，回到风险视图'
        : '反选视图：仅显示 impact=0 的企业及其正常关系（连线 #7F9DB9）'
    "
    @click="workspace.toggleReverseView()"
  >
    <ShieldCheck :size="12" aria-hidden="true" />
    <span>
      {{ workspace.reverseView ? '安全企业视图' : '找安全备选方' }}
    </span>
    <i class="safe-line" aria-hidden="true"></i>
    <b>{{ workspace.summary.none }}</b>
  </button>
</template>

<style scoped>
.safe-view-toggle {
  position: absolute;
  top: 49px;
  right: 20px;
  z-index: 4;
  display: flex;
  align-items: center;
  height: 31px;
  max-width: calc(50% - 24px);
  padding: 0 8px;
  gap: 6px;
  color: #9ba3a7;
  font-size: 8.5px;
  white-space: nowrap;
  background: rgba(22, 22, 22, 0.92);
  border: 1px solid #363636;
  border-radius: 5px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(8px);
  cursor: pointer;
  transition:
    color 150ms ease,
    background 150ms ease,
    border-color 150ms ease;
}

.safe-view-toggle:hover {
  color: #d4e8ec;
  background: #272727;
  border-color: #4a5b60;
}

.safe-view-toggle.is-active {
  color: #d4e5ea;
  background: rgba(127, 157, 185, 0.15);
  border-color: rgba(127, 157, 185, 0.56);
}

.safe-view-toggle svg {
  color: var(--accent);
}

.safe-view-toggle.is-active svg {
  color: #7f9db9;
}

.safe-view-toggle b {
  display: grid;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  place-items: center;
  color: #b9cbd1;
  font-size: 7px;
  font-weight: 600;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 999px;
  font-variant-numeric: tabular-nums;
}

.safe-line {
  width: 13px;
  height: 0;
  border-top: 1px solid #7f9db9;
}

@media (max-width: 900px) {
  .safe-view-toggle {
    top: 43px;
    right: 16px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .safe-view-toggle {
    transition: none;
  }
}
</style>
