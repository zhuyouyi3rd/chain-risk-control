import * as XLSX from 'xlsx'
import type {
  Enterprise,
  EnterpriseType,
  Relation,
  RelationCategory,
  RiskSource,
  RiskSourceType,
  WorkspaceData,
} from './types'
import { buildControllerGroups } from './workspace'

export type ImportScope = 'file' | 'enterprise' | 'relation' | 'riskSource'

export interface ImportIssue {
  scope: ImportScope
  index: number
  row: number
  field?: string
  message: string
}

export interface ParsedWorkspace {
  data: WorkspaceData
  issues: ImportIssue[]
}

export const TEMPLATE_FILE_NAME = '产业链风控系统_数据导入模板.xlsx'

export const ENTERPRISE_TYPES: readonly EnterpriseType[] = [
  'raw_material',
  'warehouse',
  'workshop',
  'trading',
  'service',
  'finance',
]

export const RELATION_CATEGORIES: readonly RelationCategory[] = [
  'material',
  'capital',
  'tech',
  'guarantee',
]

export const RISK_SOURCE_TYPES: readonly RiskSourceType[] = [
  'material',
  'capital',
  'tech',
  'guarantee',
  'control',
]

const ENTERPRISE_HEADERS = [
  'id',
  'name',
  'type',
  'region',
  'metrics',
  'controller_id',
  'controller_name',
] as const

const RELATION_HEADERS = [
  'id',
  'from_id',
  'to_id',
  'category',
  'association',
  'subtype',
  'mutual',
] as const

const RISK_SOURCE_HEADERS = [
  'id',
  'name',
  'type',
  'target_enterprise_ids',
  'score',
  'enabled',
] as const

const SHEET_ALIASES = {
  enterprise: ['企业表', '企业', 'enterprises'],
  relation: ['关系表', '关系', 'relations'],
  riskSource: ['风险源表', '风险源', 'risksources', 'risk_sources'],
} as const

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

function asText(value: unknown): string {
  return String(value ?? '').trim()
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  const text = asText(value)
  if (!text) return null
  const number = Number(text)
  return Number.isFinite(number) ? number : null
}

function parseBoolean(
  value: unknown,
  fallback: boolean,
): { value: boolean; valid: boolean } {
  if (value === '' || value === null || value === undefined) {
    return { value: fallback, valid: true }
  }
  if (typeof value === 'boolean') {
    return { value, valid: true }
  }
  const text = asText(value).toLowerCase()
  if (['true', '1', 'yes', 'y', '是', '启用', '开启'].includes(text)) {
    return { value: true, valid: true }
  }
  if (['false', '0', 'no', 'n', '否', '停用', '关闭'].includes(text)) {
    return { value: false, valid: true }
  }
  return { value: fallback, valid: false }
}

function isEnterpriseType(value: string): value is EnterpriseType {
  return (ENTERPRISE_TYPES as readonly string[]).includes(value)
}

function isRelationCategory(value: string): value is RelationCategory {
  return (RELATION_CATEGORIES as readonly string[]).includes(value)
}

function isRiskSourceType(value: string): value is RiskSourceType {
  return (RISK_SOURCE_TYPES as readonly string[]).includes(value)
}

function resolveSheet(
  workbook: XLSX.WorkBook,
  aliases: readonly string[],
): XLSX.WorkSheet | null {
  const normalizedAliases = aliases.map((alias) => alias.trim().toLowerCase())
  const sheetName = workbook.SheetNames.find((name) =>
    normalizedAliases.includes(name.trim().toLowerCase()),
  )
  return sheetName ? workbook.Sheets[sheetName] ?? null : null
}

function toMatrix(sheet: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
    raw: true,
  })
}

function getCell(
  row: unknown[],
  headers: Map<string, number>,
  ...keys: string[]
): unknown {
  for (const key of keys) {
    const index = headers.get(key)
    if (index !== undefined) return row[index] ?? ''
  }
  return ''
}

interface SheetTable {
  rows: unknown[][]
  headers: Map<string, number>
}

