import type {
  EnterpriseType,
  RelationCategory,
  RiskLevel,
  RiskSourceType,
} from './types'

export const ENTERPRISE_TYPE_LABELS: Record<EnterpriseType, string> = {
  raw_material: '原料坊',
  warehouse: '仓栈',
  workshop: '工坊',
  trading: '商行',
  service: '驿馆',
  finance: '金融机构',
}

export const RELATION_CATEGORY_LABELS: Record<RelationCategory, string> = {
  material: '物料流',
  capital: '资金账期',
  tech: '技术服务',
  guarantee: '担保',
}

export const RISK_SOURCE_TYPE_LABELS: Record<RiskSourceType, string> = {
  material: '物料断供',
  capital: '资金逾期',
  tech: '技术中断',
  guarantee: '担保风险',
  control: '控制人风险',
}

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  none: '无',
  low: '低',
  medium: '中',
  high: '高',
  source: '风险源',
}
