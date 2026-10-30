import type { Enterprise, EnterpriseType } from '../core/types'
import { LAYER_GAP_X, NODE_GAP_Z } from './constants'

export const LAYER_ORDER: Record<EnterpriseType, number> = {
  raw_material: 0,
  warehouse: 1,
  workshop: 2,
  trading: 3,
  finance: 4,
  service: 5,
}

export const LAYER_LABELS: Record<EnterpriseType, string> = {
  raw_material: '原料',
  warehouse: '仓储',
  workshop: '生产',
  trading: '商贸',
  finance: '金融',
  service: '服务',
}

export const LAYER_X_GAP = LAYER_GAP_X
export const LAYER_Z_GAP = NODE_GAP_Z

export interface EnterprisePlacement {
  enterpriseId: string
  enterpriseName: string
  enterpriseType: EnterpriseType
  layerIndex: number
  indexInLayer: number
  x: number
  z: number
}

export interface LayoutBounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  centerX: number
  centerZ: number
  width: number
  depth: number
}

export function computeLayeredLayout(
  enterprises: Enterprise[],
): Map<string, EnterprisePlacement> {
  const placements = new Map<string, EnterprisePlacement>()
  const byType = new Map<EnterpriseType, Enterprise[]>()

  for (const enterprise of enterprises) {
    const layer = byType.get(enterprise.type) ?? []
    layer.push(enterprise)
    byType.set(enterprise.type, layer)
  }

  for (const type of Object.keys(LAYER_ORDER) as EnterpriseType[]) {
    const layerEnterprises = (byType.get(type) ?? []).sort((left, right) =>
      left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
    )
    const count = layerEnterprises.length
    layerEnterprises.forEach((enterprise, indexInLayer) => {
      placements.set(enterprise.id, {
        enterpriseId: enterprise.id,
        enterpriseName: enterprise.name,
        enterpriseType: type,
        layerIndex: LAYER_ORDER[type],
        indexInLayer,
        x: LAYER_ORDER[type] * LAYER_X_GAP,
        z: (indexInLayer - (count - 1) / 2) * LAYER_Z_GAP,
      })
    })
  }

  return placements
}

export function computeLayoutBounds(
  placements: Map<string, EnterprisePlacement>,
): LayoutBounds {
  if (placements.size === 0) {
    return {
      minX: 0,
      maxX: 0,
      minZ: 0,
      maxZ: 0,
      centerX: 0,
      centerZ: 0,
      width: 0,
      depth: 0,
    }
  }

  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minZ = Number.POSITIVE_INFINITY
  let maxZ = Number.NEGATIVE_INFINITY

  placements.forEach((placement) => {
    minX = Math.min(minX, placement.x)
    maxX = Math.max(maxX, placement.x)
    minZ = Math.min(minZ, placement.z)
    maxZ = Math.max(maxZ, placement.z)
  })

  return {
    minX,
    maxX,
    minZ,
    maxZ,
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
    width: maxX - minX,
    depth: maxZ - minZ,
  }
}
