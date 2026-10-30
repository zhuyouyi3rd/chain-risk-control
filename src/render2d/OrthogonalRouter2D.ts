import type { RenderEdge } from '../core/types'
import type { GraphLayout2D, GraphNodeSlot, GraphPoint } from './layout'

const EXIT_GAP = 2
const NODE_CLEARANCE = 2
const TURN_COST = 18
const OTHER_COLOR_COST = 2
const MIN_SEGMENT = 0.5

interface EndpointPair {
  start: GraphPoint
  end: GraphPoint
  startSide: PortSide
  endSide: PortSide
}

type PortSide = 'left' | 'right' | 'top' | 'bottom'

const PORT_SPACING = 16

function sideBetween(from: GraphNodeSlot, to: GraphNodeSlot): PortSide {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left'
  return dy >= 0 ? 'bottom' : 'top'
}

function portPoint(
  slot: GraphNodeSlot,
  side: PortSide,
  offset: number,
): GraphPoint {
  const inset = 4
  if (side === 'left') {
    const y = Math.max(
      slot.symbolTop + inset,
      Math.min(slot.symbolBottom - inset, slot.y + offset),
    )
    return { x: slot.symbolLeft - EXIT_GAP, y }
  }
  if (side === 'right') {
    const y = Math.max(
      slot.symbolTop + inset,
      Math.min(slot.symbolBottom - inset, slot.y + offset),
    )
    return { x: slot.symbolRight + EXIT_GAP, y }
  }
  if (side === 'top') {
    const x = Math.max(
      slot.symbolLeft + inset,
      Math.min(slot.symbolRight - inset, slot.x + offset),
    )
    return { x, y: slot.symbolTop - EXIT_GAP }
  }
  const x = Math.max(
    slot.labelLeft + inset,
    Math.min(slot.labelRight - inset, slot.x + offset),
  )
  // 下方进入时吸附到文字底部，避免穿过标签。
  return { x, y: slot.labelBottom + EXIT_GAP }
}

/**
 * Assign one port per incident edge so that same-node edges do not all start
 * from the same point. This is the main defense against coincident segments.
 */
function buildPorts(
  edges: RenderEdge[],
  slots: Record<string, GraphNodeSlot>,
): Map<string, EndpointPair> {
  const requests: Array<{
    edgeId: string
    end: 'start' | 'end'
    slot: GraphNodeSlot
    preferred: PortSide
    side: PortSide
    key: string
  }> = []
  for (const edge of edges) {
    const from = slots[edge.from]
    const to = slots[edge.to]
    if (!from || !to) continue
    const startSide = sideBetween(from, to)
    const endSide = sideBetween(to, from)
    requests.push({
      edgeId: edge.id,
      end: 'start',
      slot: from,
      preferred: startSide,
      side: startSide,
      key: '',
    })
    requests.push({
      edgeId: edge.id,
      end: 'end',
      slot: to,
      preferred: endSide,
      side: endSide,
      key: '',
    })
  }

  // Spread incident edges over multiple sides. Keeping every edge on its
  // geometrically preferred side makes them converge into the same port row.
  const bySlot = new Map<string, typeof requests>()
  for (const request of requests) {
    const list = bySlot.get(request.slot.id) ?? []
    list.push(request)
    bySlot.set(request.slot.id, list)
  }
  const sides: PortSide[] = ['right', 'left', 'bottom', 'top']
  for (const list of bySlot.values()) {
    const sorted = [...list].sort((a, b) =>
      `${a.edgeId}:${a.end}`.localeCompare(`${b.edgeId}:${b.end}`),
    )
    sorted.forEach((request, index) => {
      if (index < 2) {
        request.side = request.preferred
        return
      }
      const alternatives = sides.filter((side) => side !== request.preferred)
      request.side = alternatives[(index - 2) % alternatives.length]
    })
  }

  const grouped = new Map<string, typeof requests>()
  for (const request of requests) {
    request.key = `${request.slot.id}:${request.side}`
    const list = grouped.get(request.key) ?? []
    list.push(request)
    grouped.set(request.key, list)
  }

  const points = new Map<string, GraphPoint>()
  for (const list of grouped.values()) {
    const sorted = [...list].sort((a, b) =>
      `${a.edgeId}:${a.end}`.localeCompare(`${b.edgeId}:${b.end}`),
    )
    sorted.forEach((request, index) => {
      const offset = (index - (sorted.length - 1) / 2) * PORT_SPACING
      points.set(
        `${request.edgeId}:${request.end}`,
        portPoint(request.slot, request.side, offset),
      )
    })
  }

  const result = new Map<string, EndpointPair>()
  const sidesByEdge = new Map<string, { start: PortSide; end: PortSide }>()
  for (const request of requests) {
    const current = sidesByEdge.get(request.edgeId) ?? {
      start: 'right' as PortSide,
      end: 'left' as PortSide,
    }
    if (request.end === 'start') current.start = request.side
    else current.end = request.side
    sidesByEdge.set(request.edgeId, current)
  }
  for (const edge of edges) {
    const start = points.get(`${edge.id}:start`)
    const end = points.get(`${edge.id}:end`)
    const sides = sidesByEdge.get(edge.id)
    if (start && end && sides) {
      result.set(edge.id, {
        start,
        end,
        startSide: sides.start,
        endSide: sides.end,
      })
    }
  }
  return result
}

