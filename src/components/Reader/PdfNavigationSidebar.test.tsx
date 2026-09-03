import { expect, test } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PdfNavigationSidebar } from './PdfNavigationSidebar'

/** 验证导航侧栏只消费标准化控制器，而不需要 EmbedPDF Registry。 */
test('导航侧栏由控制器提供目录和跳转意图', () => {
  const html = renderToStaticMarkup(
    <PdfNavigationSidebar controller={{ getOutline: () => [{ title: '第一章', pageNumber: 1, children: [] }], getCurrentPage: () => 1, goToPage: () => undefined, subscribe: () => () => undefined }} thumbnailContent={null} />
  )
  expect(html).toContain('第一章')
  expect(html).toContain('PDF 导航侧栏')
})
