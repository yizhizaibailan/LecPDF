import { expect, test } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { App } from './App'

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
