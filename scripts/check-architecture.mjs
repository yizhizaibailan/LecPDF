/**
 * 校验渲染层依赖方向。
 * 组件和页面只能通过 Store 与注入的受限能力发起意图，不能直接耦合 Electron IPC 或阅读器内核。
 */
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const roots = ['src/components', 'src/pages']
const forbidden = [/window\.lec/, /from ['"]electron['"]/, /@embedpdf/, /foliate-js/]
const files = await Promise.all(roots.map(collectFiles)).then((groups) => groups.flat())
const violations = []

for (const file of files) {
  const source = await readFile(file, 'utf8')
  const matched = forbidden.find((pattern) => pattern.test(source))
  if (matched !== undefined) violations.push(`${file}: 禁止直接依赖 ${matched}`)
}

if (violations.length > 0) {
  console.error(violations.join('\n'))
  process.exitCode = 1
}

/** 递归收集 TypeScript 渲染模块，排除测试文件以检查实际运行依赖。 */
async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const paths = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return collectFiles(path)
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name) ? [path] : []
  }))
  return paths.flat()
}
