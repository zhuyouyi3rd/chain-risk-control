<script setup lang="ts">
import { SlidersHorizontal } from '@lucide/vue'
import { useWorkspaceStore } from '../../stores/workspace'

const workspace = useWorkspaceStore()

function onSliderInput(event: Event) {
  workspace.setThresholdValue(
    Number((event.target as HTMLInputElement).value),
  )
}
</script>

<template>
  <div
    class="threshold-control"
    :class="{ 'is-active': workspace.thresholdEnabled }"
  >
    <button
      class="threshold-toggle"
      type="button"
      :aria-expanded="workspace.thresholdEnabled"
      :title="workspace.thresholdEnabled ? '关闭阈值筛选' : '开启阈值筛选'"
      @click="workspace.setThresholdEnabled(!workspace.thresholdEnabled)"
    >
      <SlidersHorizontal :size="12" aria-hidden="true" />
      <span>阈值筛选</span>
      <i aria-hidden="true"></i>
    </button>

    <div v-if="workspace.thresholdEnabled" class="threshold-body">
      <div class="threshold-operators" role="group" aria-label="阈值比较方式">
        <button
          type="button"
          :class="{ 'is-active': workspace.thresholdOperator === 'gt' }"
          aria-label="大于阈值"
          :aria-pressed="workspace.thresholdOperator === 'gt'"
          @click="workspace.setThresholdOperator('gt')"
        >
          &gt;
        </button>
        <button
          type="button"
          :class="{ 'is-active': workspace.thresholdOperator === 'lt' }"
          aria-label="小于阈值"
          :aria-pressed="workspace.thresholdOperator === 'lt'"
          @click="workspace.setThresholdOperator('lt')"
        >
          &lt;
        </button>
      </div>

      <input
        class="threshold-slider"
        type="range"
        min="0"
        max="1"
        step="0.01"
        :value="workspace.thresholdValue"
        aria-label="风险阈值"
        @input="onSliderInput"
      />
      <span class="threshold-value">
        {{ workspace.thresholdValue.toFixed(2) }}
      </span>

      <span class="threshold-divider" aria-hidden="true"></span>

      <div class="threshold-scope" role="group" aria-label="筛选范围">
        <button
          type="button"
          :class="{ 'is-active': workspace.thresholdScope === 'all' }"
          :aria-pressed="workspace.thresholdScope === 'all'"
          @click="workspace.setThresholdScope('all')"
        >
          全部
        </button>
        <button
          type="button"
          :class="{ 'is-active': workspace.thresholdScope === 'affected' }"
          :aria-pressed="workspace.thresholdScope === 'affected'"
          @click="workspace.setThresholdScope('affected')"
        >
          仅受影响
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.threshold-control {
  position: absolute;
  top: 49px;
  left: 20px;
  z-index: 4;
  display: flex;
  align-items: center;
  min-height: 31px;
  max-width: calc(100% - 40px);
  padding: 3px 5px;
  gap: 8px;
  background: rgba(22, 22, 22, 0.92);
  border: 1px solid #363636;
  border-radius: 5px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(8px);
}

.threshold-control.is-active {
  border-color: rgba(130, 201, 224, 0.28);
}

.threshold-toggle {
  display: flex;
  align-items: center;
  height: 23px;
  padding: 0 5px;
  gap: 5px;
  color: #8f979b;
  font-size: 8.5px;
  white-space: nowrap;
  background: transparent;
  border: 0;
  border-radius: 3px;
  cursor: pointer;
}

.threshold-toggle:hover {
  color: #e0e0e0;
  background: #292929;
}

.threshold-toggle svg {
  color: var(--accent);
}

.threshold-toggle i {
  width: 4px;
  height: 4px;
  background: #666e72;
  border-radius: 50%;
}

.threshold-control.is-active .threshold-toggle {
  color: #c7d7db;
}

.threshold-control.is-active .threshold-toggle i {
  background: var(--accent);
  box-shadow: 0 0 7px rgba(130, 201, 224, 0.7);
}

.threshold-body {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 7px;
}

.threshold-operators,
.threshold-scope {
  display: flex;
  padding: 1px;
  gap: 1px;
  background: #262626;
  border: 1px solid #3b3b3b;
  border-radius: 3px;
}

.threshold-operators button {
  display: grid;
  width: 20px;
  height: 19px;
  padding: 0;
  place-items: center;
  color: #7f878b;
  font-family: "Cascadia Mono", "Consolas", monospace;
  font-size: 9px;
  background: transparent;
  border: 0;
  border-radius: 2px;
  cursor: pointer;
}

.threshold-operators button.is-active {
  color: #cfeff7;
  background: rgba(130, 201, 224, 0.14);
}

.threshold-scope button {
  height: 19px;
  padding: 0 6px;
  color: #7f878b;
  font-size: 7.5px;
  white-space: nowrap;
  background: transparent;
  border: 0;
  border-radius: 2px;
  cursor: pointer;
}

.threshold-scope button.is-active {
  color: #cfeff7;
  background: rgba(130, 201, 224, 0.14);
}

.threshold-slider {
  width: 94px;
  height: 14px;
  margin: 0;
  accent-color: #82c9e0;
  cursor: pointer;
}

.threshold-value {
  width: 29px;
  color: #a7bdc3;
  font-family: "Cascadia Mono", "Consolas", monospace;
  font-size: 8px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.threshold-divider {
  width: 1px;
  height: 10px;
  background: #3b3b3b;
}

@media (max-width: 1120px) {
  .threshold-slider {
    width: 72px;
  }
}

@media (max-width: 900px) {
  .threshold-control {
    top: 43px;
    left: 16px;
  }

  .threshold-toggle span {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .threshold-control,
  .threshold-toggle {
    transition: none;
  }
}
</style>
