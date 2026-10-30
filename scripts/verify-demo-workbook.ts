import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { parseWorkspaceWorkbook } from '../src/core/import'
import { buildPropagation } from '../src/core/graph'

const FILE_PATH = path.join(
  process.cwd(),
  'docs',
  '新能源汽车产业链_企业关系示例.xlsx',
)

async function main() {
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

  const enabled = parsed.data.riskSources
    .filter((source) => source.enabled)
    .map((source) => source.id)
  const propagation = buildPropagation(parsed.data, enabled)
  const affected = propagation.renderModel.nodes.filter(
    (node) => node.impact > 0,
  ).length
  const fileStats = await stat(FILE_PATH)

  console.log('✓ 网站导入解析：0 错误')
  console.log(
    `✓ ${parsed.data.enterprises.length} 企业 / ${parsed.data.relations.length} 关系 / ${parsed.data.riskSources.length} 风险源 / ${parsed.data.groups.length} 同控组`,
  )
  console.log(`✓ 推演：${affected} 家受影响，${12 - affected} 家安全`)
  console.log(`✓ 文件：${(fileStats.size / 1024).toFixed(1)} KB`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
