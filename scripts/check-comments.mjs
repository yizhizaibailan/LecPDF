/**
 * 检查 Electron 与渲染层 TypeScript 模块是否至少含有职责或实现说明注释。
 * 该脚本只验证可机械判断的注释存在性；导出项和资源释放的语义审查仍由代码评审承担。
 */
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const roots = ['electron', 'src']
const files = (await Promise.all(roots.map(collectFiles))).flat()
const missing = []

for (const file of files) {
  const source = await readFile(file, 'utf8')
  if (!/\/(?:\*|\/)/.test(source)) missing.push(`${file}: 缺少职责或实现说明注释`)
}

if (missing.length > 0) {
  console.error(missing.join('\n'))
  process.exitCode = 1
}

/** 递归收集项目内全部 TS/TSX 模块，包括测试，避免新增代码绕过注释约定。 */
async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const paths = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return collectFiles(path)
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : []
  }))
  return paths.flat()
}
