/**
 * 定义 PDF 视图与 EmbedPDF 内核之间的最小控制器边界。
 * 视图只读取标准化页码并派发跳转意图；EmbedPDF 插件实例由后续适配层在此接口下方持有。
 */

/** 表示 PDF 阅读视图可显示的页码状态，不携带内核实例或文件资源。 */
export type PdfPageState = {
  currentPage: number
  totalPages: number
}
export type PdfReaderLayout = 'single' | 'continuous' | 'double'

/** 表示适配层注入的底层页码查询与跳转能力。 */
export type PdfPagePort = {
  getPageState(): PdfPageState
  scrollToPage(pageNumber: number): void
  previousPage(): void
  nextPage(): void
  setLayout(layout: PdfReaderLayout): void
  zoomOut?(): void
  zoomToFitPage?(): void
  zoomIn?(): void
  rotateBackward?(): void
  rotateForward?(): void
  subscribePageState(listener: (state: PdfPageState) => void): () => void
}

/** 表示 PDF 视图可调用的受控命令，避免组件直接依赖 EmbedPDF PluginRegistry。 */
export type PdfReaderController = {
  getPageState(): PdfPageState
  goToPage(pageNumber: number): void
  previousPage(): void
  nextPage(): void
  setLayout(layout: PdfReaderLayout): void
  zoomOut(): void
  zoomToFitPage(): void
  zoomIn(): void
  rotateBackward(): void
  rotateForward(): void
  subscribePageState(listener: (state: PdfPageState) => void): () => void
}

/**
 * 创建 PDF 阅读控制器。
 * 页码校验在边界处完成，确保 UI 的无效输入不会进入底层阅读内核。
 */
export function createPdfReaderController(port: PdfPagePort): PdfReaderController {
  return {
    getPageState: () => port.getPageState(),
    subscribePageState: (listener) => port.subscribePageState(listener),
    previousPage: () => port.previousPage(),
    nextPage: () => port.nextPage(),
    setLayout: (layout) => port.setLayout(layout),
    zoomOut: () => port.zoomOut?.(), zoomToFitPage: () => port.zoomToFitPage?.(), zoomIn: () => port.zoomIn?.(),
    rotateBackward: () => port.rotateBackward?.(), rotateForward: () => port.rotateForward?.(),
    goToPage(pageNumber) {
      if (!Number.isInteger(pageNumber) || pageNumber < 1) return
      port.scrollToPage(pageNumber)
    }
  }
}
