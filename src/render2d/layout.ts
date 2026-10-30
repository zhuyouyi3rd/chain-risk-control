import type { EnterpriseType, RenderNode } from '../core/types'
import { NODE_LABEL_DISTANCE, NODE_SIZES } from './theme'

export interface GraphPoint {
  x: number
  y: number
}

export interface GraphNodeSlot {
  id: string
  name: string
  type: EnterpriseType
  x: number
  y: number
  width: number
  height: number
  layer: number
  symbolLeft: number
  symbolRight: number
  symbolTop: number
  symbolBottom: number
  labelLeft: number
  labelRight: number
  labelTop: number
  labelBottom: number
  boundsLeft: number
  boundsRight: number
  boundsTop: number
  boundsBottom: number
}

export interface GraphLayout2D {
  width: number
  height: number
  positions: Record<string, GraphPoint>
  slots: Record<string, GraphNodeSlot>
}

const LAYER_ORDER: Record<EnterpriseType, number> = {
  raw_material: 0,
  warehouse: 1,
  workshop: 2,
  trading: 3,
  finance: 4,
  service: 5,
}

const LAYER_COUNT = 6
const ROW_GAP = 112
const LABEL_FONT_SIZE = 11
const LABEL_HEIGHT = 16
const LABEL_PADDING_X = 5
const LABEL_HIT_PADDING = 5

function labelWidth(name: string): number {
  let width = 0
  for (const character of name) {
    width += character.charCodeAt(0) > 255 ? LABEL_FONT_SIZE : 6.3
  }
  return Math.max(20, width + LABEL_PADDING_X * 2)
}

function nodeSize(node: RenderNode): { width: number; height: number } {
  const size = NODE_SIZES[node.type]
  if (Array.isArray(size)) return { width: size[0], height: size[1] }
  return { width: size, height: size }
}

export function createLayeredLayout2D(
  nodes: RenderNode[],
  width: number,
  height: number,
): GraphLayout2D {
  const compact = width < 640 || height < 620
  const left = compact ? 58 : 82
  const right = compact ? 52 : 82
  const top = compact ? 62 : 78
  const bottom = compact ? 92 : 108
  const innerWidth = Math.max(1, width - left - right)
  const innerHeight = Math.max(1, height - top - bottom)
  const layerGap = innerWidth / (LAYER_COUNT - 1)
  const centerY = top + innerHeight / 2
  const serviceYOffset = compact ? -48 : -70
  const byLayer = new Map<number, RenderNode[]>()

  for (const node of nodes) {
    const layer = LAYER_ORDER[node.type] ?? 0
    const list = byLayer.get(layer) ?? []
    list.push(node)
    byLayer.set(layer, list)
  }

  const slots: Record<string, GraphNodeSlot> = {}
  const positions: Record<string, GraphPoint> = {}

  for (let layer = 0; layer < LAYER_COUNT; layer += 1) {
    const layerNodes = byLayer.get(layer) ?? []
    const sorted = [...layerNodes].sort((a, b) => a.id.localeCompare(b.id))
    const x = left + layer * layerGap
    const gap = Math.min(ROW_GAP, innerHeight / 2.15)
    sorted.forEach((node, index) => {
      const offset =
        sorted.length <= 1
          ? 0
          : (index - (sorted.length - 1) / 2) * gap
      const size = nodeSize(node)
      const y =
        centerY +
        offset +
        (layer === 5 ? serviceYOffset : 0)
      const symbolLeft = x - size.width / 2
      const symbolRight = x + size.width / 2
      const symbolTop = y - size.height / 2
      const symbolBottom = y + size.height / 2
      // ECharts 的 label 位于 symbol 下方，distance 是两者间距。
      const labelTop = symbolBottom + NODE_LABEL_DISTANCE
      const labelBottom = labelTop + LABEL_HEIGHT
      const measuredLabelWidth = labelWidth(node.name)
      const labelLeft = x - measuredLabelWidth / 2 - LABEL_HIT_PADDING
      const labelRight = x + measuredLabelWidth / 2 + LABEL_HIT_PADDING
      slots[node.id] = {
        id: node.id,
        name: node.name,
        type: node.type,
        x,
        y,
        width: size.width,
        height: size.height,
        layer,
        symbolLeft,
        symbolRight,
        symbolTop,
        symbolBottom,
        labelLeft,
        labelRight,
        labelTop,
        labelBottom,
        boundsLeft: Math.min(symbolLeft, labelLeft),
        boundsRight: Math.max(symbolRight, labelRight),
        boundsTop: symbolTop,
        boundsBottom: labelBottom,
      }
      positions[node.id] = { x, y }
    })
  }

  return { width, height, positions, slots }
}

/** 兼容旧调用：只返回节点坐标。 */
export function createFixedLayout(
  nodes: RenderNode[],
  width: number,
  height: number,
): Record<string, GraphPoint> {
  return createLayeredLayout2D(nodes, width, height).positions
}
