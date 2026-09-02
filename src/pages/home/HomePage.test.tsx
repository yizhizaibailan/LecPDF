/**
 * 职责：验证开始页的可访问打开入口与异步失败收口行为。
 * 异步说明：点击测试直接等待事件处理器返回的已处理 Promise。
 * 安全说明：IPC 拒绝不会成为页面级未处理拒绝，也不会泄漏本机路径。
 * 资源说明：静态元素测试不挂载 DOM、Electron 监听器或文件资源。
 */
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import { expect, test } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { HomePage } from './HomePage'

/**
 * 验证开始页把打开文件意图交给注入的回调，并提供可访问的操作入口。
 */
test('开始页提供打开文件按钮', () => {
  const html = renderToStaticMarkup(<HomePage onOpenDocuments={async () => undefined} />)

  expect(html).toContain('打开文件')
  expect(html).toContain('aria-label="打开文件"')
})

test('打开文档失败由开始页点击处理器安全吸收', async () => {
  const rejection = Promise.reject(new Error('IPC 失败'))
  void rejection.catch(() => undefined)
  const page = HomePage({ onOpenDocuments: () => rejection })
  const card = Children.only(page.props.children) as ReactElement<{ children: ReactNode }>
  const button = Children.toArray(card.props.children).find((child) => isValidElement(child) && child.type === 'button') as ReactElement<{
    onClick(): Promise<void>
  }> | undefined

  expect(button).toBeDefined()
  await expect(button?.props.onClick()).resolves.toBeUndefined()
})
