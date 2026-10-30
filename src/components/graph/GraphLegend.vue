<script setup lang="ts">
import { ref } from 'vue'
import { ChevronDown, ChevronUp, Layers3 } from '@lucide/vue'
import {
  ENTERPRISE_TYPE_LABELS,
  RELATION_CATEGORY_LABELS,
} from '../../core/labels'
import type { EnterpriseType, RelationCategory } from '../../core/types'

const collapsed = ref(false)

const enterpriseTypes: Array<{
  type: EnterpriseType
  shape: string
  path: string
}> = [
  {
    type: 'raw_material',
    shape: 'hexagon',
    path: 'M8 1.5 14 4.8v6.4L8 14.5 2 11.2V4.8Z',
  },
  {
    type: 'warehouse',
    shape: 'square',
    path: 'M2.5 2.5h11v11h-11Z',
  },
  {
    type: 'workshop',
    shape: 'triangle',
    path: 'M8 2 14.5 14H1.5Z',
  },
  {
    type: 'trading',
    shape: 'diamond',
    path: 'M8 1.5 14.5 8 8 14.5 1.5 8Z',
  },
  {
    type: 'service',
    shape: 'roundrect',
    path: 'M4 4.5h8a2.5 2.5 0 0 1 2.5 2.5v2A2.5 2.5 0 0 1 12 11.5H4A2.5 2.5 0 0 1 1.5 9V7A2.5 2.5 0 0 1 4 4.5Z',
  },
  {
    type: 'finance',
    shape: 'octagon',
    path: 'M5 1.5h6L14.5 5v6L11 14.5H5L1.5 11V5Z',
  },
]

const relationTypes: RelationCategory[] = [
  'material',
  'capital',
  'tech',
  'guarantee',
]

const riskLevels = [
  { key: 'low', label: '低风险', color: '#FFB74D' },
  { key: 'medium', label: '中风险', color: '#FF8C42' },
  { key: 'high', label: '高风险', color: '#E53935' },
  { key: 'source', label: '风险源', color: '#B71C1C' },
]
</script>

<template>
  <aside
    class="graph-legend"
    :class="{ 'is-collapsed': collapsed }"
    aria-label="风险图图例"
  >
    <button
      class="legend-header"
      type="button"
      :aria-expanded="!collapsed"
      :title="collapsed ? '展开图例' : '收起图例'"
      @click="collapsed = !collapsed"
    >
      <span class="legend-header__title">
        <Layers3 :size="12" aria-hidden="true" />
        图例
      </span>
      <ChevronDown v-if="collapsed" :size="13" aria-hidden="true" />
      <ChevronUp v-else :size="13" aria-hidden="true" />
    </button>

    <div v-if="!collapsed" class="legend-body">
      <section class="legend-section">
        <h3>企业类型</h3>
        <div class="type-grid">
          <span
            v-for="item in enterpriseTypes"
            :key="item.type"
            class="type-item"
          >
            <svg
              class="type-shape"
              viewBox="0 0 16 16"
              aria-hidden="true"
            >
              <path
                :d="item.path"
                fill="#82C9E0"
                stroke="#5AA8C0"
                stroke-width="0.9"
              />
            </svg>
            <span>{{ ENTERPRISE_TYPE_LABELS[item.type] }}</span>
          </span>
        </div>
      </section>

      <section class="legend-section">
        <h3>关系类型</h3>
        <div class="relation-list">
          <span
            v-for="category in relationTypes"
            :key="category"
            class="relation-item"
          >
            <i
              class="relation-line"
              :class="`relation-line--${category}`"
              aria-hidden="true"
            ></i>
            <span>{{ RELATION_CATEGORY_LABELS[category] }}</span>
          </span>
        </div>
      </section>

      <section class="legend-section">
        <h3>风险等级</h3>
        <div class="risk-grid">
          <span
            v-for="item in riskLevels"
            :key="item.key"
            class="risk-item"
          >
            <i
              class="risk-sample"
              :class="`risk-sample--${item.key}`"
              :style="{ '--risk-color': item.color }"
              aria-hidden="true"
            ></i>
            <span>{{ item.label }}</span>
          </span>
        </div>
      </section>

      <section class="legend-section legend-section--compact">
        <h3>同控表达</h3>
        <div class="control-item">
          <i class="control-ring" aria-hidden="true"></i>
          <span>同色外环 = 同一控制人</span>
        </div>
      </section>

      <p class="routing-note">
        同色系不同深浅表示同类关系的不同连线，非不同关系类型
      </p>
    </div>
  </aside>
