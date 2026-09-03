/**
 * 定义 PDF 搜索视图与 EmbedPDF 搜索服务之间的受控边界。
 * 输入组件只派发关键词和选项；具体插件、结果订阅与资源清理由 PDF 数据层负责。
 */
export type PdfSearchPort = {
  search(query: string, matchCase: boolean): void
  stop(): void
  previous(): number
  next(): number
  getState(): PdfSearchState
  subscribe(listener: (state: PdfSearchState) => void): () => void
}

/** 表示搜索栏可展示的结果状态，不携带 EmbedPDF 返回对象。 */
export type PdfSearchState = { total: number; activeIndex: number; searching: boolean }

/** 表示搜索栏可使用的稳定命令，不泄露 EmbedPDF 搜索类型。 */
export type PdfSearchController = PdfSearchPort

/** 创建 PDF 搜索控制器，并在空关键词时统一停止底层搜索。 */
export function createPdfSearchController(port: PdfSearchPort): PdfSearchController {
  return {
    search(query, matchCase) {
      if (query.trim().length === 0) { port.stop(); return }
      port.search(query, matchCase)
    },
    stop: () => port.stop(),
    previous: () => port.previous(),
    next: () => port.next(),
    getState: () => port.getState(),
    subscribe: (listener) => port.subscribe(listener)
  }
}
