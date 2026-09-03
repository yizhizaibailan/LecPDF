import { expect, test } from 'vitest'
import { createPdfReaderController } from './pdf-reader-controller'

/** 验证 PDF 控制器向视图暴露标准化页码状态与跳转动作，而不暴露 EmbedPDF 实例。 */
test('控制器将 PDF 页码变化转换为视图状态，并转发跳页意图', () => {
  const calls: number[] = []
  const controller = createPdfReaderController({
    getPageState: () => ({ currentPage: 2, totalPages: 12 }),
    scrollToPage: (pageNumber) => { calls.push(pageNumber) },
    subscribePageState: () => () => undefined,
    previousPage: () => undefined, nextPage: () => undefined, setLayout: () => undefined
  })

  expect(controller.getPageState()).toEqual({ currentPage: 2, totalPages: 12 })
  controller.goToPage(7)
  expect(calls).toEqual([7])
})

/** 验证非法页码不会穿透适配器并调用底层阅读内核。 */
test('控制器忽略小于一的页码', () => {
  const calls: number[] = []
  const controller = createPdfReaderController({
    getPageState: () => ({ currentPage: 1, totalPages: 3 }),
    scrollToPage: (pageNumber) => { calls.push(pageNumber) },
    subscribePageState: () => () => undefined,
    previousPage: () => undefined, nextPage: () => undefined, setLayout: () => undefined
  })

  controller.goToPage(0)
  expect(calls).toEqual([])
})

/** 验证工具栏可通过统一命令请求前后翻页。 */
test('控制器转发上一页和下一页意图', () => {
  const calls: string[] = []
  const controller = createPdfReaderController({
    getPageState: () => ({ currentPage: 2, totalPages: 3 }),
    scrollToPage: () => undefined,
    subscribePageState: () => () => undefined,
    previousPage: () => { calls.push('previous') },
    nextPage: () => { calls.push('next') }, setLayout: () => undefined
  })

  controller.previousPage()
  controller.nextPage()

  expect(calls).toEqual(['previous', 'next'])
})

/** 验证阅读布局以统一字符串从视图传到适配层。 */
test('控制器转发布局切换意图', () => {
  const layouts: string[] = []
  const controller = createPdfReaderController({
    getPageState: () => ({ currentPage: 1, totalPages: 3 }), scrollToPage: () => undefined,
    subscribePageState: () => () => undefined, previousPage: () => undefined, nextPage: () => undefined,
    setLayout: (layout) => { layouts.push(layout) }
  })

  controller.setLayout('double')
  expect(layouts).toEqual(['double'])
})

/** 验证视图可订阅标准化页码变化，并在卸载后停止接收更新。 */
test('控制器转发页码订阅并提供清理函数', () => {
  let listener: ((state: { currentPage: number; totalPages: number }) => void) | undefined
  let unsubscribed = false
  const controller = createPdfReaderController({
    getPageState: () => ({ currentPage: 1, totalPages: 3 }),
    scrollToPage: () => undefined,
    subscribePageState: (nextListener) => { listener = nextListener; return () => { unsubscribed = true } },
    previousPage: () => undefined, nextPage: () => undefined, setLayout: () => undefined
  })
  const received: number[] = []
  const unsubscribe = controller.subscribePageState((state) => received.push(state.currentPage))

  listener?.({ currentPage: 2, totalPages: 3 })
  unsubscribe()

  expect(received).toEqual([2])
  expect(unsubscribed).toBe(true)
})
