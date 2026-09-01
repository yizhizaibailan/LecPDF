/**
 * 将 Electron 生命周期事件转换为渲染层的文档打开意图。
 * 本模块不依赖 React、页面组件或阅读器实现，确保系统事件只经由标签 Store 进入单向数据流。
 */
import type { LecApi, Unsubscribe } from '../../electron/shared/ipc'

/**
 * 订阅系统“打开文件”请求，并将路径交给标签 Store 的打开动作。
 * 使用 void 明确生命周期监听器不等待异步加载，取消订阅仍完全由 preload 返回的函数控制。
 */
export function bindOpenFileRequests(
  subscribe: LecApi['lifecycle']['onOpenFileRequest'],
  openDocument: (path: string) => Promise<string | null>
): Unsubscribe {
  return subscribe((path) => { void openDocument(path) })
}
