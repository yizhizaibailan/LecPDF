/**
 * 职责：验证 Foliate 视图事件被隔离并转换为可序列化的 ReaderEvent。
 * 资源说明：测试通过原生 EventTarget 驱动事件，并验证关闭与退订后不再保留监听器。
 */
import { expect, test } from 'vitest'
import type { ReaderEvent } from '../../../types/reader'
import { createFoliateViewPort, type FoliateViewElement } from './foliate-view-port'

/** 以真实 EventTarget 追踪监听器释放，避免测试依赖 Foliate 运行时。 */
class TestFoliateView extends EventTarget implements FoliateViewElement {
  book?: { toc: Array<{ label: string; href: string; subitems: Array<{ label: string; href: string; subitems: [] }> }> }
  openedSource?: Blob
  closeCount = 0
  removedListeners = 0

  async open(source: Blob): Promise<void> {
    this.openedSource = source
  }

  close(): void {
    this.closeCount += 1
  }

  override removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions): void {
    this.removedListeners += 1
    super.removeEventListener(type, listener, options)
  }
}

/** 构造携带 Foliate relocate 详情的原生事件。 */
function relocate(detail: { index: number; fraction: number }): Event {
  const event = new Event('relocate')
  Object.defineProperty(event, 'detail', { value: detail })
  return event
}

test('打开 EPUB 后发布递归目录和就绪事件', async () => {
  const view = new TestFoliateView()
  view.book = {
    toc: [{
      label: '第一章',
      href: '#chapter-1',
      subitems: [{ label: '第一节', href: '#chapter-1-1', subitems: [] }]
    }]
  }
  const port = createFoliateViewPort(view)
  const received: ReaderEvent[] = []
  port.subscribe((event) => received.push(event))
  const bytes = new Uint8Array([1, 2, 3]).buffer

  await port.open(bytes)

  expect(view.openedSource?.type).toBe('application/epub+zip')
  await expect(view.openedSource?.arrayBuffer()).resolves.toEqual(bytes)
  expect(received).toEqual([
    {
      type: 'outline-changed',
      outline: [{
        id: 'foliate-outline-0',
        title: '第一章',
        location: { page: null, chapter: '#chapter-1', percent: 0 },
        children: [{
          id: 'foliate-outline-0.0',
          title: '第一节',
          location: { page: null, chapter: '#chapter-1-1', percent: 0 },
          children: []
        }]
      }]
    },
    { type: 'ready' }
  ])
})

test('目录子项为 null 或缺失时仍发布空子目录和就绪事件', async () => {
  const view = new TestFoliateView()
  view.book = {
    toc: [
      { label: '空目录', href: '#empty', subitems: null },
      { label: '缺省目录', href: '#missing' }
    ]
  } as never
  const port = createFoliateViewPort(view)
  const received: ReaderEvent[] = []
  port.subscribe((event) => received.push(event))

  await port.open(new ArrayBuffer(0))

  expect(received).toEqual([
    {
      type: 'outline-changed',
      outline: [
        { id: 'foliate-outline-0', title: '空目录', location: { page: null, chapter: '#empty', percent: 0 }, children: [] },
        { id: 'foliate-outline-1', title: '缺省目录', location: { page: null, chapter: '#missing', percent: 0 }, children: [] }
      ]
    },
    { type: 'ready' }
  ])
})

test('relocate 转换章节、百分比并将范围限制在零到一', () => {
  const view = new TestFoliateView()
  const port = createFoliateViewPort(view)
  const received: ReaderEvent[] = []
  port.subscribe((event) => received.push(event))

  view.dispatchEvent(relocate({ index: 2, fraction: 0.4 }))
  view.dispatchEvent(relocate({ index: 3, fraction: 2 }))
  view.dispatchEvent(relocate({ index: 4, fraction: -1 }))

  expect(received).toEqual([
    { type: 'location-changed', location: { page: null, chapter: '2', percent: 0.4 } },
    { type: 'location-changed', location: { page: null, chapter: '3', percent: 1 } },
    { type: 'location-changed', location: { page: null, chapter: '4', percent: 0 } }
  ])
})

test('关闭与重复清理后不再通知且不会重复释放视图或订阅', () => {
  const view = new TestFoliateView()
  const port = createFoliateViewPort(view)
  const received: ReaderEvent[] = []
  const unsubscribe = port.subscribe((event) => received.push(event))

  unsubscribe()
  unsubscribe()
  port.close()
  port.close()
  view.dispatchEvent(relocate({ index: 2, fraction: 0.4 }))

  expect(received).toEqual([])
  expect(view.closeCount).toBe(1)
  expect(view.removedListeners).toBe(1)
})

test('打开失败时只发布安全失败事件并正常结束', async () => {
  const view = new TestFoliateView()
  view.open = async () => { throw new Error('C:\\private\\book.epub') }
  const port = createFoliateViewPort(view)
  const received: ReaderEvent[] = []
  port.subscribe((event) => received.push(event))

  await expect(port.open(new ArrayBuffer(0))).resolves.toBeUndefined()

  expect(received).toEqual([{
    type: 'load-failed',
    error: { code: 'document-read-failed', message: '无法打开电子书' }
  }])
})
