import { expect, test } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AppLayout } from './AppLayout'

/**
 * 该测试确保所有页面共享无边框窗口标题栏，而业务页面只负责提供自己的主内容。
 */
test('在应用框架中渲染标题栏和页面内容', () => {
  const html = renderToStaticMarkup(<AppLayout><p>阅读内容</p></AppLayout>)

  expect(html).toContain('window-titlebar')
  expect(html).toContain('aria-label="最小化窗口"')
  expect(html).toContain('阅读内容')
})
