/**
 * 职责：验证应用组合页把标签状态、开始页入口和当前阅读会话接入同一运行时。
 * 异步说明：测试先等待文档 Store 完成加载，再以静态渲染检查可见的组合结果。
 */
import { expect, test, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createAppRuntime } from '../config/app-runtime'
import { WindowControlsProvider } from '../layouts/AppLayout'
import { ApplicationPage } from './ApplicationPage'

const windowControls = {
  minimize: async () => undefined,
  toggleMaximize: async () => undefined,
  close: async () => undefined,
  onMaximizedChange: () => () => undefined
}

test('已打开 PDF 的应用页面组合标签栏和阅读页', async () => {
  const runtime = createAppRuntime(
    { fileRead: { getPdfUrl: vi.fn().mockResolvedValue('lec-file://token'), readBuffer: vi.fn() } },
    () => 'tab-1'
  )
  const lifecycle = { onOpenFileRequest: () => () => undefined, openLogsFolder: async () => undefined }
  const dialogs = { openDocuments: async () => [], openFolder: async () => null, locateMissingFile: async () => null }

  // 等待 Store 写入 ready 会话，确保页面从运行时选择到 PDF 来源。
  await runtime.tabStore.getState().openDocument('C:\\Books\\guide.pdf')
  const html = renderToStaticMarkup(
    <WindowControlsProvider windowControls={windowControls}>
      <ApplicationPage runtime={runtime} lifecycle={lifecycle} dialogs={dialogs} />
    </WindowControlsProvider>
  )

  expect(html).toContain('guide.pdf')
  expect(html).toContain('aria-label="PDF 阅读视图"')
})
