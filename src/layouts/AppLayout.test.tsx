import { expect, test } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AppLayout, WindowControlsProvider } from './AppLayout'

const windowControls = {
  minimize: async () => undefined,
  toggleMaximize: async () => undefined,
  close: async () => undefined,
  onMaximizedChange: () => () => undefined
}

/**
 * 该测试确保所有页面共享无边框窗口标题栏，而业务页面只负责提供自己的主内容。
 * 异步说明：静态渲染不会订阅注入的窗口能力，真实最大化状态订阅由标题栏 effect 在卸载时取消。
 */
test('注入窗口能力的应用框架渲染标题栏和页面内容', () => {
  const html = renderToStaticMarkup(
    <WindowControlsProvider windowControls={windowControls}>
      <AppLayout tabs={<nav aria-label="文档标签">guide.pdf</nav>}>
        <p>阅读内容</p>
      </AppLayout>
    </WindowControlsProvider>
  )

  expect(html).toContain('window-titlebar')
  expect(html).toContain('aria-label="最小化窗口"')
  expect(html).toContain('aria-label="最大化或还原窗口"')
  expect(html).toContain('aria-label="关闭窗口"')
  expect(html).toContain('title="最大化窗口"')
  expect(html).toContain('aria-label="文档标签"')
  expect(html).toContain('阅读内容')
})