function outwardPoint(
  _slot: GraphNodeSlot,
  side: PortSide,
  endpoint: GraphPoint,
  distance = 12,
): GraphPoint {
  if (side === 'left') return { x: endpoint.x - distance, y: endpoint.y }
  if (side === 'right') return { x: endpoint.x + distance, y: endpoint.y }
  if (side === 'top') return { x: endpoint.x, y: endpoint.y - distance }
  return { x: endpoint.x, y: endpoint.y + distance }
}

export interface GraphRoutingResult {
  paths: Record<string, GraphPoint[]>
  /** 2~3 个同色系色阶；0 表示原色。 */
  colorVariant: Record<string, number>
  crossings: GraphPoint[]
  sameColorConflicts: string[]
}

function direction(from: number, to: number): number {
  if (to > from + 0.01) return 1
  if (to < from - 0.01) return -1
  return 0
}

function addMidpoints(values: number[]): number[] {
  const sorted = [...new Set(values.map((value) => Math.round(value * 1000) / 1000))]
    .sort((a, b) => a - b)
  const result: number[] = []
  for (let index = 0; index < sorted.length; index += 1) {
    result.push(sorted[index])
    if (index < sorted.length - 1) {
      const gap = sorted[index + 1] - sorted[index]
      if (gap > 18) result.push((sorted[index] + sorted[index + 1]) / 2)
    }
  }
  return result
}

function pointInsideSlot(
  x: number,
  y: number,
  slot: GraphNodeSlot,
): boolean {
  const insideSymbol =
    Math.abs(x - slot.x) < slot.width / 2 + NODE_CLEARANCE &&
    Math.abs(y - slot.y) < slot.height / 2 + NODE_CLEARANCE
  const insideLabel =
    x > slot.labelLeft - NODE_CLEARANCE &&
    x < slot.labelRight + NODE_CLEARANCE &&
    y > slot.labelTop - NODE_CLEARANCE &&
    y < slot.labelBottom + NODE_CLEARANCE
  return insideSymbol || insideLabel
}

function segmentKey(
  orientation: 'h' | 'v',
  fixed: number,
  from: number,
  to: number,
): string {
  return `${orientation}:${Math.round(fixed * 10)}:${Math.round(
    Math.min(from, to) * 10,
  )}-${Math.round(Math.max(from, to) * 10)}`
}

function hasUsedOverlap(segments: Set<string>, key: string): boolean {
  const [orientation, fixedText, rangeText] = key.split(':')
  const fixed = Number(fixedText)
  const [fromText, toText] = rangeText.split('-')
  const from = Number(fromText)
  const to = Number(toText)
  for (const usedKey of segments) {
    const [usedOrientation, usedFixedText, usedRangeText] =
      usedKey.split(':')
    if (usedOrientation !== orientation) continue
    if (Number(usedFixedText) !== fixed) continue
    const [usedFromText, usedToText] = usedRangeText.split('-')
    const usedFrom = Number(usedFromText)
    const usedTo = Number(usedToText)
    if (Math.min(to, usedTo) > Math.max(from, usedFrom)) return true
  }
  return false
}

