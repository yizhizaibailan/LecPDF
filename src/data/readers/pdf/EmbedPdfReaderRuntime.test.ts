/**
 * 职责：验证 PDF 数据层把受控控制器状态转换为可序列化的统一阅读事件。
 * 资源说明：测试使用内存控制器，明确检查订阅缺失与清理，避免依赖 EmbedPDF 内核。
 */
import { expect, test } from 'vitest'
import type { ReaderEvent } from '../../../types/reader'
import type { PdfNavigationController, PdfOutlineItem } from './pdf-navigation-controller'
import type { PdfReaderController } from './pdf-reader-controller'
import { subscribePdfReaderEvents, toReaderOutline } from './EmbedPdfReaderRuntime'

test('PDF 目录转换保留嵌套结构、稳定路径和空页码', () => {
  const outline = toReaderOutline([{
    title: '第一章',
    pageNumber: null,
    children: [
      { title: '第一节', pageNumber: 2, children: [] },
      { title: '第二节', pageNumber: null, children: [] }
    ]
  }])

  expect(outline).toEqual([{
    id: 'pdf-outline-0',
    title: '第一章',
    location: { page: null, chapter: null, percent: 0 },
    children: [
      { id: 'pdf-outline-0.0', title: '第一节', location: { page: 2, chapter: null, percent: 0 }, children: [] },
      { id: 'pdf-outline-0.1', title: '第二节', location: { page: null, chapter: null, percent: 0 }, children: [] }
    ]
  }])
})

test('PDF 控制器事件回写统一会话并在清理时退订', () => {
  let pageListener: ((state: { currentPage: number; totalPages: number }) => void) | undefined
  let navigationListener: (() => void) | undefined
  let pageUnsubscribed = false
  let navigationUnsubscribed = false
  const pageController: PdfReaderController = {
    getPageState: () => ({ currentPage: 1, totalPages: 0 }),
    goToPage: () => undefined,
    previousPage: () => undefined,
    nextPage: () => undefined,
    setLayout: () => undefined,
    zoomOut: () => undefined,
    zoomToFitPage: () => undefined,
    zoomIn: () => undefined,
    rotateBackward: () => undefined,
    rotateForward: () => undefined,
    subscribePageState: (listener) => { pageListener = listener; return () => { pageUnsubscribed = true } }
  }
  const sourceOutline: PdfOutlineItem[] = [{ title: '目录', pageNumber: null, children: [] }]
  const navigationController: PdfNavigationController = {
    getOutline: () => sourceOutline,
    getCurrentPage: () => 1,
    goToPage: () => undefined,
    subscribe: (listener) => { navigationListener = listener; return () => { navigationUnsubscribed = true } }
  }
  const received: ReaderEvent[] = []

  const unsubscribe = subscribePdfReaderEvents({ pageController, navigationController, onReaderEvent: (event) => received.push(event) })
  pageListener?.({ currentPage: 1, totalPages: 0 })
  pageListener?.({ currentPage: 3, totalPages: 10 })
  navigationListener?.()
  unsubscribe?.()

  expect(received).toEqual([
    { type: 'ready' },
    { type: 'outline-changed', outline: [{ id: 'pdf-outline-0', title: '目录', location: { page: null, chapter: null, percent: 0 }, children: [] }] },
    { type: 'location-changed', location: { page: 1, chapter: null, percent: 0 } },
    { type: 'location-changed', location: { page: 3, chapter: null, percent: 0.3 } },
    { type: 'outline-changed', outline: [{ id: 'pdf-outline-0', title: '目录', location: { page: null, chapter: null, percent: 0 }, children: [] }] }
  ])
  expect(pageUnsubscribed).toBe(true)
  expect(navigationUnsubscribed).toBe(true)
})

test('目录订阅不主动通知时仍立即发布已有目录快照', () => {
  const pageController: PdfReaderController = {
    getPageState: () => ({ currentPage: 1, totalPages: 1 }),
    goToPage: () => undefined,
    previousPage: () => undefined,
    nextPage: () => undefined,
    setLayout: () => undefined,
    zoomOut: () => undefined,
    zoomToFitPage: () => undefined,
    zoomIn: () => undefined,
    rotateBackward: () => undefined,
    rotateForward: () => undefined,
    subscribePageState: () => () => undefined
  }
  const navigationController: PdfNavigationController = {
    getOutline: () => [{ title: '已加载目录', pageNumber: 4, children: [] }],
    getCurrentPage: () => 1,
    goToPage: () => undefined,
    subscribe: () => () => undefined
  }
  const received: ReaderEvent[] = []

  const unsubscribe = subscribePdfReaderEvents({ pageController, navigationController, onReaderEvent: (event) => received.push(event) })
  unsubscribe?.()

  expect(received).toEqual([
    { type: 'ready' },
    { type: 'outline-changed', outline: [{ id: 'pdf-outline-0', title: '已加载目录', location: { page: 4, chapter: null, percent: 0 }, children: [] }] }
  ])
})

test('回调缺失时不创建 PDF 控制器订阅', () => {
  let pageSubscribed = false
  let navigationSubscribed = false
  const pageController: PdfReaderController = {
    getPageState: () => ({ currentPage: 1, totalPages: 0 }),
    goToPage: () => undefined,
    previousPage: () => undefined,
    nextPage: () => undefined,
    setLayout: () => undefined,
    zoomOut: () => undefined,
    zoomToFitPage: () => undefined,
    zoomIn: () => undefined,
    rotateBackward: () => undefined,
    rotateForward: () => undefined,
    subscribePageState: () => { pageSubscribed = true; return () => undefined }
  }
  const navigationController: PdfNavigationController = {
    getOutline: () => [],
    getCurrentPage: () => 1,
    goToPage: () => undefined,
    subscribe: () => { navigationSubscribed = true; return () => undefined }
  }

  const unsubscribe = subscribePdfReaderEvents({ pageController, navigationController })

  expect(unsubscribe).toBeUndefined()
  expect(pageSubscribed).toBe(false)
  expect(navigationSubscribed).toBe(false)
})
