/**
 * 校验渲染层依赖方向。
 * 组件和页面只能通过 Store 与注入的受限能力发起意图，不能直接耦合 Electron IPC 或阅读器内核。
 */
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const sourceRoot = '.'
const restrictedUiRoots = ['src/components/', 'src/pages/', 'src/stores/']
const ignoredDirectories = new Set(['.git', 'node_modules', 'out', 'release', 'vendor'])
const files = await collectFiles(sourceRoot)
const violations = []

for (const file of files) {
  const source = await readFile(file, 'utf8')
  const normalizedFile = file.replaceAll('\\', '/')

  if (importsPackage(source, '@embedpdf') && !normalizedFile.startsWith('src/data/readers/pdf/')) {
    violations.push(`${file}: @embedpdf 导入只能位于 src/data/readers/pdf/，以隔离 PDF 阅读内核。`)
  }
  if (importsFoliate(source) && !normalizedFile.startsWith('src/data/readers/foliate/')) {
    violations.push(`${file}: foliate-js 导入只能位于 src/data/readers/foliate/，以隔离非 PDF 阅读内核。`)
  }
  if (restrictedUiRoots.some((root) => normalizedFile.startsWith(root))) {
    if (/window\.lec/.test(source)) violations.push(`${file}: 组件、页面和 Store 不得直接访问 window.lec，必须通过受限依赖边界。`)
    if (importsPackage(source, 'electron')) violations.push(`${file}: 组件、页面和 Store 不得直接导入 Electron，必须保持渲染层平台无关。`)
  }
}

/** 将包名和指向 vendor/foliate-js 的相对路径都视为 Foliate 内核导入。 */
function importsFoliate(source) {
  return importsPackage(source, 'foliate-js') || importsRelativePath(source, 'vendor/foliate-js/')
}

if (violations.length > 0) {
  console.error(violations.join('\n'))
  process.exitCode = 1
}

/** 判断源码是否以静态、动态或 require 形式导入指定包，避免内核边界被导入语法绕过。 */
function importsPackage(source, packageName) {
  const escapedPackageName = packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const packageSpecifier = `(['"])${escapedPackageName}(?:/[^'"]*)?\\1`
  const patterns = [
    new RegExp(`\\bimport\\s*${packageSpecifier}`),
    new RegExp(`\\bfrom\\s*${packageSpecifier}`),
    new RegExp(`\\bimport\\s*\\(\\s*${packageSpecifier}\\s*\\)`),
    new RegExp(`\\brequire\\s*\\(\\s*${packageSpecifier}\\s*\\)`)
  ]
  return patterns.some((pattern) => pattern.test(source))
}

/** 判断静态、动态或 require 导入是否指向给定的仓库内相对路径。 */
function importsRelativePath(source, pathFragment) {
  const escapedPathFragment = pathFragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pathSpecifier = `(['"])[^'"]*${escapedPathFragment}[^'"]*\\1`
  const patterns = [
    new RegExp(`\\bimport\\s*${pathSpecifier}`),
    new RegExp(`\\bfrom\\s*${pathSpecifier}`),
    new RegExp(`\\bimport\\s*\\(\\s*${pathSpecifier}\\s*\\)`),
    new RegExp(`\\brequire\\s*\\(\\s*${pathSpecifier}\\s*\\)`)
  ]
  return patterns.some((pattern) => pattern.test(source))
}

/** 递归收集仓库内可执行源码，排除依赖、构建产物、子模块和测试代码。 */
async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const paths = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return ignoredDirectories.has(entry.name) ? [] : collectFiles(path)
    return isExecutableSourceFile(entry.name) ? [path] : []
  }))
  return paths.flat()
}

/** 覆盖 Electron、渲染层与 Node 脚本可执行的 JS/TS 模块，声明和测试文件不参与架构校验。 */
function isExecutableSourceFile(name) {
  return /\.(js|jsx|mjs|cjs|ts|tsx|mts|cts)$/.test(name)
    && !/\.(test|spec)\.(js|jsx|mjs|cjs|ts|tsx|mts|cts)$/.test(name)
    && !/\.d\.(ts|mts|cts)$/.test(name)
}