function routeOne(
  edge: RenderEdge,
  from: GraphNodeSlot,
  to: GraphNodeSlot,
  endpoints: EndpointPair,
  xCoords: number[],
  yCoords: number[],
  blocked: boolean[][],
  usedSegments: Map<string, Set<string>>,
): GraphPoint[] {
  let startX = xCoords.findIndex(
    (value) => Math.abs(value - endpoints.start.x) < 0.01,
  )
  const startY = yCoords.findIndex(
    (value) => Math.abs(value - endpoints.start.y) < 0.01,
  )
  let endX = xCoords.findIndex(
    (value) => Math.abs(value - endpoints.end.x) < 0.01,
  )
  let endY = yCoords.findIndex(
    (value) => Math.abs(value - endpoints.end.y) < 0.01,
  )
  if (startX < 0 || startY < 0 || endX < 0 || endY < 0) {
    return [
      endpoints.start,
      { x: endpoints.end.x, y: endpoints.start.y },
      endpoints.end,
    ]
  }
  if (blocked[startY]?.[startX]) {
    // Start sits on the expanded rectangle of its own node; nudge outward.
    const outward = direction(from.x, to.x) || 1
    startX = xCoords.reduce(
      (best, value, index) =>
        !blocked[startY]?.[index] &&
        Math.abs(value - (from.x + outward * (from.width / 2 + 6))) <
          Math.abs(xCoords[best] - (from.x + outward * (from.width / 2 + 6)))
          ? index
          : best,
      0,
    )
  }
  if (blocked[endY]?.[endX]) {
    const outward = direction(to.x, from.x) || 1
    endX = xCoords.reduce(
      (best, value, index) =>
        !blocked[endY]?.[index] &&
        Math.abs(value - (to.x + outward * (to.width / 2 + 6))) <
          Math.abs(xCoords[best] - (to.x + outward * (to.width / 2 + 6)))
          ? index
          : best,
      0,
    )
  }

  const width = xCoords.length
  const height = yCoords.length
  const stateCount = width * height * 5
  const distance = new Float64Array(stateCount)
  distance.fill(Number.POSITIVE_INFINITY)
  const previous = new Int32Array(stateCount)
  previous.fill(-1)
  const open: number[] = []
  const startState = (startY * width + startX) * 5 + 4
  distance[startState] = 0
  open.push(startState)

  const neighbors = [
    { dx: 1, dy: 0, dir: 0 },
    { dx: -1, dy: 0, dir: 1 },
    { dx: 0, dy: 1, dir: 2 },
    { dx: 0, dy: -1, dir: 3 },
  ]

  while (open.length > 0) {
    let bestOpenIndex = 0
    for (let index = 1; index < open.length; index += 1) {
      if (distance[open[index]] < distance[open[bestOpenIndex]]) {
        bestOpenIndex = index
      }
    }
    const state = open.splice(bestOpenIndex, 1)[0]
    const directionIndex = state % 5
    const cell = Math.floor(state / 5)
    const iy = Math.floor(cell / width)
    const ix = cell % width
    if (ix === endX && iy === endY) {
      const points: GraphPoint[] = []
      let current = state
      while (current >= 0) {
        const currentCell = Math.floor(current / 5)
        points.push({
          x: xCoords[currentCell % width],
          y: yCoords[Math.floor(currentCell / width)],
        })
        current = previous[current]
      }
      points.reverse()
      points[0] = endpoints.start
      points[points.length - 1] = endpoints.end
      return simplify(points)
    }

    for (const neighbor of neighbors) {
      const nx = ix + neighbor.dx
      const ny = iy + neighbor.dy
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
      if (blocked[ny][nx]) continue
      const nxValue = xCoords[nx]
      const nyValue = yCoords[ny]
      const currentX = xCoords[ix]
      const currentY = yCoords[iy]
      const isHorizontal = neighbor.dy === 0
      const key = isHorizontal
        ? segmentKey('h', currentY, currentX, nxValue)
        : segmentKey('v', currentX, currentY, nyValue)
      const used = usedSegments.get(edge.category)
      // 同色边不允许复用同一段网格线；不同色交叉只付出很小的代价。
      if (used && hasUsedOverlap(used, key)) continue
      const otherColor = [...usedSegments.entries()].some(
        ([category, segments]) =>
          category !== edge.category && hasUsedOverlap(segments, key),
      )
        ? OTHER_COLOR_COST
        : 0
      const turn =
        directionIndex !== 4 && directionIndex !== neighbor.dir
          ? TURN_COST
          : 0
      const step = Math.hypot(nxValue - currentX, nyValue - currentY)
      const nextState = (ny * width + nx) * 5 + neighbor.dir
      const nextDistance =
        distance[state] + step + turn + otherColor
      if (nextDistance + 0.0001 < distance[nextState]) {
        distance[nextState] = nextDistance
        previous[nextState] = state
        open.push(nextState)
      }
    }
  }

  return [
    endpoints.start,
    { x: endpoints.end.x, y: endpoints.start.y },
    endpoints.end,
  ]
}

