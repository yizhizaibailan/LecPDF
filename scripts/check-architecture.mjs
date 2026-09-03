/**
 * 校验渲染层依赖方向。
 * 组件和页面只能通过 Store 与注入的受限能力发起意图，不能直接耦合 Electron IPC 或阅读器内核。
 */
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const sourceRoot = 'src'
const restrictedUiRoots = ['src/components/', 'src/pages/', 'src/stores/']
const files = await collectFiles(sourceRoot)
const violations = []

for (const file of files) {
  const source = await readFile(file, 'utf8')
  const normalizedFile = file.replaceAll('\\', '/')

  if (importsPackage(source, '@embedpdf') && !normalizedFile.startsWith('src/data/readers/pdf/')) {
    violations.push(`${file}: @embedpdf 导入只能位于 src/data/readers/pdf/，以隔离 PDF 阅读内核。`)
  }
  if (importsPackage(source, 'foliate-js') && !normalizedFile.startsWith('src/data/readers/foliate/')) {
    violations.push(`${file}: foliate-js 导入只能位于 src/data/readers/foliate/，以隔离非 PDF 阅读内核。`)
  }
  if (restrictedUiRoots.some((root) => normalizedFile.startsWith(root))) {
    if (/window\.lec/.test(source)) violations.push(`${file}: 组件、页面和 Store 不得直接访问 window.lec，必须通过受限依赖边界。`)
    if (importsPackage(source, 'electron')) violations.push(`${file}: 组件、页面和 Store 不得直接导入 Electron，必须保持渲染层平台无关。`)
  }
}

if (violations.length > 0) {
  console.error(violations.join('\n'))
  process.exitCode = 1
}

/** 判断源码是否静态或动态导入指定包，避免注释中的普通文字触发边界检查。 */
function importsPackage(source, packageName) {
  const escapedPackageName = packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`(?:from\\s*|import\\s*\\()(['"])${escapedPackageName}(?:/[^'"]*)?\\1`)
  return pattern.test(source)
}

/** 递归收集 TypeScript 渲染模块，排除测试文件以检查实际运行依赖。 */
async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const paths = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return collectFiles(path)
    return /\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.(ts|tsx)$/.test(entry.name) ? [path] : []
  }))
  return paths.flat()
}
