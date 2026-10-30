import type {
  EChartsOption,
  GraphSeriesOption,
  LinesSeriesOption,
  ScatterSeriesOption,
} from 'echarts'
import {
  ENTERPRISE_TYPE_LABELS,
  RELATION_CATEGORY_LABELS,
  RISK_LEVEL_LABELS,
} from '../core/labels'
import type {
  EnterpriseType,
  RelationCategory,
  RenderEdge,
  RenderModel,
  RenderNode,
  RiskLevel,
} from '../core/types'
import { routeGraph2D } from './OrthogonalRouter2D'
import type { GraphLayout2D, GraphPoint } from './layout'
import {
  baseNodeDimension,
  CONTROL_RING_COLOR,
  EDGE_COLORS,
  EDGE_DASHES,
  EDGE_WIDTHS,
  NODE_FILL,
  NODE_LABEL_COLOR,
  NODE_LABEL_DISTANCE,
  NODE_RISK_STYLES,
  NODE_SIZES,
  NODE_SYMBOLS,
  RISK_EDGE_COLORS,
  SAFE_EDGE_COLOR,
  SOURCE_COLOR,
} from './theme'

const FONT_FAMILY =
  'Inter, "Segoe UI Variable", "Segoe UI", "Noto Sans SC", "Microsoft YaHei", sans-serif'

interface GraphNodeDatum {
  id: string
  name: string
  x: number
  y: number
  symbol: string
  symbolSize: number | number[]
  value: [number, number]
  itemStyle: {
    color: string
    borderColor: string
    borderWidth: number
    shadowBlur: number
    shadowColor: string
    opacity: number
  }
  label: {
    show: boolean
    position: 'bottom'
    distance: number
    color: string
    fontSize: number
    fontFamily: string
    fontWeight: number
    formatter: string
    textBorderColor: string
    textBorderWidth: number
    opacity: number
  }
  riskLevel: RiskLevel
  enterpriseType: EnterpriseType
  impact: number
  controllerGroup?: string
  cursor: 'pointer'
}

interface LineDatum {
  coords: [number, number][]
  edgeId: string
  source: string
  target: string
  edgeActive: boolean
  edgeRiskLevel: RiskLevel
  category: RelationCategory
  association: number
  lineStyle: {
    color: string
    width: number
    type: 'solid' | number[]
    opacity: number
    cap: 'round'
    join: 'round' | 'miter'
    shadowBlur: number
    shadowColor: string
  }
}

