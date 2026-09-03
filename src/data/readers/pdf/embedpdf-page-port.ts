/**
 * 将 EmbedPDF 的 ScrollPlugin 收敛为通用 PDF 页码端口。
 * 该文件是数据层中允许直接依赖 EmbedPDF 的适配器，组件与页面不得导入其插件类型。
 */
import { RotatePlugin, ScrollPlugin, ScrollStrategy, SpreadMode, SpreadPlugin, ZoomMode, ZoomPlugin, type PluginRegistry } from '@embedpdf/react-pdf-viewer'
import type { PdfPagePort, PdfPageState, PdfReaderLayout } from './pdf-reader-controller'

/** 从 EmbedPDF 注册表创建页码端口，缺少插件时返回空状态且忽略命令。 */
export function createEmbedPdfPagePort(registry: PluginRegistry): PdfPagePort {
  const scroll = () => registry.getPlugin<ScrollPlugin>(ScrollPlugin.id)?.provides() ?? null
  let state: PdfPageState = { currentPage: 1, totalPages: 0 }
  scroll()?.onPageChange(({ pageNumber, totalPages }) => { state = { currentPage: pageNumber, totalPages } })

  return {
    getPageState: () => state,
    subscribePageState(listener) {
      listener(state)
      return scroll()?.onPageChange(({ pageNumber, totalPages }) => {
        state = { currentPage: pageNumber, totalPages }
        listener(state)
      }) ?? (() => undefined)
    },
    previousPage() {
      scroll()?.scrollToPreviousPage('smooth')
    },
    nextPage() {
      scroll()?.scrollToNextPage('smooth')
    },
    setLayout(layout: PdfReaderLayout) {
      scroll()?.setScrollStrategy(layout === 'single' ? ScrollStrategy.Horizontal : ScrollStrategy.Vertical)
      registry.getPlugin<SpreadPlugin>(SpreadPlugin.id)?.provides().setSpreadMode(layout === 'double' ? SpreadMode.Odd : SpreadMode.None)
    },
    zoomOut() { registry.getPlugin<ZoomPlugin>(ZoomPlugin.id)?.provides().zoomOut() },
    zoomToFitPage() { registry.getPlugin<ZoomPlugin>(ZoomPlugin.id)?.provides().requestZoom(ZoomMode.FitPage) },
    zoomIn() { registry.getPlugin<ZoomPlugin>(ZoomPlugin.id)?.provides().zoomIn() },
    rotateBackward() { registry.getPlugin<RotatePlugin>(RotatePlugin.id)?.provides().rotateBackward() },
    rotateForward() { registry.getPlugin<RotatePlugin>(RotatePlugin.id)?.provides().rotateForward() },
    scrollToPage(pageNumber) {
      scroll()?.scrollToPage({ pageNumber, behavior: 'smooth' })
    }
  }
}