type HeaderRequirement = string | readonly string[]

function readTable(
  workbook: XLSX.WorkBook,
  aliases: readonly string[],
  label: string,
  requiredHeaders: readonly HeaderRequirement[],
  issues: ImportIssue[],
): SheetTable | null {
  const sheet = resolveSheet(workbook, aliases)
  if (!sheet) {
    issues.push({
      scope: 'file',
      index: -1,
      row: 0,
      message: `未找到「${label}」工作表，请使用系统模板。`,
    })
    return null
  }

  const matrix = toMatrix(sheet)
  const headerRow = matrix[0] ?? []
  const headers = new Map<string, number>()

  headerRow.forEach((cell, index) => {
    const key = normalizeHeader(cell)
    if (key && !headers.has(key)) headers.set(key, index)
  })

  const missingHeaders = requiredHeaders.filter((requirement) => {
    const keys =
      typeof requirement === 'string' ? [requirement] : requirement
    return !keys.some((key) => headers.has(key))
  })

  if (missingHeaders.length > 0) {
    const labels = missingHeaders.map((requirement) =>
      typeof requirement === 'string' ? requirement : requirement[0],
    )
    issues.push({
      scope: 'file',
      index: -1,
      row: 1,
      message: `「${label}」缺少必填列：${labels.join('、')}。`,
    })
    return null
  }

  return { rows: matrix.slice(1), headers }
}

function rowIssue(
  scope: Exclude<ImportScope, 'file'>,
  index: number,
  row: number,
  message: string,
  field?: string,
): ImportIssue {
  return { scope, index, row, field, message }
}

/**
 * 将 Excel 工作簿解析为 WorkspaceData，并保留每一行的校验错误。
 * 解析不修改 store，只有调用方确认无错误后才写入工作区。
 */
