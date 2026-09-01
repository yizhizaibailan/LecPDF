import { expect, test } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { HomePage } from './HomePage'

/**
 * 验证开始页把打开文件意图交给注入的回调，并提供可访问的操作入口。
 */
test('开始页提供打开文件按钮', () => {
  const html = renderToStaticMarkup(<HomePage onOpenDocuments={async () => undefined} />)

  expect(html).toContain('打开文件')
  expect(html).toContain('aria-label="打开文件"')
})
