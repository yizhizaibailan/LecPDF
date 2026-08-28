import { expect, test } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { App } from './App'

test('renders an empty state with a named solar icon', () => {
  const html = renderToStaticMarkup(<App version="0.1.0" />)

  expect(html).toContain('LecPDF')
  expect(html).toContain('项目骨架已就绪')
  expect(html).toContain('0.1.0')
  expect(html).toContain('data-icon="solar:book-2-linear"')
})