function orthogonalize(points: GraphPoint[]): GraphPoint[] {
  if (points.length <= 1) return points
  const result: GraphPoint[] = [points[0]]
  for (let index = 1; index < points.length; index += 1) {
    const previous = result[result.length - 1]
    const current = points[index]
    const dx = Math.abs(current.x - previous.x)
    const dy = Math.abs(current.y - previous.y)
    if (dx > 0.01 && dy > 0.01) {
      result.push({ x: current.x, y: previous.y })
    }
    result.push(current)
  }
  return result
}

function simplify(points: GraphPoint[]): GraphPoint[] {
  const clean: GraphPoint[] = []
  for (const point of points) {
    const previous = clean[clean.length - 1]
    if (
      !previous ||
      Math.abs(previous.x - point.x) > MIN_SEGMENT ||
      Math.abs(previous.y - point.y) > MIN_SEGMENT
    ) {
      clean.push(point)
    }
  }
  const result: GraphPoint[] = []
  for (let index = 0; index < clean.length; index += 1) {
    const previous = result[result.length - 1]
    const current = clean[index]
    const next = clean[index + 1]
    if (!previous || !next) {
      result.push(current)
      continue
    }
    const sameX =
      Math.abs(previous.x - current.x) < 0.01 &&
      Math.abs(current.x - next.x) < 0.01
    const sameY =
      Math.abs(previous.y - current.y) < 0.01 &&
      Math.abs(current.y - next.y) < 0.01
    if (sameX || sameY) continue
    result.push(current)
  }
  return result
}

function registerPath(
  points: GraphPoint[],
  category: string,
  usedSegments: Map<string, Set<string>>,
): void {
  const segments = usedSegments.get(category) ?? new Set<string>()
  for (let index = 0; index < points.length - 1; index += 1) {
    const a = points[index]
    const b = points[index + 1]
    if (Math.abs(a.y - b.y) < MIN_SEGMENT) {
      segments.add(segmentKey('h', a.y, a.x, b.x))
    } else {
      segments.add(segmentKey('v', a.x, a.y, b.y))
    }
  }
  usedSegments.set(category, segments)
}

function segmentsOverlap(
  a: GraphPoint,
  b: GraphPoint,
  c: GraphPoint,
  d: GraphPoint,
): boolean {
  const aHorizontal = Math.abs(a.y - b.y) < MIN_SEGMENT
  const cHorizontal = Math.abs(c.y - d.y) < MIN_SEGMENT
  if (aHorizontal !== cHorizontal) return false
  if (aHorizontal) {
    if (Math.abs(a.y - c.y) > 0.5) return false
    const overlap =
      Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) -
      Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x))
    return overlap > 1
  }
  if (Math.abs(a.x - c.x) > 0.5) return false
  const overlap =
    Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) -
    Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y))
  return overlap > 1
}

function segmentCrossing(
  a: GraphPoint,
  b: GraphPoint,
  c: GraphPoint,
  d: GraphPoint,
): GraphPoint | null {
  const aHorizontal = Math.abs(a.y - b.y) < MIN_SEGMENT
  const cHorizontal = Math.abs(c.y - d.y) < MIN_SEGMENT
  if (aHorizontal === cHorizontal) return null
  const horizontal = aHorizontal ? [a, b] : [c, d]
  const vertical = aHorizontal ? [c, d] : [a, b]
  const h = horizontal
  const v = vertical
  const x = v[0].x
  const y = h[0].y
  if (
    x >= Math.min(h[0].x, h[1].x) - 0.5 &&
    x <= Math.max(h[0].x, h[1].x) + 0.5 &&
    y >= Math.min(v[0].y, v[1].y) - 0.5 &&
    y <= Math.max(v[0].y, v[1].y) + 0.5
  ) {
    return { x, y }
  }
  return null
}

