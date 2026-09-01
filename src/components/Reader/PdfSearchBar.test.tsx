/**
 * 职责：验证 PDF 搜索栏公开的搜索、大小写与关闭无障碍标签。
 * 导出项：本文件不导出运行时代码，仅覆盖 PdfSearchBar 的公开渲染契约。
 * 资源说明：静态渲染测试不创建订阅或对象 URL，运行时 cleanup 由组件 effect 负责。
 */
import { expect, test } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PdfSearchBar } from './PdfSearchBar'

test('搜索栏提供内容搜索、大小写和关闭标签', () => {
  const html = renderToStaticMarkup(<PdfSearchBar registry={null} onClose={() => undefined} />)

  expect(html).toContain('aria-label="搜索 PDF 内容"')
  expect(html).toContain('aria-label="大小写敏感"')
  expect(html).toContain('aria-label="关闭 PDF 搜索"')
})
