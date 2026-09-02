import { expect, test, vi } from 'vitest'
import { bindOpenFileRequests } from './index'

/** 验证生命周期桥接只转发系统文件打开意图，并由调用方负责后续状态协调。 */
test('系统文件打开事件只转发到标签 Action，并返回取消订阅函数', async () => {
  let listener: ((path: string) => void) | undefined
  const unsubscribe = vi.fn()
  const openDocument = vi.fn().mockResolvedValue('tab-1')
  const stop = bindOpenFileRequests((next) => {
    listener = next
    return unsubscribe
  }, openDocument)

  listener?.('C:\\Books\\guide.pdf')
  await Promise.resolve()

  expect(openDocument).toHaveBeenCalledWith('C:\\Books\\guide.pdf')
  stop()
  expect(unsubscribe).toHaveBeenCalledOnce()
})