</template>

<style scoped>
.graph-legend {
  position: absolute;
  right: 16px;
  bottom: 42px;
  z-index: 7;
  width: 232px;
  overflow: hidden;
  background: rgba(22, 22, 22, 0.94);
  border: 1px solid #3a3a3a;
  border-radius: 6px;
  box-shadow: 0 16px 38px rgba(0, 0, 0, 0.46);
  backdrop-filter: blur(10px);
}

.graph-legend.is-collapsed {
  width: 84px;
}

.legend-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 30px;
  padding: 0 9px 0 10px;
  color: #aeb5b8;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.legend-header:hover {
  color: #e0e0e0;
  background: rgba(255, 255, 255, 0.035);
}

.legend-header__title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.legend-header__title svg {
  color: var(--accent);
}

.legend-body {
  max-height: 330px;
  padding: 0 10px 8px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #444444 transparent;
}

.legend-body::-webkit-scrollbar {
  width: 4px;
}

.legend-body::-webkit-scrollbar-thumb {
  background: #444444;
  border-radius: 999px;
}

.legend-section {
  padding-top: 8px;
  border-top: 1px solid #303030;
}

.legend-section:first-child {
  padding-top: 4px;
  border-top: 0;
}

.legend-section h3 {
  margin: 0 0 6px;
  color: #6e777b;
  font-size: 7px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.type-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 8px;
}

.type-item {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 6px;
  color: #9ca4a7;
  font-size: 8.5px;
  white-space: nowrap;
}

.type-shape {
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
}

.relation-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.relation-item {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #9ca4a7;
  font-size: 8px;
}

.relation-line {
  display: inline-block;
  width: 24px;
  height: 0;
  flex: 0 0 auto;
  border-top: 1px solid currentColor;
}

.relation-line--material {
  color: #4a90d9;
}

.relation-line--capital {
  color: #9b59b6;
  border-top-style: dashed;
}

.relation-line--tech {
  color: #1abc9c;
  border-top-style: dotted;
}

.relation-line--guarantee {
  color: #2e7d32;
  border-top-width: 2px;
}

.risk-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5px 8px;
}

.risk-item {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #9ca4a7;
  font-size: 8px;
  white-space: nowrap;
}

.risk-sample {
  width: 13px;
  height: 13px;
  flex: 0 0 auto;
  background: #82c9e0;
  border: 2px solid var(--risk-color);
  border-radius: 50%;
}

.risk-sample--medium {
  border-width: 3px;
  box-shadow: 0 0 6px rgba(255, 140, 66, 0.45);
}

.risk-sample--high {
  border-width: 4px;
  box-shadow: 0 0 7px rgba(229, 57, 53, 0.55);
}

.risk-sample--source {
  width: 15px;
  height: 15px;
  border-width: 1.5px;
  box-shadow:
    0 0 0 2px #161616,
    0 0 0 3px #b71c1c,
    0 0 8px rgba(183, 28, 28, 0.5);
}

.control-ring {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
  border: 1px solid #8e7cc3;
  border-radius: 50%;
}

.control-item {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #9ca4a7;
  font-size: 8px;
}

.routing-note {
  margin: 7px 10px 9px;
  padding-top: 7px;
  color: #68777c;
  font-size: 8px;
  line-height: 1.55;
  border-top: 1px solid #2e383b;
}

@media (max-height: 760px) {
  .graph-legend {
    bottom: 38px;
  }

  .legend-body {
    max-height: 280px;
  }
}
</style>
