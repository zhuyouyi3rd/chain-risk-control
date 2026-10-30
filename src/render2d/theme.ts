import type { EnterpriseType, RelationCategory, RiskLevel } from '../core/types'

export const NODE_FILL = '#82C9E0'
export const NODE_BORDER = '#5AA8C0'
export const NODE_LABEL_COLOR = '#E0E0E0'
export const NODE_LABEL_DISTANCE = 20
export const CONTROL_RING_COLOR = '#8E7CC3'
export const SOURCE_COLOR = '#B71C1C'
export const SAFE_EDGE_COLOR = '#7F9DB9'

const HEXAGON_PATH =
  'path://M50 3 L93 26 L93 74 L50 97 L7 74 L7 26 Z'
const OCTAGON_PATH =
  'path://M30 3 H70 L97 30 V70 L70 97 H30 L3 70 V30 Z'

export const NODE_SYMBOLS: Record<EnterpriseType, string> = {
  raw_material: HEXAGON_PATH,
  warehouse: 'rect',
  workshop: 'triangle',
  trading: 'diamond',
  service: 'roundRect',
  finance: OCTAGON_PATH,
}

export const NODE_SIZES: Record<
  EnterpriseType,
  number | [number, number]
> = {
  raw_material: 42,
  warehouse: 44,
  workshop: 44,
  trading: 44,
  service: [54, 38],
  finance: 48,
}

export const EDGE_COLORS: Record<RelationCategory, string> = {
  material: '#4A90D9',
  capital: '#9B59B6',
  tech: '#1ABC9C',
  guarantee: '#2E7D32',
}

export const EDGE_WIDTHS: Record<RelationCategory, number> = {
  material: 1.5,
  capital: 1.5,
  tech: 1.5,
  guarantee: 2.5,
}

export const EDGE_DASHES: Record<
  RelationCategory,
  'solid' | number[]
> = {
  material: 'solid',
  capital: [6, 4],
  tech: [8, 3, 2, 3],
  guarantee: 'solid',
}

export const RISK_EDGE_COLORS: Record<RiskLevel, string> = {
  none: '#4A90D9',
  low: '#FFB74D',
  medium: '#FF8C42',
  high: '#E53935',
  source: SOURCE_COLOR,
}

export interface NodeRiskStyle {
  borderColor: string
  borderWidth: number
  shadowBlur: number
  shadowColor: string
}

export const NODE_RISK_STYLES: Record<RiskLevel, NodeRiskStyle> = {
  none: {
    borderColor: NODE_BORDER,
    borderWidth: 1.5,
    shadowBlur: 0,
    shadowColor: 'transparent',
  },
  low: {
    borderColor: '#FFB74D',
    borderWidth: 2,
    shadowBlur: 0,
    shadowColor: 'transparent',
  },
  medium: {
    borderColor: '#FF8C42',
    borderWidth: 3,
    shadowBlur: 10,
    shadowColor: 'rgba(255, 140, 66, 0.55)',
  },
  high: {
    borderColor: '#E53935',
    borderWidth: 4,
    shadowBlur: 16,
    shadowColor: 'rgba(229, 57, 53, 0.62)',
  },
  source: {
    borderColor: SOURCE_COLOR,
    borderWidth: 3,
    shadowBlur: 14,
    shadowColor: 'rgba(183, 28, 28, 0.62)',
  },
}

export function baseNodeDimension(type: EnterpriseType): number {
  const size = NODE_SIZES[type]
  return Array.isArray(size) ? Math.max(size[0], size[1]) : size
}
