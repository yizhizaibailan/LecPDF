import { expect, test, vi } from 'vitest'
import { bindCloseActiveTabShortcut, type TabShortcutEvent } from './tab-shortcuts'

/** 创建可观察键盘监听绑定和解绑过程的最小窗口替身。 */
function createKeyboardTarget() {
  let listener: ((event: TabShortcutEvent) => void) | undefined
  const target = {
    addEventListener: vi.fn((type: string, nextListener: (event: TabShortcutEvent) => void) => {
      if (type === 'keydown') listener = nextListener
    }),
    removeEventListener: vi.fn()
  }
  return { target, getListener: () => listener }
}

/** 验证 Ctrl+W 会阻止窗口默认行为并关闭当前标签。 */
test('Ctrl+W 关闭当前标签并阻止默认窗口行为', () => {
  const closeActiveTab = vi.fn()
  const { target, getListener } = createKeyboardTarget()
  bindCloseActiveTabShortcut(target, closeActiveTab)
  const preventDefault = vi.fn()

  getListener()?.({ key: 'w', ctrlKey: true, metaKey: false, preventDefault })

  expect(closeActiveTab).toHaveBeenCalledTimes(1)
  expect(preventDefault).toHaveBeenCalledTimes(1)
})

/** 验证 macOS 的 Command+W 与 Windows 的 Ctrl+W 复用相同的标签关闭语义。 */
test('Command+W 关闭当前标签并阻止默认窗口行为', () => {
  const closeActiveTab = vi.fn()
  const { target, getListener } = createKeyboardTarget()
  bindCloseActiveTabShortcut(target, closeActiveTab)
  const preventDefault = vi.fn()

  getListener()?.({ key: 'w', ctrlKey: false, metaKey: true, preventDefault })

  expect(closeActiveTab).toHaveBeenCalledTimes(1)
  expect(preventDefault).toHaveBeenCalledTimes(1)
})

/** 验证其他组合键不干扰应用和操作系统既有快捷键。 */
test('非关闭快捷键不触发关闭', () => {
  const closeActiveTab = vi.fn()
  const { target, getListener } = createKeyboardTarget()
  bindCloseActiveTabShortcut(target, closeActiveTab)
  const preventDefault = vi.fn()

  getListener()?.({ key: 'w', ctrlKey: false, metaKey: false, preventDefault })

  expect(closeActiveTab).not.toHaveBeenCalled()
  expect(preventDefault).not.toHaveBeenCalled()
})