export function routeGraph2D(
  edges: RenderEdge[],
  layout: GraphLayout2D,
): GraphRoutingResult {
  const slots = layout.slots
  const xBase: number[] = [0, layout.width]
  const yBase: number[] = [0, layout.height]
  for (const slot of Object.values(slots)) {
    xBase.push(
      slot.symbolLeft - NODE_CLEARANCE,
      slot.x,
      slot.symbolRight + NODE_CLEARANCE,
      slot.labelLeft - NODE_CLEARANCE,
      slot.labelRight + NODE_CLEARANCE,
    )
    yBase.push(
      slot.symbolTop - NODE_CLEARANCE,
      slot.y,
      slot.symbolBottom + NODE_CLEARANCE,
      slot.labelTop - NODE_CLEARANCE,
      slot.labelBottom + NODE_CLEARANCE,
    )
  }
  const endpoints = buildPorts(edges, slots)
  const routeEndpoints = new Map<string, EndpointPair>()
  for (const [edgeId, pair] of endpoints.entries()) {
    const outStart = outwardPoint(slots[pair.startSide], pair.startSide, pair.start)
    const outEnd = outwardPoint(slots[pair.endSide], pair.endSide, pair.end)
    routeEndpoints.set(edgeId, {
      start: outStart,
      end: outEnd,
      startSide: pair.startSide,
      endSide: pair.endSide,
    })
    xBase.push(pair.start.x, pair.end.x, outStart.x, outEnd.x)
    yBase.push(pair.start.y, pair.end.y, outStart.y, outEnd.y)
  }
  const xCoords = addMidpoints(xBase)
  const yCoords = addMidpoints(yBase)
  const blocked = yCoords.map((y) =>
    xCoords.map((x) =>
      Object.values(slots).some((slot) => pointInsideSlot(x, y, slot)),
    ),
  )

  const usedSegments = new Map<string, Set<string>>()
  const paths: Record<string, GraphPoint[]> = {}
  for (const edge of edges) {
    const from = slots[edge.from]
    const to = slots[edge.to]
    if (!from || !to) continue
    const endpointPair = endpoints.get(edge.id)
    const routingPair = routeEndpoints.get(edge.id)
    if (!endpointPair || !routingPair) continue
    const path = routeOne(
      edge,
      from,
      to,
      routingPair,
      xCoords,
      yCoords,
      blocked,
      usedSegments,
    )
    if (path.length < 2) continue
    const fullPath = orthogonalize([
      endpointPair.start,
      ...path,
      endpointPair.end,
    ])
    paths[edge.id] = fullPath
    registerPath(fullPath, edge.category, usedSegments)
  }

  const colorVariant: Record<string, number> = {}
  const sameColorConflicts: string[] = []
  const edgesByCategory = new Map<string, RenderEdge[]>()
  for (const edge of edges) {
    if (!paths[edge.id]) continue
    const list = edgesByCategory.get(edge.category) ?? []
    list.push(edge)
    edgesByCategory.set(edge.category, list)
  }
  for (const list of edgesByCategory.values()) {
    const usedVariantEdges: string[] = []
    for (const edge of list) {
      const path = paths[edge.id]
      const conflict = list.some((other) => {
        if (other.id === edge.id || !paths[other.id]) return false
        const a = path
        const b = paths[other.id]
        for (let i = 0; i < a.length - 1; i += 1) {
          for (let j = 0; j < b.length - 1; j += 1) {
            if (segmentsOverlap(a[i], a[i + 1], b[j], b[j + 1])) {
              return true
            }
          }
        }
        return false
      })
      if (!conflict) continue
      sameColorConflicts.push(edge.id)
      const variant = Math.min(3, usedVariantEdges.length + 1)
      colorVariant[edge.id] = variant
      usedVariantEdges.push(edge.id)
    }
  }

  const crossings: GraphPoint[] = []
  for (let aIndex = 0; aIndex < edges.length; aIndex += 1) {
    const a = edges[aIndex]
    const aPath = paths[a.id]
    if (!aPath) continue
    for (let bIndex = aIndex + 1; bIndex < edges.length; bIndex += 1) {
      const b = edges[bIndex]
      if (a.category === b.category) continue
      const bPath = paths[b.id]
      if (!bPath) continue
      for (let i = 0; i < aPath.length - 1; i += 1) {
        for (let j = 0; j < bPath.length - 1; j += 1) {
          const point = segmentCrossing(
            aPath[i],
            aPath[i + 1],
            bPath[j],
            bPath[j + 1],
          )
          if (!point) continue
          if (
            Object.values(slots).some(
              (slot) =>
                Math.abs(point.x - slot.x) <= slot.width / 2 &&
                Math.abs(point.y - slot.y) <= slot.height / 2,
            )
          ) {
            continue
          }
          if (
            !crossings.some(
              (item) =>
                Math.abs(item.x - point.x) < 2 &&
                Math.abs(item.y - point.y) < 2,
            )
          ) {
            crossings.push(point)
          }
        }
      }
    }
  }

  return { paths, colorVariant, crossings, sameColorConflicts }
}
