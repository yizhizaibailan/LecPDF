/**
 * 定义 PDF 导航视图与具体阅读内核之间的边界。
 * 目录树和页码均为可渲染数据，缩略图、插件实例与对象 URL 留在 EmbedPDF 适配层管理。
 */
export type PdfOutlineItem = { title: string; pageNumber: number | null; children: PdfOutlineItem[] }

/** 表示数据层为导航视图提供的目录、当前页和跳转能力。 */
export type PdfNavigationPort = {
  getOutline(): PdfOutlineItem[]
  getCurrentPage(): number
  goToPage(pageNumber: number): void
  subscribe(listener: () => void): () => void
}

/** 表示导航组件可消费的标准化控制器，不暴露 EmbedPDF 类型。 */
export type PdfNavigationController = PdfNavigationPort

/** 创建导航控制器，并在边界阻止非法页码进入阅读内核。 */
export function createPdfNavigationController(port: PdfNavigationPort): PdfNavigationController {
  return {
    getOutline: () => port.getOutline(),
    getCurrentPage: () => port.getCurrentPage(),
    subscribe: (listener) => port.subscribe(listener),
    goToPage(pageNumber) {
      if (!Number.isInteger(pageNumber) || pageNumber < 1) return
      port.goToPage(pageNumber)
    }
  }
}
