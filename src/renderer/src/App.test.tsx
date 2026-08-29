import { expect, test } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { App, ReaderToolbar } from './App'

test('renders an empty state with a named solar icon', () => {
  const html = renderToStaticMarkup(<App version="0.1.0" />)

  expect(html).toContain('LecPDF')
  expect(html).toContain('项目骨架已就绪')
  expect(html).toContain('0.1.0')
  expect(html).toContain('data-icon="solar:book-2-linear"')
  expect(html).toContain('aria-label="最小化窗口"')
  expect(html).toContain('aria-label="最大化或还原窗口"')
  expect(html).toContain('aria-label="关闭窗口"')
  expect(html).toContain('title="最大化窗口"')
  expect(html).toContain('window-titlebar')
})

test('renders accessible PDF reading controls', () => {
  const html = renderToStaticMarkup(<ReaderToolbar registry={null} />)

  expect(html).toContain('aria-label="缩小 PDF"')
  expect(html).toContain('aria-label="放大 PDF"')
  expect(html).toContain('aria-label="单页阅读"')
  expect(html).toContain('aria-label="连续阅读"')
  expect(html).toContain('aria-label="双页阅读"')
  expect(html).toContain('aria-label="上一页"')
  expect(html).toContain('aria-label="下一页"')
  expect(html).toContain('aria-label="逆时针旋转 90 度"')
  expect(html).toContain('aria-label="顺时针旋转 90 度"')
  expect(html).toContain('aria-label="跳转到页码"')
})