export function parseWorkspaceWorkbook(buffer: ArrayBuffer): ParsedWorkspace {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const issues: ImportIssue[] = []
  const enterprises: Enterprise[] = []
  const relations: Relation[] = []
  const riskSources: RiskSource[] = []

  const enterpriseIds = new Set<string>()

  const enterpriseTable = readTable(
    workbook,
    SHEET_ALIASES.enterprise,
    '企业表',
    ['id', 'name', 'type'],
    issues,
  )

  if (enterpriseTable) {
    if (enterpriseTable.rows.length === 0) {
      issues.push({
        scope: 'file',
        index: -1,
        row: 2,
        message: '「企业表」没有可导入的数据行。',
      })
    }

    enterpriseTable.rows.forEach((row, index) => {
      const rowNumber = index + 2
      const id = asText(getCell(row, enterpriseTable.headers, 'id'))
      const name = asText(getCell(row, enterpriseTable.headers, 'name'))
      const typeText = asText(getCell(row, enterpriseTable.headers, 'type'))
      const region = asText(getCell(row, enterpriseTable.headers, 'region'))
      const metrics = asText(getCell(row, enterpriseTable.headers, 'metrics'))
      const controllerGroup = asText(
        getCell(row, enterpriseTable.headers, 'controller_id'),
      )
      const controllerName = asText(
        getCell(row, enterpriseTable.headers, 'controller_name'),
      )

      if (!id) {
        issues.push(
          rowIssue('enterprise', index, rowNumber, '企业 ID 不能为空。', 'id'),
        )
      } else if (enterpriseIds.has(id)) {
        issues.push(
          rowIssue(
            'enterprise',
            index,
            rowNumber,
            `企业 ID「${id}」重复。`,
            'id',
          ),
        )
      } else {
        enterpriseIds.add(id)
      }

      if (!name) {
        issues.push(
          rowIssue(
            'enterprise',
            index,
            rowNumber,
            '企业名称不能为空。',
            'name',
          ),
        )
      }

      if (!isEnterpriseType(typeText)) {
        issues.push(
          rowIssue(
            'enterprise',
            index,
            rowNumber,
            `企业 type 无效，应为 ${ENTERPRISE_TYPES.join(' / ')}。`,
            'type',
          ),
        )
      }

      if (controllerName && !controllerGroup) {
        issues.push(
          rowIssue(
            'enterprise',
            index,
            rowNumber,
            '填写 controller_name 时必须同时填写 controller_id。',
            'controller_name',
          ),
        )
      }

      const enterprise: Enterprise = {
        id,
        name,
        type: typeText as EnterpriseType,
      }
      if (region) enterprise.region = region
      if (metrics) enterprise.metrics = metrics
      if (controllerGroup) enterprise.controllerGroup = controllerGroup
      if (controllerName) enterprise.controllerName = controllerName
      enterprises.push(enterprise)
    })
  }

  const relationIds = new Set<string>()
  const relationSignatures = new Set<string>()

  const relationTable = readTable(
    workbook,
    SHEET_ALIASES.relation,
    '关系表',
    [
      'id',
      ['from_id', 'from'],
      ['to_id', 'to'],
      'category',
      'association',
    ],
    issues,
  )

  if (relationTable) {
    if (relationTable.rows.length === 0) {
      issues.push({
        scope: 'file',
        index: -1,
        row: 2,
        message: '「关系表」没有可导入的数据行。',
      })
    }

    relationTable.rows.forEach((row, index) => {
      const rowNumber = index + 2
      const id = asText(getCell(row, relationTable.headers, 'id'))
      const from = asText(
        getCell(row, relationTable.headers, 'from_id', 'from'),
      )
      const to = asText(getCell(row, relationTable.headers, 'to_id', 'to'))
      const categoryText = asText(
        getCell(row, relationTable.headers, 'category'),
      )
      const association = parseNumber(
        getCell(row, relationTable.headers, 'association'),
      )
      const subtype = asText(
        getCell(row, relationTable.headers, 'subtype'),
      )
      const mutualResult = parseBoolean(
        getCell(row, relationTable.headers, 'mutual'),
        false,
      )

      if (!id) {
        issues.push(
          rowIssue('relation', index, rowNumber, '关系 ID 不能为空。', 'id'),
        )
      } else if (relationIds.has(id)) {
        issues.push(
          rowIssue(
            'relation',
            index,
            rowNumber,
            `关系 ID「${id}」重复。`,
            'id',
          ),
        )
      } else {
        relationIds.add(id)
      }

      if (!from) {
        issues.push(
          rowIssue(
            'relation',
            index,
            rowNumber,
            '关系起点 from_id 不能为空。',
            'from_id',
          ),
        )
      } else if (enterpriseIds.size > 0 && !enterpriseIds.has(from)) {
        issues.push(
          rowIssue(
            'relation',
            index,
            rowNumber,
            `关系起点「${from}」在企业表中不存在。`,
            'from_id',
          ),
        )
      }

      if (!to) {
        issues.push(
          rowIssue(
            'relation',
            index,
            rowNumber,
            '关系终点 to_id 不能为空。',
            'to_id',
          ),
        )
      } else if (enterpriseIds.size > 0 && !enterpriseIds.has(to)) {
        issues.push(
          rowIssue(
            'relation',
            index,
            rowNumber,
            `关系终点「${to}」在企业表中不存在。`,
            'to_id',
          ),
        )
      }

      if (from && to && from === to) {
        issues.push(
          rowIssue(
            'relation',
            index,
            rowNumber,
            '关系起点与终点不能是同一家企业。',
            'to_id',
          ),
        )
      }

      if (!isRelationCategory(categoryText)) {
        issues.push(
          rowIssue(
            'relation',
            index,
            rowNumber,
            `关系 category 无效，应为 ${RELATION_CATEGORIES.join(' / ')}。`,
            'category',
          ),
        )
      }

      if (association === null) {
        issues.push(
          rowIssue(
            'relation',
            index,
            rowNumber,
            '关联值 association 必须是数字。',
            'association',
          ),
        )
      } else if (association < 0 || association > 1) {
        issues.push(
          rowIssue(
            'relation',
            index,
            rowNumber,
            '关联值 association 必须在 0 到 1 之间。',
            'association',
          ),
        )
      }

      if (!mutualResult.valid) {
        issues.push(
          rowIssue(
            'relation',
            index,
            rowNumber,
            'mutual 仅支持 true/false、是/否、1/0。',
            'mutual',
          ),
        )
      }

      if (from && to && categoryText) {
        const signature = `${from}->${to}:${categoryText}`
        if (relationSignatures.has(signature)) {
          issues.push(
            rowIssue(
              'relation',
              index,
              rowNumber,
              `重复关系：${from} → ${to}（${categoryText}）已存在。`,
              'category',
            ),
          )
        } else {
          relationSignatures.add(signature)
        }
      }

      const relation: Relation = {
        id,
        from,
        to,
        category: categoryText as RelationCategory,
        association: association ?? 0,
        mutual: mutualResult.value,
      }
      if (subtype) relation.subtype = subtype
      relations.push(relation)
    })
  }

  const riskSourceIds = new Set<string>()

  const riskSourceTable = readTable(
    workbook,
    SHEET_ALIASES.riskSource,
    '风险源表',
    [
      'id',
      'name',
      'type',
      ['target_enterprise_ids', 'target_enterprise_id'],
      ['score', 'initial_score'],
    ],
    issues,
  )

  if (riskSourceTable) {
    if (riskSourceTable.rows.length === 0) {
      issues.push({
        scope: 'file',
        index: -1,
        row: 2,
        message: '「风险源表」没有可导入的数据行。',
      })
    }

    riskSourceTable.rows.forEach((row, index) => {
      const rowNumber = index + 2
      const id = asText(getCell(row, riskSourceTable.headers, 'id'))
      const name = asText(getCell(row, riskSourceTable.headers, 'name'))
      const typeText = asText(getCell(row, riskSourceTable.headers, 'type'))
      const targetText = asText(
        getCell(
          row,
          riskSourceTable.headers,
          'target_enterprise_ids',
          'target_enterprise_id',
        ),
      )
      const score = parseNumber(
        getCell(row, riskSourceTable.headers, 'score', 'initial_score'),
      )
      const enabledResult = parseBoolean(
        getCell(row, riskSourceTable.headers, 'enabled'),
        true,
      )
      const targetEnterpriseIds = targetText
        .split(/[\s,，;；]+/)
        .map((target) => target.trim())
        .filter(Boolean)

      if (!id) {
        issues.push(
          rowIssue(
            'riskSource',
            index,
            rowNumber,
            '风险源 ID 不能为空。',
            'id',
          ),
        )
      } else if (riskSourceIds.has(id)) {
        issues.push(
          rowIssue(
            'riskSource',
            index,
            rowNumber,
            `风险源 ID「${id}」重复。`,
            'id',
          ),
        )
      } else {
        riskSourceIds.add(id)
      }

      if (!name) {
        issues.push(
          rowIssue(
            'riskSource',
            index,
            rowNumber,
            '风险源名称不能为空。',
            'name',
          ),
        )
      }

      if (!isRiskSourceType(typeText)) {
        issues.push(
          rowIssue(
            'riskSource',
            index,
            rowNumber,
            `风险源 type 无效，应为 ${RISK_SOURCE_TYPES.join(' / ')}。`,
            'type',
          ),
        )
      }

      if (targetEnterpriseIds.length === 0) {
        issues.push(
          rowIssue(
            'riskSource',
            index,
            rowNumber,
            'target_enterprise_ids 不能为空；多个目标用逗号分隔。',
            'target_enterprise_ids',
          ),
        )
      } else if (enterpriseIds.size > 0) {
        const missingTargets = targetEnterpriseIds.filter(
          (target) => !enterpriseIds.has(target),
        )
        if (missingTargets.length > 0) {
          issues.push(
            rowIssue(
              'riskSource',
              index,
              rowNumber,
              `风险源目标企业不存在：${missingTargets.join('、')}。`,
              'target_enterprise_ids',
            ),
          )
        }
      }

      if (score === null) {
        issues.push(
          rowIssue(
            'riskSource',
            index,
            rowNumber,
            '初始强度 score 必须是数字。',
            'score',
          ),
        )
      } else if (score < 0 || score > 1) {
        issues.push(
          rowIssue(
            'riskSource',
            index,
            rowNumber,
            '初始强度 score 必须在 0 到 1 之间。',
            'score',
          ),
        )
      }

      if (!enabledResult.valid) {
        issues.push(
          rowIssue(
            'riskSource',
            index,
            rowNumber,
            'enabled 仅支持 true/false、是/否、1/0。',
            'enabled',
          ),
        )
      }

      riskSources.push({
        id,
        name,
        type: typeText as RiskSourceType,
        targetEnterpriseIds,
        score: score ?? 0,
        enabled: enabledResult.value,
      })
    })
  }

  return {
    data: {
      enterprises,
      relations,
      riskSources,
      groups: buildControllerGroups(enterprises),
    },
    issues,
  }
}

