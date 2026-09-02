/**
 * 处理标签栏的鼠标辅助键交互。
 * 本模块只将中键手势转换为关闭意图，不保存标签状态，以保持组件与 Zustand Store 的单向数据流边界。
 */
import type { ReaderTab } from '../../types/document'

/** 表示标签关闭回调，调用方通常直接传入 TabStore 的关闭动作。 */
export type CloseTab = (tabId: string) => void

/**
 * 在用户中键点击可关闭标签时派发关闭意图。
 * 返回值使视图层能够仅在真正处理了该手势时阻止浏览器的默认中键行为。
 */
export function closeTabOnMiddleClick(button: number, tab: ReaderTab, closeTab: CloseTab): boolean {
  if (button !== 1 || !tab.closable) return false

  closeTab(tab.id)
  return true
}
