import type { Enterprise, Relation, RiskSource, WorkspaceData } from './types'
import {
  buildControllerGroups,
  cloneWorkspaceData,
  countWorkspaceData,
} from './workspace'

export const TEST_DATASET_NAME = '内置测试数据集'

const enterprises: Enterprise[] = [
  { id: 'E1', name: '鑫源原料厂', type: 'raw_material' },
  { id: 'E2', name: '宏达原料厂', type: 'raw_material' },
  { id: 'E3', name: '中储仓栈', type: 'warehouse' },
  { id: 'E4', name: '精工制造坊', type: 'workshop' },
  {
    id: 'E5',
    name: '云创驿馆',
    type: 'service',
    controllerGroup: 'C1',
    controllerName: '张某',
  },
  {
    id: 'E6',
    name: '恒信制造坊',
    type: 'workshop',
    controllerGroup: 'C1',
    controllerName: '张某',
  },
  { id: 'E7', name: '华贸商行', type: 'trading' },
  {
    id: 'E8',
    name: '融通金融',
    type: 'finance',
    controllerGroup: 'C1',
    controllerName: '张某',
  },
  { id: 'E9', name: '迅捷驿馆', type: 'service' },
]

const relations: Relation[] = [
  {
    id: 'R01',
    from: 'E1',
    to: 'E4',
    category: 'material',
    association: 0.6,
    mutual: false,
  },
  {
    id: 'R02',
    from: 'E2',
    to: 'E4',
    category: 'material',
    association: 0.55,
    mutual: false,
  },
  {
    id: 'R03',
    from: 'E4',
    to: 'E3',
    category: 'material',
    association: 0.65,
    mutual: false,
  },
  {
    id: 'R04',
    from: 'E3',
    to: 'E7',
    category: 'material',
    association: 0.6,
    mutual: false,
  },
  {
    id: 'R05',
    from: 'E4',
    to: 'E1',
    category: 'capital',
    association: 0.55,
    mutual: false,
  },
  {
    id: 'R06',
    from: 'E7',
    to: 'E4',
    category: 'capital',
    association: 0.5,
    mutual: false,
  },
  {
    id: 'R07',
    from: 'E5',
    to: 'E7',
    category: 'tech',
    association: 0.5,
    mutual: false,
  },
  {
    id: 'R08',
    from: 'E5',
    to: 'E6',
    category: 'guarantee',
    association: 0.75,
    mutual: true,
  },
  {
    id: 'R09',
    from: 'E1',
    to: 'E2',
    category: 'guarantee',
    association: 0.7,
    mutual: false,
  },
  {
    id: 'R10',
    from: 'E7',
    to: 'E8',
    category: 'capital',
    association: 0.45,
    mutual: false,
  },
  {
    id: 'R11',
    from: 'E9',
    to: 'E3',
    category: 'tech',
    association: 0.4,
    mutual: false,
  },
]

const riskSources: RiskSource[] = [
  {
    id: 'RS1',
    name: '鑫源断供',
    type: 'material',
    targetEnterpriseIds: ['E1'],
    score: 1,
    enabled: true,
  },
  {
    id: 'RS2',
    name: '恒信资金逾期',
    type: 'capital',
    targetEnterpriseIds: ['E6'],
    score: 1,
    enabled: true,
  },
  {
    id: 'RS3',
    name: '控制人张某风险',
    type: 'control',
    targetEnterpriseIds: ['E5', 'E6'],
    score: 0.6,
    enabled: false,
  },
]

export const TEST_DATASET_COUNTS = countWorkspaceData({
  enterprises,
  relations,
  riskSources,
  groups: buildControllerGroups(enterprises),
})

export function createTestWorkspaceData(): WorkspaceData {
  return cloneWorkspaceData({
    enterprises,
    relations,
    riskSources,
    groups: buildControllerGroups(enterprises),
  })
}
