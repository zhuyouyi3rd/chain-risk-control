import assert from 'node:assert/strict'
import { mkdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import * as XLSX from 'xlsx'
import { parseWorkspaceWorkbook } from '../src/core/import'
import { buildPropagation } from '../src/core/graph'

const OUT_DIR = path.join(process.cwd(), 'docs')
const FILE_NAME = '新能源汽车产业链_企业关系示例.xlsx'
const FILE_PATH = path.join(OUT_DIR, FILE_NAME)

const enterprises = [
  {
    id: 'A01',
    name: '青海盐湖锂业',
    type: 'raw_material',
    region: '青海·格尔木',
    metrics: '碳酸锂/氢氧化锂 3 万吨/年；核心客户 A02',
    controllerId: '',
    controllerName: '',
    stage: '上游锂资源',
    function: '盐湖提锂，向正极材料企业供应碳酸锂、氢氧化锂。',
    chain: '下游：A02 西宁正极材料',
  },
  {
    id: 'A02',
    name: '西宁正极材料',
    type: 'workshop',
    region: '青海·西宁',
    metrics: '三元正极材料 2 万吨/年；配套 A05 电芯',
    controllerId: 'C02',
    controllerName: '李某',
    stage: '正极材料',
    function: '将锂盐加工为三元正极材料，直供电芯制造。',
    chain: '上游：A01；下游：A05；与 A04 同属 C02',
  },
  {
    id: 'A03',
    name: '宁夏负极材料',
    type: 'workshop',
    region: '宁夏·银川',
    metrics: '人造石墨负极 2 万吨/年；配套 A05 电芯',
    controllerId: '',
    controllerName: '',
    stage: '负极材料',
    function: '人造石墨负极生产与改性，向电芯企业供货。',
    chain: '下游：A05',
  },
  {
    id: 'A04',
    name: '苏州隔膜科技',
    type: 'workshop',
    region: '江苏·苏州',
    metrics: '湿法隔膜 4 亿㎡/年；配套 A05 电芯',
    controllerId: 'C02',
    controllerName: '李某',
    stage: '隔膜材料',
    function: '湿法隔膜及涂覆加工，向电芯企业供货。',
    chain: '下游：A05；与 A02 同属 C02',
  },
  {
    id: 'A05',
    name: '合肥电芯制造',
    type: 'workshop',
    region: '安徽·合肥',
    metrics: '动力电芯 2GWh/年；PACK 客户 A06',
    controllerId: 'C01',
    controllerName: '王某',
    stage: '电芯制造',
    function: '正极、负极、隔膜集成，生产动力电芯。',
    chain: '上游：A02/A03/A04/A12；下游：A06；C01 核心企业',
  },
  {
    id: 'A06',
    name: '常州电池包集成',
    type: 'workshop',
    region: '江苏·常州',
    metrics: '电池包 30 万套/年；整车客户 A07',
    controllerId: 'C01',
    controllerName: '王某',
    stage: '电池包 PACK',
    function: '电芯成组、热管理与 BMS 集成，交付整车和储能客户。',
    chain: '上游：A05；下游：A07/A08；与 A07 互保',
  },
  {
    id: 'A07',
    name: '杭州新能源汽车',
    type: 'workshop',
    region: '浙江·杭州',
    metrics: '新能源整车 10 万辆/年；经销网络 A10',
    controllerId: 'C01',
    controllerName: '王某',
    stage: '整车制造',
    function: '新能源整车研发、制造与销售，带动电池包和经销网络。',
    chain: '上游：A06；下游：A10/A09；与 A06 互保',
  },
  {
    id: 'A08',
    name: '南京储能系统',
    type: 'service',
    region: '江苏·南京',
    metrics: '储能系统集成 1GWh/年；PACK 采购 A06',
    controllerId: '',
    controllerName: '',
    stage: '储能集成',
    function: '储能系统设计、集成与 EPC 交付，采购电池包。',
    chain: '上游：A06',
  },
  {
    id: 'A09',
    name: '广东电池回收',
    type: 'service',
    region: '广东·佛山',
    metrics: '退役电池回收 1.5 万吨/年；检测合作 A12',
    controllerId: '',
    controllerName: '',
    stage: '回收利用',
    function: '退役动力电池回收、拆解和梯次利用。',
    chain: '上游：A07；下游：A12（检测）',
  },
  {
    id: 'A10',
    name: '上海汽车经销',
    type: 'trading',
    region: '上海',
    metrics: '整车销售与售后；覆盖华东市场',
    controllerId: '',
    controllerName: '',
    stage: '终端经销',
    function: '整车批发、零售、交付与售后服务。',
    chain: '上游：A07；与 A07 存在回款关系，A11 提供库存融资',
  },
  {
    id: 'A11',
    name: '天津融资租赁',
    type: 'finance',
    region: '天津',
    metrics: '设备及汽车融资租赁；服务 A07/A10',
    controllerId: '',
    controllerName: '',
    stage: '产业金融',
    function: '为整车厂设备采购和经销商库存提供融资租赁。',
    chain: '下游：A07/A10（资金支持）',
  },
  {
    id: 'A12',
    name: '华测电池研究院',
    type: 'service',
    region: '江苏·常州',
    metrics: '电池检测、认证与联合研发；服务 A05/A07',
    controllerId: '',
    controllerName: '',
    stage: '检测研发',
    function: '电芯、电池包和整车电池系统检测认证及联合研发。',
    chain: '上游：A09（回收电池检测）；下游：A05/A07（技术服务）',
  },
]

const relations = [
  ['R01', 'A01', 'A02', 'material', 0.85, '碳酸锂长协', false],
  ['R02', 'A02', 'A05', 'material', 0.82, '正极材料直供', false],
  ['R03', 'A03', 'A05', 'material', 0.78, '负极材料直供', false],
  ['R04', 'A04', 'A05', 'material', 0.72, '隔膜涂覆供应', false],
  ['R05', 'A05', 'A06', 'material', 0.86, '动力电芯供应', false],
  ['R06', 'A06', 'A07', 'material', 0.84, 'PACK 配套', false],
  ['R07', 'A07', 'A10', 'material', 0.8, '整车批发', false],
  ['R08', 'A06', 'A08', 'material', 0.68, '储能电池包', false],
  ['R09', 'A07', 'A09', 'material', 0.5, '退役整车回收', false],
  ['R10', 'A10', 'A07', 'capital', 0.6, '经销商回款', false],
  ['R11', 'A11', 'A07', 'capital', 0.7, '设备融资租赁', false],
  ['R12', 'A11', 'A10', 'capital', 0.65, '库存融资', false],
  ['R13', 'A07', 'A06', 'guarantee', 0.72, '互保/回款保障', true],
  ['R14', 'A12', 'A05', 'tech', 0.75, '电芯检测研发', false],
  ['R15', 'A12', 'A07', 'tech', 0.7, '整车电池认证', false],
  ['R16', 'A09', 'A12', 'tech', 0.45, '回收电池检测', false],
] as const

const riskSources = [
  ['RS01', '锂矿出口管制', 'material', 'A01', 1, true],
  ['RS02', '整车厂资金链紧张', 'capital', 'A07', 1, true],
  ['RS03', '电芯技术路线变更', 'tech', 'A05', 0.8, false],
] as const

function sheetFromRows(
  rows: Array<Array<string | number | boolean>>,
  widths: number[],
  filterRef?: string,
) {
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  sheet['!cols'] = widths.map((width) => ({ wch: width }))
  sheet['!rows'] = rows.map((_, index) => ({ hpt: index === 0 ? 24 : 21 }))
  if (filterRef) sheet['!autofilter'] = { ref: filterRef }
  return sheet
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  const workbook = XLSX.utils.book_new()
  workbook.Props = {
    Title: '新能源汽车产业链 · 企业关系示例数据',
    Subject: '产业链风控系统 Excel 导入示例',
    Author: '产业链风控系统',
    CreatedDate: new Date(),
    Comments: '包含 12 家企业、16 条关系、3 个风险源，可直接上传导入。',
  }

  const guideRows: Array<Array<string | number>> = [
    ['新能源汽车产业链 · 风控示例数据', ''],
    ['文件用途', '用于产业链风控系统 Excel 导入，展示一条完整的新能源汽车/动力电池产业链。'],
    ['数据规模', '12 家企业 · 16 条关系 · 3 个风险源 · 2 个同控组'],
    ['导入方式', '打开网站右侧「数据输入」→ 选择本文件 → 检查预览校验 → 确认导入。'],
    ['读取范围', '系统只读取「企业表」「关系表」「风险源表」；「产业链说明」「关系速览」仅供阅读。'],
    ['默认风险源', 'RS01 锂矿出口管制、RS02 整车厂资金链紧张默认启用；RS03 默认停用，可在右侧开关。'],
    ['控制组说明', 'C01：A05/A06/A07，实际控制人王某；C02：A02/A04，实际控制人李某。同控关系以节点外环展示，不写入关系边。'],
    ['企业 type', 'raw_material / warehouse / workshop / trading / service / finance'],
    ['关系 category', 'material / capital / tech / guarantee；mutual 用 true/false、是/否、1/0。'],
    ['association', '填写 0 到 1 的小数，代表关系传导强度。'],
    ['chain sheet', '「产业链说明」列出每家企业功能与上下游，「关系速览」用中文解释每条关系。'],
    ['注意', '请勿修改企业表/关系表/风险源表的工作表名与表头；企业 ID、关系 ID 必须唯一。'],
  ]
  const guide = XLSX.utils.aoa_to_sheet(guideRows)
  guide['!cols'] = [{ wch: 20 }, { wch: 100 }]
  guide['!rows'] = guideRows.map((_, index) => ({ hpt: index === 0 ? 28 : 22 }))
  guide['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }]
  XLSX.utils.book_append_sheet(workbook, guide, '填写说明')

  const chainRows: Array<Array<string | number>> = [
    ['环节', '企业ID', '企业名称', '企业类型', '核心功能', '上下游 / 控制关系'],
    ...enterprises.map((enterprise) => [
      enterprise.stage,
      enterprise.id,
      enterprise.name,
      enterprise.type,
      enterprise.function,
      enterprise.chain,
    ]),
  ]
  XLSX.utils.book_append_sheet(
    workbook,
    sheetFromRows(chainRows, [16, 10, 22, 16, 52, 46], 'A1:F13'),
    '产业链说明',
  )

  const typeLabels: Record<string, string> = {
    material: '物料流',
    capital: '资金流',
    tech: '技术服务',
    guarantee: '担保/互保',
  }
  const enterpriseName = new Map(
    enterprises.map((enterprise) => [enterprise.id, enterprise.name]),
  )
  const relationRows: Array<Array<string | number>> = [
    ['关系ID', '上游企业', '下游企业', '关系类型', '关联值', '业务含义'],
    ...relations.map((relation) => [
      relation[0],
      enterpriseName.get(relation[1]) ?? relation[1],
      enterpriseName.get(relation[2]) ?? relation[2],
      typeLabels[relation[3]],
      relation[4],
      relation[5],
    ]),
  ]
  XLSX.utils.book_append_sheet(
    workbook,
    sheetFromRows(relationRows, [10, 22, 22, 14, 10, 46], 'A1:F17'),
    '关系速览',
  )

  const enterpriseRows: Array<Array<string | number>> = [
    ['id', 'name', 'type', 'region', 'metrics', 'controller_id', 'controller_name'],
    ...enterprises.map((enterprise) => [
      enterprise.id,
      enterprise.name,
      enterprise.type,
      enterprise.region,
      enterprise.metrics,
      enterprise.controllerId,
      enterprise.controllerName,
    ]),
  ]
  XLSX.utils.book_append_sheet(
    workbook,
    sheetFromRows(enterpriseRows, [10, 22, 16, 14, 40, 14, 14], 'A1:G13'),
    '企业表',
  )

  const machineRelationRows: Array<Array<string | number | boolean>> = [
    ['id', 'from_id', 'to_id', 'category', 'association', 'subtype', 'mutual'],
    ...relations.map((relation) => [...relation]),
  ]
  const relationSheet = sheetFromRows(
    machineRelationRows,
    [10, 12, 12, 14, 12, 30, 10],
    'A1:G17',
  )
  for (let row = 2; row <= machineRelationRows.length; row += 1) {
    const cell = relationSheet[`E${row}`]
    if (cell) cell.z = '0.00'
  }
  XLSX.utils.book_append_sheet(workbook, relationSheet, '关系表')

  const riskRows: Array<Array<string | number | boolean>> = [
    ['id', 'name', 'type', 'target_enterprise_ids', 'score', 'enabled'],
    ...riskSources.map((source) => [...source]),
  ]
  const riskSheet = sheetFromRows(
    riskRows,
    [10, 24, 16, 26, 10, 10],
    'A1:F4',
  )
  for (let row = 2; row <= riskRows.length; row += 1) {
    const cell = riskSheet[`E${row}`]
    if (cell) cell.z = '0.00'
  }
  XLSX.utils.book_append_sheet(workbook, riskSheet, '风险源表')

  XLSX.writeFile(workbook, FILE_PATH, {
    compression: true,
    bookType: 'xlsx',
  })

  const bytes = await readFile(FILE_PATH)
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
  const parsed = parseWorkspaceWorkbook(arrayBuffer)

  assert.equal(
    parsed.issues.length,
    0,
    `导入校验失败：${parsed.issues.map((issue) => issue.message).join('；')}`,
  )
  assert.equal(parsed.data.enterprises.length, 12)
  assert.equal(parsed.data.relations.length, 16)
  assert.equal(parsed.data.riskSources.length, 3)
  assert.equal(parsed.data.groups.length, 2)
  assert.equal(
    parsed.data.riskSources.filter((source) => source.enabled).length,
    2,
  )

  const enabledSources = parsed.data.riskSources
    .filter((source) => source.enabled)
    .map((source) => source.id)
  const propagation = buildPropagation(parsed.data, enabledSources)
  const affected = propagation.renderModel.nodes.filter(
    (node) => node.impact > 0,
  ).length
  const safe = propagation.renderModel.nodes.length - affected

  const fileStats = await stat(FILE_PATH)
  console.log(`✓ 已生成：${path.relative(process.cwd(), FILE_PATH)}`)
  console.log(`✓ 文件大小：${(fileStats.size / 1024).toFixed(1)} KB`)
  console.log('✓ 工作表：填写说明 / 产业链说明 / 关系速览 / 企业表 / 关系表 / 风险源表')
  console.log('✓ 导入校验：0 个错误')
  console.log(
    `✓ 数据规模：${parsed.data.enterprises.length} 企业 / ${parsed.data.relations.length} 关系 / ${parsed.data.riskSources.length} 风险源 / ${parsed.data.groups.length} 同控组`,
  )
  console.log(
    `✓ 推演结果：受影响 ${affected} 家，安全 ${safe} 家；默认启用 ${enabledSources.join(', ')}`,
  )
  console.log(
    `✓ 风险源：${parsed.data.riskSources
      .map((source) => `${source.id} ${source.name}（${source.enabled ? '启用' : '停用'}）`)
      .join('；')}`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