function styleSheet(
  sheet: XLSX.WorkSheet,
  widths: number[],
  headerRange?: string,
) {
  sheet['!cols'] = widths.map((width) => ({ wch: width }))
  if (headerRange) {
    sheet['!autofilter'] = { ref: headerRange }
  }
  return sheet
}

export function createTemplateWorkbook(): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new()
  workbook.Props = {
    Title: '产业链风控系统 数据导入模板',
    Subject: '企业、关系与风险源导入',
    Author: '产业链风控系统',
    CreatedDate: new Date(),
  }

  const guideRows: Array<Array<string | number>> = [
    ['产业链风控系统 · 数据导入模板', ''],
    ['模板版本', 'Step 2 / v1'],
    [
      '填写须知',
      '请勿修改工作表名称和表头；企业、关系、风险源 ID 必须唯一。',
    ],
    [
      '企业 type',
      'raw_material / warehouse / workshop / trading / service / finance',
    ],
    [
      '关系 category',
      'material / capital / tech / guarantee；同控关系不用填，按 controller_id 自动归组。',
    ],
    ['association / score', '填写 0 到 1 之间的小数。'],
    ['target_enterprise_ids', '多个目标企业用英文逗号分隔，例如 E5,E6。'],
    [
      'enabled / mutual',
      '支持 true/false、是/否、1/0；enabled 留空默认启用，mutual 留空默认否。',
    ],
    [
      'controller_id',
      '相同的 controller_id 自动归入同一控制组；同控不生成关系边。',
    ],
    ['导入流程', '上传 Excel → 预览校验 → 修正错误行 → 确认导入。'],
    ['提示', 'PDF / Word 文档导入将在后续版本支持。'],
  ]
  const guideSheet = XLSX.utils.aoa_to_sheet(guideRows)
  styleSheet(guideSheet, [22, 96])
  XLSX.utils.book_append_sheet(workbook, guideSheet, '填写说明')

  const enterpriseSheet = XLSX.utils.aoa_to_sheet([[...ENTERPRISE_HEADERS]])
  styleSheet(enterpriseSheet, [12, 24, 18, 16, 30, 16, 16], 'A1:G1')
  XLSX.utils.book_append_sheet(workbook, enterpriseSheet, '企业表')

  const relationSheet = XLSX.utils.aoa_to_sheet([[...RELATION_HEADERS]])
  styleSheet(relationSheet, [12, 14, 14, 16, 14, 20, 12], 'A1:G1')
  XLSX.utils.book_append_sheet(workbook, relationSheet, '关系表')

  const riskSourceSheet = XLSX.utils.aoa_to_sheet([[...RISK_SOURCE_HEADERS]])
  styleSheet(riskSourceSheet, [12, 24, 18, 24, 12, 12], 'A1:F1')
  XLSX.utils.book_append_sheet(workbook, riskSourceSheet, '风险源表')

  return workbook
}
