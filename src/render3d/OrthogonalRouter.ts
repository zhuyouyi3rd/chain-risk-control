import {
  ROUTER_CELL_SIZE,
  ROUTER_IGNORE_RADIUS,
  ROUTER_LANE_STEP,
  SCENE_SCALE,
} from './constants'

export interface Point2 {
  x: number
  z: number
}

interface ConflictStats {
  occupied: number
  blocked: number
}

const EPSILON = 1e-4
const DEFAULT_CELL_SIZE = ROUTER_CELL_SIZE
const BLOCK_PADDING = 0.15 * SCENE_SCALE
const LANE_OFFSETS = [
  ROUTER_LANE_STEP,
  -ROUTER_LANE_STEP,
  ROUTER_LANE_STEP * (5 / 3),
  -ROUTER_LANE_STEP * (5 / 3),
]

/**
 * 轻度网格占用器：
 * - occupied 记录已铺的贴地线，供后续路由避让；
 * - blocked 记录建筑底面，避免正交路径穿过其他建筑。
 */
export class OccupancyGrid {
  readonly cellSize: number
  private readonly occupied = new Set<string>()
  private readonly blocked = new Set<string>()

  constructor(cellSize = DEFAULT_CELL_SIZE) {
    this.cellSize = cellSize
  }

  blockBox(
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number,
    padding = BLOCK_PADDING,
  ): void {
    const startX = Math.round((minX - padding) / this.cellSize)
    const endX = Math.round((maxX + padding) / this.cellSize)
    const startZ = Math.round((minZ - padding) / this.cellSize)
    const endZ = Math.round((maxZ + padding) / this.cellSize)
    for (let ix = startX; ix <= endX; ix += 1) {
      for (let iz = startZ; iz <= endZ; iz += 1) {
        this.blocked.add(this.key(ix, iz))
      }
    }
  }

  markRoute(points: Point2[]): void {
    this.forEachCell(points, (ix, iz) => {
      this.occupied.add(this.key(ix, iz))
    })
  }

  countConflicts(
    points: Point2[],
    ignorePoints: Point2[],
    ignoreRadius = ROUTER_IGNORE_RADIUS,
  ): ConflictStats {
    const occupied = new Set<string>()
    const blocked = new Set<string>()

    this.forEachCellWithPoint(points, (ix, iz, x, z) => {
      const nearEndpoint = ignorePoints.some(
        (point) => Math.hypot(point.x - x, point.z - z) < ignoreRadius,
      )
      if (nearEndpoint) return
      const key = this.key(ix, iz)
      if (this.blocked.has(key)) blocked.add(key)
      if (this.occupied.has(key)) occupied.add(key)
    })

    return {
      occupied: occupied.size,
      blocked: blocked.size,
    }
  }

  private key(ix: number, iz: number): string {
    return `${ix}:${iz}`
  }

  private forEachCell(
    points: Point2[],
    callback: (ix: number, iz: number) => void,
  ): void {
    this.forEachCellWithPoint(points, (ix, iz) => callback(ix, iz))
  }

  private forEachCellWithPoint(
    points: Point2[],
    callback: (ix: number, iz: number, x: number, z: number) => void,
  ): void {
    for (let index = 0; index < points.length - 1; index += 1) {
      const from = points[index]
      const to = points[index + 1]
      const length = Math.hypot(to.x - from.x, to.z - from.z)
      const steps = Math.max(
        1,
        Math.ceil(length / (this.cellSize / 2)),
      )
      for (let step = 0; step <= steps; step += 1) {
        const t = step / steps
        const x = from.x + (to.x - from.x) * t
        const z = from.z + (to.z - from.z) * t
        callback(
          Math.round(x / this.cellSize),
          Math.round(z / this.cellSize),
          x,
          z,
        )
      }
    }
  }
}

export class OrthogonalRouter {
  private readonly grid: OccupancyGrid

  constructor(grid: OccupancyGrid) {
    this.grid = grid
  }

