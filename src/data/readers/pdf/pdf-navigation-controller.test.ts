import { expect, test } from 'vitest'
import { createPdfNavigationController } from './pdf-navigation-controller'

/** 验证导航视图从控制器读取目录并只派发标准化页码跳转。 */
test('导航控制器提供目录和页码跳转', () => {
  const calls: number[] = []
  const controller = createPdfNavigationController({
    getOutline: () => [{ title: '第一章', pageNumber: 1, children: [] }],
    getCurrentPage: () => 1,
    goToPage: (pageNumber) => { calls.push(pageNumber) },
    subscribe: () => () => undefined
  })

  expect(controller.getOutline()).toEqual([{ title: '第一章', pageNumber: 1, children: [] }])
  controller.goToPage(3)
  expect(calls).toEqual([3])
})
