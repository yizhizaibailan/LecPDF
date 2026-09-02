import { expect, test } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DocumentTabs } from './DocumentTabs'

/**
 * 验证开始页标签保持常驻，而文档标签为用户提供明确的关闭入口。
 */
test('开始页不可关闭，文档标签可关闭', () => {
  const html = renderToStaticMarkup(
    <DocumentTabs
      tabs={[
        { id: 'home', kind: 'home', title: '开始页', closable: false },
        { id: 'tab-1', kind: 'document', title: 'guide.pdf', path: 'C:\\Books\\guide.pdf', closable: true }
      ]}
      activeTabId="home"
      onActivate={() => undefined}
      onClose={() => undefined}
    />
  )

  expect(html).toContain('开始页')
  expect(html).toContain('aria-label="关闭 guide.pdf"')
  expect(html).not.toContain('aria-label="关闭 开始页"')
})
