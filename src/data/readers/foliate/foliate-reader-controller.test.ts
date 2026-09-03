import { expect, test } from 'vitest'
import type { ReaderEvent } from '../../../types/reader'
import { createFoliateReaderController } from './foliate-reader-controller'

/** 验证 Foliate 控制器委托打开、关闭和事件订阅，并确保重复取消订阅只释放一次资源。 */
test('控制器委托 Foliate 生命周期与标准事件订阅', async () => {
  const calls: string[] = []
  let subscribedListener: ((event: ReaderEvent) => void) | undefined
  let unsubscribeCount = 0
  const bytes = new ArrayBuffer(4)
  const event: ReaderEvent = { type: 'ready' }
  const controller = createFoliateReaderController({
    open: async (receivedBytes) => {
      expect(receivedBytes).toBe(bytes)
      calls.push('open')
    },
    close: () => { calls.push('close') },
    subscribe: (listener) => {
      subscribedListener = listener
      calls.push('subscribe')
      return () => { unsubscribeCount += 1 }
    }
  })

  await controller.open(bytes)
  const received: ReaderEvent[] = []
  const unsubscribe = controller.subscribe((receivedEvent) => { received.push(receivedEvent) })
  subscribedListener?.(event)
  controller.close()
  unsubscribe()
  unsubscribe()

  expect(calls).toEqual(['open', 'subscribe', 'close'])
  expect(received).toEqual([event])
  expect(unsubscribeCount).toBe(1)
})
