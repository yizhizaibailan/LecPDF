/**
 * 把文件选择器结果转换为统一的标签打开意图。
 * 此桥接层不依赖 React，使开始页与其他入口能复用同一顺序打开语义。
 */
import type { LecApi } from '../../electron/shared/ipc'

/**
 * 导出选择器桥接函数，按用户选择的顺序等待每个文档完成打开。
 * 顺序 await 防止异步加载完成次序改变标签 Store 的预期激活次序；取消选择时自然不执行打开动作。
 */
export async function openDocumentsFromDialog(
  selectPaths: LecApi['dialogs']['openDocuments'],
  openDocument: (path: string) => Promise<string | null>
): Promise<void> {
  for (const path of await selectPaths()) await openDocument(path)
}
