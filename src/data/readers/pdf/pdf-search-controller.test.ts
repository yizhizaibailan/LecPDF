import { expect, test } from 'vitest'
import { createPdfSearchController } from './pdf-search-controller'

/** 验证搜索视图通过统一命令传递关键词和大小写选项。 */
test('搜索控制器转发搜索意图', () => {
  const calls: Array<{ query: string; matchCase: boolean }> = []
  const controller = createPdfSearchController({
    search: (query, matchCase) => { calls.push({ query, matchCase }) },
    stop: () => undefined, previous: () => -1, next: () => -1,
    getState: () => ({ total: 0, activeIndex: -1, searching: false }),
    subscribe: () => () => undefined
  })

  controller.search('LecPDF', true)
  expect(calls).toEqual([{ query: 'LecPDF', matchCase: true }])
})