interface RingNodeDatum {
  id: string
  name: string
  x: number
  y: number
  value: [number, number]
  symbol: 'circle'
  symbolSize: number
  itemStyle: {
    color: string
    borderColor: string
    borderWidth: number
    opacity: number
  }
  label: { show: false }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatImpact(value: number): string {
  return Number(value.toFixed(5)).toString()
}

function rgbToHsl(hex: string): [number, number, number] {
  const value = hex.replace('#', '')
  const r = parseInt(value.slice(0, 2), 16) / 255
  const g = parseInt(value.slice(2, 4), 16) / 255
  const b = parseInt(value.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const delta = max - min
  const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min)
  let h = 0
  if (max === r) h = (g - b) / delta + (g < b ? 6 : 0)
  else if (max === g) h = (b - r) / delta + 2
  else h = (r - g) / delta + 4
  return [h / 6, s, l]
}

function hslToHex(h: number, s: number, l: number): string {
  const hueToRgb = (p: number, q: number, t: number): number => {
    let value = t
    if (value < 0) value += 1
    if (value > 1) value -= 1
    if (value < 1 / 6) return p + (q - p) * 6 * value
    if (value < 1 / 2) return q
    if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const r = hueToRgb(p, q, h + 1 / 3)
  const g = hueToRgb(p, q, h)
  const b = hueToRgb(p, q, h - 1 / 3)
  return `#${[r, g, b]
    .map((channel) =>
      Math.round(Math.max(0, Math.min(255, channel * 255)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}

/** Keep hue, adjust lightness by ±8% / ±16%. */
function colorVariant(hex: string, variant: number): string {
  if (variant <= 0) return hex
  const [h, s, l] = rgbToHsl(hex)
  const delta = variant === 1 ? 0.08 : variant === 2 ? -0.08 : 0.16
  return hslToHex(h, s, Math.max(0.08, Math.min(0.92, l + delta)))
}

function pointOf(
  positions: Record<string, GraphPoint>,
  id: string,
): GraphPoint {
  return positions[id] ?? { x: 0, y: 0 }
}

function cartesianSeries<T extends GraphSeriesOption>(series: T): T {
  return {
    ...series,
    coordinateSystem: 'cartesian2d',
    xAxisIndex: 0,
    yAxisIndex: 0,
  } as T
}

export function buildGraphOption(
  model: RenderModel,
  layout: GraphLayout2D,
): EChartsOption {
  const positions = layout.positions
  const reverseMode = model.viewMode === 'reverse'
  const focusActive = model.nodes.some((node) => node.highlighted)
  const dimOpacity = reverseMode ? 0 : focusActive ? 0.15 : 0.2
  const axisPadding = 14
  const routes = routeGraph2D(model.edges, layout)

  function pointFor(id: string): GraphPoint {
    return pointOf(positions, id)
  }

  const nodeData: GraphNodeDatum[] = model.nodes.map((node) => {
    const point = pointFor(node.id)
    const riskStyle = NODE_RISK_STYLES[node.level]
    return {
      id: node.id,
      name: node.name,
      x: point.x,
      y: point.y,
      value: [point.x, point.y],
      symbol: NODE_SYMBOLS[node.type],
      symbolSize: NODE_SIZES[node.type],
      itemStyle: {
        color: NODE_FILL,
        borderColor: riskStyle.borderColor,
        borderWidth: riskStyle.borderWidth,
        shadowBlur: riskStyle.shadowBlur,
        shadowColor: riskStyle.shadowColor,
        opacity: node.dimmed ? dimOpacity : 1,
      },
      label: {
        show: true,
        position: 'bottom',
        distance: NODE_LABEL_DISTANCE,
        color: node.highlighted ? '#FFFFFF' : NODE_LABEL_COLOR,
        fontSize: 11,
        fontFamily: FONT_FAMILY,
        fontWeight: node.highlighted ? 600 : 400,
        formatter: '{b}',
        textBorderColor: '#000000',
        textBorderWidth: 2,
        backgroundColor: 'rgba(0, 0, 0, 0.62)',
        padding: [2, 4],
        borderRadius: 2,
        opacity: node.dimmed ? dimOpacity : 1,
      },
      riskLevel: node.level,
      enterpriseType: node.type,
      impact: node.impact,
      ...(node.controllerGroup
        ? { controllerGroup: node.controllerGroup }
        : {}),
      cursor: 'pointer',
    }
  })

  const lineData: LineDatum[] = model.edges.map((edge: RenderEdge) => {
    const normalColor = EDGE_COLORS[edge.category]
    const isActive = !reverseMode && edge.active && edge.riskLevel !== 'none'
    const variant = isActive ? 0 : routes.colorVariant[edge.id] ?? 0
    const color = reverseMode
      ? SAFE_EDGE_COLOR
      : isActive
        ? RISK_EDGE_COLORS[edge.riskLevel]
        : colorVariant(normalColor, variant)
    const highlighted = edge.highlighted
    return {
      coords: (
        routes.paths[edge.id] ?? [pointFor(edge.from), pointFor(edge.to)]
      ).map((point) => [point.x, point.y]),
      edgeId: edge.id,
      source: edge.from,
      target: edge.to,
      edgeActive: edge.active,
      edgeRiskLevel: edge.riskLevel,
      category: edge.category,
      association: edge.association,
      lineStyle: {
        color,
        width:
          EDGE_WIDTHS[edge.category] +
          (!reverseMode && isActive ? 1 : 0) +
          (highlighted ? 0.6 : 0),
        type:
          variant >= 3 && !isActive
            ? [3, 3]
            : EDGE_DASHES[edge.category],
        opacity: edge.dimmed ? dimOpacity : 1,
        cap: 'round',
        join: 'round',
        shadowBlur:
          edge.dimmed || reverseMode
            ? 0
            : isActive
              ? 8
              : highlighted
                ? 10
                : 0,
        shadowColor:
          edge.dimmed || reverseMode
            ? 'transparent'
            : isActive || highlighted
              ? color
              : 'transparent',
      },
    }
  })

  const linesSeries = {
    id: 'relations',
    type: 'lines',
    coordinateSystem: 'cartesian2d',
    xAxisIndex: 0,
    yAxisIndex: 0,
    polyline: true,
    triggerLineEvent: true,
    z: 5,
    silent: false,
    animation: false,
    symbol: ['none', 'arrow'],
    symbolSize: [0, 7],
    lineStyle: {
      color: EDGE_COLORS.material,
      width: 1.5,
      opacity: 1,
      cap: 'round',
      join: 'round',
    },
    emphasis: {
      focus: 'none',
      lineStyle: { width: 3 },
    },
    data: lineData as LinesSeriesOption['data'],
  } as LinesSeriesOption & { triggerLineEvent: boolean }

  function ringSeries(
    id: string,
    options: {
      color: string
      borderWidth: number
      opacity: number
      z: number
      sizeFor: (node: RenderNode) => number
      animate?: boolean
    },
  ): GraphSeriesOption {
    const data: RingNodeDatum[] = model.nodes.map((node) => {
      const point = pointFor(node.id)
      const size = options.sizeFor(node)
      // 暗化节点连底环一起收起，避免残留一圈暗影。
      const ringVisible = size > 0 && !node.dimmed
      return {
        id: `${id}-${node.id}`,
        name: '',
        x: point.x,
        y: point.y,
        value: [point.x, point.y],
        symbol: 'circle',
        symbolSize: ringVisible ? size : 0.01,
        itemStyle: {
          color: 'rgba(0, 0, 0, 0)',
          borderColor: options.color,
          borderWidth: ringVisible ? options.borderWidth : 0,
          opacity: ringVisible ? options.opacity : 0,
        },
        label: { show: false },
      }
    })
    return cartesianSeries({
      id,
      type: 'graph',
      layout: 'none',
      roam: false,
      silent: true,
      z: options.z,
      animation: options.animate ?? false,
      animationDurationUpdate: options.animate ? 760 : 0,
      label: { show: false },
      lineStyle: { opacity: 0 },
      data: data as GraphSeriesOption['data'],
    })
  }

  const controlMembers = new Set(
    model.groups.flatMap((group) => group.members),
  )
  const sourceIds = new Set(
    model.nodes
      .filter((node) => node.level === 'source')
      .map((node) => node.id),
  )

  const controlRing = ringSeries('control-rings', {
    color: CONTROL_RING_COLOR,
    borderWidth: 1,
    opacity: 0.78,
    z: 2,
    sizeFor: (node) =>
      controlMembers.has(node.id)
        ? baseNodeDimension(node.type) + 20
        : 0,
  })

  const sourceRing = ringSeries('source-rings', {
    color: SOURCE_COLOR,
    borderWidth: 2,
    opacity: 0.9,
    z: 3,
    sizeFor: (node) =>
      sourceIds.has(node.id) ? baseNodeDimension(node.type) + 10 : 0,
  })

  const sourcePulse = ringSeries('source-pulse', {
    color: SOURCE_COLOR,
    borderWidth: 1.5,
    opacity: 0.5,
    z: 4,
    animate: true,
    sizeFor: (node) =>
      sourceIds.has(node.id) ? baseNodeDimension(node.type) + 14 : 0,
  })

  const selectionRing = ringSeries('selection-rings', {
    color: '#E0F7FF',
    borderWidth: 1.5,
    opacity: 0.92,
    z: 5,
    sizeFor: (node) =>
      node.highlighted ? baseNodeDimension(node.type) + 28 : 0,
  })

  const mainSeries = cartesianSeries<GraphSeriesOption>({
    id: 'main-graph',
    type: 'graph',
    layout: 'none',
    roam: false,
    draggable: false,
    animation: false,
    z: 10,
    data: nodeData as GraphSeriesOption['data'],
    label: {
      show: true,
      color: NODE_LABEL_COLOR,
      fontFamily: FONT_FAMILY,
    },
    emphasis: {
      scale: 1.05,
      label: {
        color: '#FFFFFF',
        fontWeight: 600,
      },
    },
  })

  const crossingSeries: ScatterSeriesOption = {
    id: 'crossing-points',
    type: 'scatter',
    coordinateSystem: 'cartesian2d',
    xAxisIndex: 0,
    yAxisIndex: 0,
    silent: true,
    z: 7,
    symbol: 'circle',
    symbolSize: 5,
    itemStyle: {
      color: '#080D0F',
      borderColor: '#B6C2C6',
      borderWidth: 1,
    },
    data: routes.crossings.map((point) => [
      point.x,
      point.y,
    ]) as never,
  }

  const tooltipFormatter = (params: unknown): string => {
    const item = params as {
      data?: Record<string, unknown>
      seriesType?: string
    }
    const data = item.data ?? {}
    const isLine =
      item.seriesType === 'lines' || typeof data.edgeId === 'string'

    if (isLine) {
      const category = data.category as RelationCategory
      const riskLevel = data.edgeRiskLevel as RiskLevel
      const active = Boolean(data.edgeActive)
      return [
        '<div style="min-width:150px">',
        `<div style="color:#E0E0E0;font-size:12px;font-weight:600;margin-bottom:6px">${escapeHtml(
          String(data.edgeId ?? '关系'),
        )}</div>`,
        `<div style="color:#9E9E9E;font-size:11px;line-height:1.7">${escapeHtml(
          String(data.source ?? ''),
        )} → ${escapeHtml(String(data.target ?? ''))}</div>`,
        `<div style="color:#9E9E9E;font-size:11px;line-height:1.7">${escapeHtml(
          RELATION_CATEGORY_LABELS[category] ?? String(category ?? ''),
        )} · association ${formatImpact(
          Number(data.association ?? 0),
        )}</div>`,
        `<div style="margin-top:5px;color:${
          active ? RISK_EDGE_COLORS[riskLevel] : '#7C8589'
        };font-size:11px">${
          active
            ? `传导中 · ${RISK_LEVEL_LABELS[riskLevel] ?? riskLevel}`
            : '常态关系'
        }</div>`,
        '</div>',
      ].join('')
    }

    const type = data.enterpriseType as EnterpriseType
    const level = data.riskLevel as RiskLevel
    const group = data.controllerGroup
      ? `<div style="color:#9E9E9E;font-size:11px;line-height:1.7">同控组：${escapeHtml(
          String(data.controllerGroup),
        )}</div>`
      : ''
    return [
      '<div style="min-width:150px">',
      `<div style="color:#E0E0E0;font-size:12px;font-weight:600;margin-bottom:6px">${escapeHtml(
        String(data.name ?? ''),
      )}</div>`,
      `<div style="color:#9E9E9E;font-size:11px;line-height:1.7">${escapeHtml(
        ENTERPRISE_TYPE_LABELS[type] ?? String(type ?? ''),
      )}</div>`,
      `<div style="color:${
        NODE_RISK_STYLES[level]?.borderColor ?? NODE_LABEL_COLOR
      };font-size:11px;line-height:1.7">${
        RISK_LEVEL_LABELS[level] ?? level
      } · impact ${formatImpact(Number(data.impact ?? 0))}</div>`,
      group,
      '</div>',
    ].join('')
  }

  return {
    backgroundColor: 'transparent',
    animation: true,
    animationDuration: 420,
    animationDurationUpdate: 520,
    textStyle: { fontFamily: FONT_FAMILY },
    grid: {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      containLabel: false,
    },
    xAxis: {
      type: 'value',
      min: -axisPadding,
      max: layout.width + axisPadding,
      show: false,
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      min: -axisPadding,
      max: layout.height + axisPadding,
      inverse: true,
      show: false,
      splitLine: { show: false },
    },
    tooltip: {
      trigger: 'item',
      confine: true,
      position: ((point: number[], _params: unknown, _dom: unknown, _rect: unknown, size: { contentSize: number[] }) => {
        const [x, y] = point
        const [contentWidth = 200, contentHeight = 100] =
          size?.contentSize ?? []
        let left = x + 16
        // Keep tooltips out of the legend in the lower-right corner.
        if (left + contentWidth > layout.width - 260) {
          left = x - contentWidth - 16
        }
        if (left < 8) left = 8
        let top = y + 12
        if (top + contentHeight > layout.height - 16) {
          top = layout.height - contentHeight - 16
        }
        return [left, top]
      }) as never,
      backgroundColor: 'rgba(24, 24, 24, 0.97)',
      borderColor: '#414141',
      borderWidth: 1,
      padding: 10,
      textStyle: {
        color: '#E0E0E0',
        fontFamily: FONT_FAMILY,
        fontSize: 11,
      },
      extraCssText:
        'box-shadow: 0 14px 38px rgba(0,0,0,.55); border-radius: 6px;',
      formatter: tooltipFormatter,
    },
    series: [
      controlRing,
      sourcePulse,
      sourceRing,
      selectionRing,
      linesSeries,
      crossingSeries,
      mainSeries,
    ],
  }
}

export function buildSourcePulseSeries(
  model: RenderModel,
  positions: Record<string, GraphPoint>,
  phase: number,
): GraphSeriesOption {
  const sourceIds = new Set(
    model.nodes
      .filter((node) => node.level === 'source')
      .map((node) => node.id),
  )
  const data: RingNodeDatum[] = model.nodes.map((node) => {
    const point = pointOf(positions, node.id)
    const isSource = sourceIds.has(node.id)
    const size = isSource
      ? baseNodeDimension(node.type) + 14 + phase * 8
      : 0
    const pulseVisible = size > 0 && !node.dimmed
    return {
      id: `source-pulse-${node.id}`,
      name: '',
      x: point.x,
      y: point.y,
      value: [point.x, point.y],
      symbol: 'circle',
      symbolSize: pulseVisible ? size : 0.01,
      itemStyle: {
        color: 'rgba(0, 0, 0, 0)',
        borderColor: SOURCE_COLOR,
        borderWidth: pulseVisible ? 1.5 : 0,
        opacity: pulseVisible ? 0.52 - phase * 0.3 : 0,
      },
      label: { show: false },
    }
  })
  return cartesianSeries({
    id: 'source-pulse',
    type: 'graph',
    layout: 'none',
    roam: false,
    silent: true,
    z: 4,
    animation: true,
    animationDurationUpdate: 760,
    label: { show: false },
    lineStyle: { opacity: 0 },
    data: data as GraphSeriesOption['data'],
  })
}
