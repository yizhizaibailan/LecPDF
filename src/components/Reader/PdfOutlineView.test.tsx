/**
 * 验证目录树根据阅读进度选择最后一个已经到达的条目。
 * 此行为与阅读器重构前保持一致，避免嵌套目录只按精确页码高亮而失去章节提示。
 */
import { expect, test } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PdfOutlineView } from './PdfOutlineView'

/** 当页面位于下一章前时，目录应高亮最近的可跳转条目。 */
test('目录高亮当前页之前最近的嵌套章节', () => {
  const html = renderToStaticMarkup(<PdfOutlineView items={[
    { title: '第一章', pageNumber: 1, children: [{ title: '第一节', pageNumber: 3, children: [] }] },
    { title: '第二章', pageNumber: 8, children: [] }
  ]} currentPage={6} onJump={() => undefined} />)

  expect(html).toContain('第一节</button>')
  expect(html).toContain('class="reader-outline__item reader-outline__item--active"')
  expect(html).toContain('aria-current="page"')
})