  route(start: Point2, end: Point2): Point2[] {
    const candidates = this.candidates(start, end)
    let best = candidates[0]
    let bestCost = Number.POSITIVE_INFINITY

    candidates.forEach((candidate, candidateIndex) => {
      const stats = this.grid.countConflicts(candidate, [start, end])
      const cost =
        stats.blocked * 2000 +
        stats.occupied * 18 +
        polylineLength(candidate) * 0.02 +
        Math.max(0, candidate.length - 2) * 0.3 +
        candidateIndex * 0.0001
      if (cost < bestCost) {
        best = candidate
        bestCost = cost
      }
    })

    this.grid.markRoute(best)
    return best.map((point) => ({ ...point }))
  }

  private candidates(start: Point2, end: Point2): Point2[][] {
    const sameX = Math.abs(start.x - end.x) < EPSILON
    const sameZ = Math.abs(start.z - end.z) < EPSILON
    const result: Point2[][] = []

    if (sameX && sameZ) return [[{ ...start }]]

    if (sameX) {
      result.push([{ ...start }, { ...end }])
      for (const offset of LANE_OFFSETS) {
        result.push([
          { ...start },
          { x: start.x + offset, z: start.z },
          { x: start.x + offset, z: end.z },
          { ...end },
        ])
      }
    } else if (sameZ) {
      result.push([{ ...start }, { ...end }])
      for (const offset of LANE_OFFSETS) {
        result.push([
          { ...start },
          { x: start.x, z: start.z + offset },
          { x: end.x, z: start.z + offset },
          { ...end },
        ])
      }
    } else {
      const middleX = (start.x + end.x) / 2
      for (const offset of [0, -ROUTER_LANE_STEP, ROUTER_LANE_STEP]) {
        result.push([
          { ...start },
          { x: middleX + offset, z: start.z },
          { x: middleX + offset, z: end.z },
          { ...end },
        ])
      }

      const middleZ = (start.z + end.z) / 2
      for (const offset of [0, -ROUTER_LANE_STEP, ROUTER_LANE_STEP]) {
        result.push([
          { ...start },
          { x: start.x, z: middleZ + offset },
          { x: end.x, z: middleZ + offset },
          { ...end },
        ])
      }
    }

    return dedupeCandidates(result).map(simplifyPolyline)
  }
}

function dedupeCandidates(candidates: Point2[][]): Point2[][] {
  const seen = new Set<string>()
  const result: Point2[][] = []
  candidates.forEach((candidate) => {
    const normalized = simplifyPolyline(candidate)
    const key = normalized
      .map((point) => `${point.x.toFixed(3)},${point.z.toFixed(3)}`)
      .join('|')
    if (seen.has(key)) return
    seen.add(key)
    result.push(normalized)
  })
  return result
}

function simplifyPolyline(points: Point2[]): Point2[] {
  const deduped: Point2[] = []
  points.forEach((point) => {
    const last = deduped[deduped.length - 1]
    if (
      !last ||
      Math.abs(last.x - point.x) > EPSILON ||
      Math.abs(last.z - point.z) > EPSILON
    ) {
      deduped.push({ ...point })
    }
  })

  if (deduped.length <= 2) return deduped

  const result: Point2[] = [deduped[0]]
  for (let index = 1; index < deduped.length - 1; index += 1) {
    const previous = result[result.length - 1]
    const current = deduped[index]
    const next = deduped[index + 1]
    const sameX =
      Math.abs(previous.x - current.x) < EPSILON &&
      Math.abs(current.x - next.x) < EPSILON
    const sameZ =
      Math.abs(previous.z - current.z) < EPSILON &&
      Math.abs(current.z - next.z) < EPSILON
    if (!sameX && !sameZ) result.push(current)
  }
  result.push(deduped[deduped.length - 1])
  return result
}

function polylineLength(points: Point2[]): number {
  let length = 0
  for (let index = 0; index < points.length - 1; index += 1) {
    length += Math.hypot(
      points[index + 1].x - points[index].x,
      points[index + 1].z - points[index].z,
    )
  }
  return length
}
