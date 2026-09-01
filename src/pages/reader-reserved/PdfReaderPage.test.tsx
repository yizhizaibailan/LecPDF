/**
 * 职责：验证受控 PDF 页面组合阅读视图，并防止它跨越 Electron 或数据层边界。
 * 导出项：本文件不导出运行时代码，仅覆盖 PdfReaderPage 的公开渲染契约。
 * 资源说明：通过源码扫描守住组件边界；真实订阅与对象 URL 的释放由组件 effect 覆盖。
 */
import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PdfReaderPage } from './PdfReaderPage'

test('PDF 页面组合阅读视图、工具栏和侧栏', () => {
  const html = renderToStaticMarkup(<PdfReaderPage url="lec-file://document/token" />)

  expect(html).toContain('aria-label="PDF 阅读视图"')
  expect(html).toContain('aria-label="连续阅读"')
  expect(html).toContain('aria-label="打开 PDF 缩略图"')
})

test('阅读组件不直接导入 Electron 或数据层', () => {
  const modules = [
    new URL('../../components/Reader/PdfToolbar.tsx', import.meta.url),
    new URL('../../components/Reader/PdfSearchBar.tsx', import.meta.url),
    new URL('../../components/Reader/PdfNavigationSidebar.tsx', import.meta.url),
    new URL('./PdfReaderPage.tsx', import.meta.url)
  ]

  const forbiddenImports = [['window', 'lec'].join('.'), ['db', 'api'].join('-'), ['document', 'session'].join('-')]
  for (const moduleUrl of modules) for (const forbiddenImport of forbiddenImports) {
    expect(readFileSync(moduleUrl, 'utf8')).not.toContain(forbiddenImport)
  }
})
