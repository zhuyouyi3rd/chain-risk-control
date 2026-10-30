<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from 'vue'
import * as echarts from 'echarts/core'
import type { ECharts, EChartsCoreOption } from 'echarts/core'
import {
  GraphChart,
  LinesChart,
  ScatterChart,
} from 'echarts/charts'
import type { GraphSeriesOption } from 'echarts'
import {
  GridComponent,
  TooltipComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { RenderModel } from '../../core/types'
import {
  buildGraphOption,
  buildSourcePulseSeries,
} from '../../render2d/graphOption'
import {
  createLayeredLayout2D,
  type GraphLayout2D,
} from '../../render2d/layout'

echarts.use([
  GraphChart,
  LinesChart,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  CanvasRenderer,
])

const props = defineProps<{
  model: RenderModel
}>()

const emit = defineEmits<{
  nodeClick: [enterpriseId: string]
  backgroundClick: []
}>()

const chartElement = ref<HTMLDivElement | null>(null)
const chartInstance = shallowRef<ECharts | null>(null)

let resizeObserver: ResizeObserver | null = null
let resizeTimer: ReturnType<typeof setTimeout> | null = null
let pulseTimer: ReturnType<typeof setInterval> | null = null
let pulsePhase = 0
let currentLayout: GraphLayout2D | null = null

const chartSummary = computed(() => {
  const counts = { none: 0, low: 0, medium: 0, high: 0, source: 0 }
  for (const node of props.model.nodes) counts[node.level] += 1
  const activeEdges = props.model.edges.filter((edge) => edge.active).length
  return [
    `产业链风险图，${props.model.nodes.length} 个企业，${props.model.edges.length} 条关系。`,
    `风险源 ${counts.source} 个，高风险 ${counts.high} 个，中风险 ${counts.medium} 个，低风险 ${counts.low} 个，无风险 ${counts.none} 个。`,
    `当前有 ${activeEdges} 条关系处于风险传导路径上。`,
  ].join('')
})

const activeEdgeCount = computed(
  () => props.model.edges.filter((edge) => edge.active).length,
)

const highlightedNodeCount = computed(
  () => props.model.nodes.filter((node) => node.highlighted).length,
)
const dimmedNodeCount = computed(
  () => props.model.nodes.filter((node) => node.dimmed).length,
)
const highlightedEdgeCount = computed(
  () => props.model.edges.filter((edge) => edge.highlighted).length,
)
const dimmedEdgeCount = computed(
  () => props.model.edges.filter((edge) => edge.dimmed).length,
)

function renderChart() {
  const element = chartElement.value
  const chart = chartInstance.value
  if (!element || !chart) return

  const width = element.clientWidth
  const height = element.clientHeight
  if (width <= 0 || height <= 0) return

  currentLayout = createLayeredLayout2D(
    props.model.nodes,
    width,
    height,
  )
  chart.resize()
  try {
    chart.dispatchAction({ type: 'hideTip' })
  } catch {
    // Tooltip may not be mounted yet.
  }
  chart.setOption(
    buildGraphOption(props.model, currentLayout) as EChartsCoreOption,
    { notMerge: true, lazyUpdate: false },
  )
}

function scheduleResize() {
  if (resizeTimer) clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    renderChart()
  }, 70)
}

function tickPulse() {
  if (!chartInstance.value || !chartElement.value || !currentLayout) return
  pulsePhase = pulsePhase === 0 ? 1 : 0
  const pulseSeries: GraphSeriesOption = buildSourcePulseSeries(
    props.model,
    currentLayout.positions,
    pulsePhase,
  )
  chartInstance.value.setOption(
    { series: [pulseSeries] } as EChartsCoreOption,
    { notMerge: false, lazyUpdate: true },
  )
}

onMounted(async () => {
  await nextTick()
  const element = chartElement.value
  if (!element) return

  chartInstance.value = echarts.init(element, undefined, {
    renderer: 'canvas',
  })
  chartInstance.value.on('click', (params) => {
    if (params.dataType !== 'node') return
    const data = params.data as { id?: unknown } | undefined
    if (typeof data?.id === 'string') {
      emit('nodeClick', data.id)
    }
  })
  chartInstance.value.getZr().on('click', (event) => {
    // 只有真正点到空白画布才取消聚焦；节点/关系线有 target。
    if (!event?.target) emit('backgroundClick')
  })
  renderChart()

  resizeObserver = new ResizeObserver(scheduleResize)
  resizeObserver.observe(element)
  pulseTimer = setInterval(tickPulse, 950)
})

watch(
  () => props.model,
  async () => {
    await nextTick()
    renderChart()
  },
  { deep: true },
)

onBeforeUnmount(() => {
  if (resizeTimer) clearTimeout(resizeTimer)
  if (pulseTimer) clearInterval(pulseTimer)
  resizeObserver?.disconnect()
  resizeObserver = null
  try {
    chartInstance.value?.dispatchAction({ type: 'hideTip' })
  } catch {
    // Chart may already be torn down.
  }
  chartInstance.value?.dispose()
  chartInstance.value = null
})
</script>

<template>
  <div
    ref="chartElement"
    class="graph-canvas"
    role="img"
    :aria-label="chartSummary"
    :data-node-count="model.nodes.length"
    :data-edge-count="model.edges.length"
    :data-active-edge-count="activeEdgeCount"
    :data-view-mode="model.viewMode ?? 'default'"
    :data-highlighted-node-count="highlightedNodeCount"
    :data-dimmed-node-count="dimmedNodeCount"
    :data-highlighted-edge-count="highlightedEdgeCount"
    :data-dimmed-edge-count="dimmedEdgeCount"
  ></div>
</template>

<style scoped>
.graph-canvas {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  background: #000000;
}

.graph-canvas :deep(canvas) {
  display: block;
}
</style>
