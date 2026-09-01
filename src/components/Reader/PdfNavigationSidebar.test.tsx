/**
 * 职责：验证 PDF 导航侧栏公开的缩略图与目录切换入口。
 * 导出项：本文件不导出运行时代码，仅覆盖 PdfNavigationSidebar 的公开渲染契约。
 */
import { expect, test } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PdfNavigationSidebar } from './PdfNavigationSidebar'

test('导航侧栏提供缩略图和目录标签', () => {
  const html = renderToStaticMarkup(<PdfNavigationSidebar registry={null} />)

  expect(html).toContain('aria-label="打开 PDF 缩略图"')
  expect(html).toContain('aria-label="打开 PDF 目录"')
})
