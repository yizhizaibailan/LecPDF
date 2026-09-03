/**
 * 定义 PDF 缩略图视图与 EmbedPDF 缩略图服务之间的边界。
 * 缩略图窗口计算、图片 URL 和释放动作由数据层拥有，组件只渲染可序列化的缩略图模型。
 */
export type PdfThumbnailItem = { pageIndex: number; width: number; height: number; top: number; labelHeight: number; padding?: number; url: string | null }

/** 表示缩略图视图需要的最小数据与命令。 */
export type PdfThumbnailController = {
  getItems(): PdfThumbnailItem[]
  getTotalHeight(): number
  updateWindow(scrollTop: number, height: number): void
  subscribe(listener: () => void): () => void
  dispose(): void
}
