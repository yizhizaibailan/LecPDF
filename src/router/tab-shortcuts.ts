/**
 * 绑定应用级文档标签快捷键。
 * 快捷键仅派发关闭当前标签的意图，标签可否关闭以及会话资源释放仍由 Zustand TabStore 统一处理。
 */

/** 表示关闭标签快捷键实际读取的事件字段，避免测试伪造完整浏览器事件。 */
export type TabShortcutEvent = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'preventDefault'>

/** 表示可注册和注销键盘监听器的最小窗口能力，便于在无浏览器环境中测试。 */
export type KeydownTarget = {
  addEventListener(type: 'keydown', listener: (event: TabShortcutEvent) => void): void
  removeEventListener(type: 'keydown', listener: (event: TabShortcutEvent) => void): void
}

/** 表示关闭当前标签的同步意图，避免路由层依赖具体 Store 实现。 */
export type CloseActiveTab = () => void

/**
 * 注册 Ctrl+W / Command+W 处理器，并返回卸载时必须调用的清理函数。
 * 命中快捷键后先阻止 Electron 窗口默认关闭，再让调用方关闭当前文档标签。
 */
export function bindCloseActiveTabShortcut(target: KeydownTarget, closeActiveTab: CloseActiveTab): () => void {
  const onKeyDown = (event: TabShortcutEvent) => {
    if (event.key.toLowerCase() !== 'w' || (!event.ctrlKey && !event.metaKey)) return

    event.preventDefault()
    closeActiveTab()
  }

  target.addEventListener('keydown', onKeyDown)
  return () => target.removeEventListener('keydown', onKeyDown)
}
