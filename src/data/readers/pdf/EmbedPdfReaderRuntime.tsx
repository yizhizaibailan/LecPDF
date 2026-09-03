/**
 * 在 PDF 数据层组合 EmbedPDF Viewer、插件注册表和各阅读控制器。
 * 页面只接收标准化插槽数据，不直接导入 EmbedPDF、持有 PluginRegistry 或创建内核实例。
 */
import { useMemo, useState, type ReactNode } from 'react'
import { PDFViewer, ScrollStrategy, SpreadMode, ZoomMode, type PluginRegistry } from '@embedpdf/react-pdf-viewer'
import { createEmbedPdfNavigationPort } from './embedpdf-navigation-port'
import { createEmbedPdfPagePort } from './embedpdf-page-port'
import { createEmbedPdfSearchPort } from './embedpdf-search-port'
import { EmbedPdfThumbnailPane } from './EmbedPdfThumbnailPane'
import { createPdfNavigationController, type PdfNavigationController } from './pdf-navigation-controller'
import { createPdfReaderController, type PdfReaderController } from './pdf-reader-controller'
import { createPdfSearchController, type PdfSearchController } from './pdf-search-controller'

/** 表示页面可消费的 PDF 阅读插槽数据，不暴露 EmbedPDF 类型。 */
export type PdfReaderRuntimeSlot = {
  ready: boolean
  pageController: PdfReaderController | null
  searchController: PdfSearchController | null
  navigationController: PdfNavigationController | null
  thumbnailContent: ReactNode
  renderViewer(overlay: ReactNode): ReactNode
}

/** 创建受控 EmbedPDF 运行时，并将所有内核对象限定在数据层。 */
export function EmbedPdfReaderRuntime({ url, children }: { url: string; children(slot: PdfReaderRuntimeSlot): ReactNode }): JSX.Element {
  const [registry, setRegistry] = useState<PluginRegistry | null>(null)
  const pageController = useMemo(() => registry === null ? null : createPdfReaderController(createEmbedPdfPagePort(registry)), [registry])
  const searchController = useMemo(() => registry === null ? null : createPdfSearchController(createEmbedPdfSearchPort(registry)), [registry])
  const navigationController = useMemo(() => registry === null ? null : createPdfNavigationController(createEmbedPdfNavigationPort(registry)), [registry])
  const thumbnailContent = registry === null ? <p className="reader-sidebar__empty">正在准备缩略图…</p> : <EmbedPdfThumbnailPane registry={registry} onJump={(pageNumber) => navigationController?.goToPage(pageNumber)} />
  /** 将局部浮层放入视口，使搜索框的绝对定位始终以阅读区为参照。 */
  const renderViewer = (overlay: ReactNode): ReactNode => <section className="reader-viewport" aria-label="PDF 阅读视图">{overlay}<PDFViewer config={{ src: url, zoom: { defaultZoomLevel: ZoomMode.FitPage, minZoom: 0.1, maxZoom: 4 }, scroll: { defaultStrategy: ScrollStrategy.Vertical, defaultPageGap: 16 }, spread: { defaultSpreadMode: SpreadMode.None }, thumbnails: { width: 120, gap: 8, buffer: 3, labelHeight: 16, autoScroll: true }, search: { showAllResults: true } }} style={{ height: '100%' }} onReady={setRegistry} /></section>
  return <>{children({ ready: registry !== null, pageController, searchController, navigationController, thumbnailContent, renderViewer })}</>
}
