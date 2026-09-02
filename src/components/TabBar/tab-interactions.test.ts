import { expect, test, vi } from 'vitest'
import { closeTabOnMiddleClick } from './tab-interactions'

/** 验证中键只关闭允许关闭的文档标签，避免开始页被错误移除。 */
test('中键关闭可关闭的文档标签', () => {
  const close = vi.fn()
  const closed = closeTabOnMiddleClick(1, { id: 'tab-1', kind: 'document', title: 'guide.pdf', path: 'C:\\Books\\guide.pdf', closable: true }, close)

  expect(closed).toBe(true)
  expect(close).toHaveBeenCalledWith('tab-1')
})

/** 验证非中键与不可关闭标签不会派发关闭意图。 */
test('非中键或开始页不会触发关闭', () => {
  const close = vi.fn()

  expect(closeTabOnMiddleClick(0, { id: 'tab-1', kind: 'document', title: 'guide.pdf', path: 'C:\\Books\\guide.pdf', closable: true }, close)).toBe(false)
  expect(closeTabOnMiddleClick(1, { id: 'home', kind: 'home', title: '开始页', closable: false }, close)).toBe(false)
  expect(close).not.toHaveBeenCalled()
})
