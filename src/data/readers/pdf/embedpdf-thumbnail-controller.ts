/**
 * 管理 EmbedPDF 缩略图窗口和对象 URL 生命周期。
 * 组件不接触 PluginRegistry 或 URL.createObjectURL；控制器销毁时统一撤销已创建的 URL。
 */
import type { PdfThumbnailController, PdfThumbnailItem } from './pdf-thumbnail-controller'

/** 创建可测试的缩略图控制器骨架；真实 EmbedPDF 插件桥接将在此边界内部注入。 */
export function createEmbedPdfThumbnailController(): PdfThumbnailController {
  const listeners = new Set<() => void>()
  const urls = new Set<string>()
  let items: PdfThumbnailItem[] = []
  let totalHeight = 0
  return {
    getItems: () => items,
    getTotalHeight: () => totalHeight,
    updateWindow: () => undefined,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener) } },
    dispose() { urls.forEach((url) => URL.revokeObjectURL(url)); urls.clear(); items = []; totalHeight = 0; listeners.forEach((listener) => listener()) }
  }
}
