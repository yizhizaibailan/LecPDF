/** 校验 Foliate 的可审计来源与生产阅读器 CSP 边界。 */
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'

const foliateCommit = '78914aef4466eb960965702401634c2cb348e9b1'
const required = [
  'path = vendor/foliate-js',
  'url = https://github.com/johnfactotum/foliate-js.git',
  "script-src 'self'",
  'frame-src blob:',
  'worker-src blob:'
]

const [gitmodules, index] = await Promise.all([
  readRequiredFile('.gitmodules'),
  readRequiredFile('index.html')
])
const csp = index.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)?.[1]
const directives = new Map(csp?.split(';').map((directive) => {
  const [name, ...sources] = directive.trim().split(/\s+/)
  return [name, sources]
}) ?? [])
const missing = required.filter((value) => {
  if (value.startsWith('path =') || value.startsWith('url =')) return !gitmodules.includes(value)
  if (!csp) return true
  if (value === "script-src 'self'") return !directives.get('script-src')?.includes("'self'")
  if (value === 'frame-src blob:') return !directives.get('frame-src')?.includes('blob:')
  return !directives.get('worker-src')?.includes('blob:')
})

if (missing.length > 0) {
  throw new Error(`Foliate 集成边界缺失：${missing.join('、')}`)
}

if (directives.get('script-src')?.join(' ') !== "'self'") {
  throw new Error("生产 CSP 的 script-src 只能允许 'self'，不得放行外部脚本。")
}

const currentCommit = execFileSync('git', ['-C', 'vendor/foliate-js', 'rev-parse', 'HEAD'], {
  encoding: 'utf8'
}).trim()

if (currentCommit !== foliateCommit) {
  throw new Error(`Foliate 子模块必须固定为 ${foliateCommit}，当前为 ${currentCommit}`)
}

async function readRequiredFile(path) {
  try {
    return await readFile(path, 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') throw new Error(`Foliate 集成边界缺失：${path}`)
    throw error
  }
}
