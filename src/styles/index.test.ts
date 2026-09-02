/**
 * 职责：验证应用壳的开始页与阅读页都扣除标题栏和标签栏高度。
 * 异步说明：同步读取样式入口，不创建浏览器或等待布局任务。
 * 安全说明：只读取仓库内固定 CSS 文件，不接受外部路径输入。
 * 资源说明：readFileSync 调用完成后不保留文件句柄或 DOM 资源。
 */
import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

const styles = readFileSync(new URL('./index.css', import.meta.url), 'utf8')

function declarationsFor(selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`).exec(styles)
  expect(match, `缺少 ${selector} 样式规则`).not.toBeNull()
  return match?.[1] ?? ''
}

test('阅读页和开始页都只占用标题栏与标签栏下方的可视高度', () => {
  expect(declarationsFor('.reader-shell')).toMatch(/height:\s*calc\(100vh - 76px\)/)
  expect(declarationsFor('.home-page')).toMatch(/min-height:\s*calc\(100vh - 76px\)/)
})
