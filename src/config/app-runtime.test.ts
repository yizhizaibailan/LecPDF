/** 验证应用运行时组合依赖并确保临时文档来源不进入 Zustand Store。 */
import { describe, expect, test, vi } from 'vitest'
import { createAppRuntime } from './app-runtime'

describe('应用运行时', () => {
  test('PDF 经 tabStore 打开后，来源只由运行时公开', async () => {
    const runtime = createAppRuntime(
      { fileRead: { getPdfUrl: vi.fn().mockResolvedValue('lec-file://token'), readBuffer: vi.fn() } },
      () => 'tab-1'
    )

    // 等待异步文档加载完成，才能断言阅读会话已 ready 且注册表已保存来源。
    await runtime.tabStore.getState().openDocument('C:\\Books\\guide.pdf')

    expect(runtime.readerStore.getState().sessions['tab-1']).toMatchObject({ kind: 'pdf', status: 'ready' })
    expect(runtime.getSource('tab-1')).toEqual({ kind: 'pdf', url: 'lec-file://token' })
  })

  test('关闭标签后不再公开临时来源', async () => {
    const runtime = createAppRuntime(
      { fileRead: { getPdfUrl: vi.fn().mockResolvedValue('lec-file://token'), readBuffer: vi.fn() } },
      () => 'tab-1'
    )

    // 等待异步打开完成，确保关闭操作针对已创建的临时来源资源。
    await runtime.tabStore.getState().openDocument('C:\\Books\\guide.pdf')
    runtime.tabStore.getState().closeTab('tab-1')

    expect(runtime.getSource('tab-1')).toBeNull()
  })
})
