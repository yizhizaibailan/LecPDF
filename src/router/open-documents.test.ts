/**
 * 职责：验证对话框选择结果按顺序复用标签打开动作。
 * 异步说明：deferred 首次打开用于证明后续路径必须等待前一次完成。
 * 安全说明：路由只转交主进程已筛选的路径，不读取文件或调用任意 IPC。
 * 资源说明：测试 Promise 全部在用例内完成，不遗留后台任务。
 */
import { expect, test, vi } from 'vitest'
import { openDocumentsFromDialog } from './open-documents'

function createDeferred<T>(): { promise: Promise<T>; resolve(value: T): void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => { resolve = next })
  return { promise, resolve }
}

/**
 * 验证多文件选择按选择顺序交给标签打开动作，避免并行加载打乱当前标签状态。
 */
test('选择器中的全部路径复用标签打开动作', async () => {
  const selectPaths = vi.fn().mockResolvedValue(['C:\\Books\\a.pdf', 'C:\\Books\\b.pdf'])
  const openDocument = vi.fn().mockResolvedValue('tab-1')

  await openDocumentsFromDialog(selectPaths, openDocument)

  expect(openDocument).toHaveBeenNthCalledWith(1, 'C:\\Books\\a.pdf')
  expect(openDocument).toHaveBeenNthCalledWith(2, 'C:\\Books\\b.pdf')
})

test('第二个文档等待第一个文档完成后才开始打开', async () => {
  const first = createDeferred<string | null>()
  const selectPaths = vi.fn().mockResolvedValue(['C:\\Books\\a.pdf', 'C:\\Books\\b.pdf'])
  const openDocument = vi.fn()
    .mockImplementationOnce(() => first.promise)
    .mockResolvedValueOnce('tab-2')

  const completion = openDocumentsFromDialog(selectPaths, openDocument)
  await Promise.resolve()

  expect(openDocument).toHaveBeenCalledOnce()
  expect(openDocument).toHaveBeenCalledWith('C:\\Books\\a.pdf')

  first.resolve('tab-1')
  await completion

  expect(openDocument).toHaveBeenNthCalledWith(2, 'C:\\Books\\b.pdf')
})
