/**
 * 在 PDF 数据层组合 EmbedPDF Viewer、插件注册表和各阅读控制器。
 * 页面只接收标准化插槽数据，不直接导入 EmbedPDF、持有 PluginRegistry 或创建内核实例。
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { PDFViewer, ScrollStrategy, SpreadMode, ZoomMode, type PluginRegistry } from '@embedpdf/react-pdf-viewer'
import type { ReaderEvent, ReaderOutlineItem } from '../../../types/reader'
import { createEmbedPdfNavigationPort } from './embedpdf-navigation-port'
import { createEmbedPdfPagePort } from './embedpdf-page-port'
import { createEmbedPdfSearchPort } from './embedpdf-search-port'
import { EmbedPdfThumbnailPane } from './EmbedPdfThumbnailPane'
import { createPdfNavigationController, type PdfNavigationController, type PdfOutlineItem } from './pdf-navigation-controller'
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

/** 将 PDF 目录转换为 Store 可序列化的统一目录，路径 id 不依赖 EmbedPDF 内部对象身份。 */
export function toReaderOutline(items: PdfOutlineItem[], path: number[] = []): ReaderOutlineItem[] {
  return items.map((item, index) => {
    const itemPath = [...path, index]
    return {
      id: `pdf-outline-${itemPath.join('.')}`,
      title: item.title,
      location: { page: item.pageNumber, chapter: null, percent: 0 },
      children: toReaderOutline(item.children, itemPath)
    }
  })
}

/**
 * 订阅 PDF 受控控制器并发布统一事件；回调缺失时完全不创建订阅。
 * 资源说明：返回的函数会同时释放页码与目录订阅，由运行时 effect 在卸载或依赖变化时调用。
 */
export function subscribePdfReaderEvents({
  pageController,
  navigationController,
  onReaderEvent
}: {
  pageController: PdfReaderController | null
  navigationController: PdfNavigationController | null
  onReaderEvent?: (event: ReaderEvent) => void
}): (() => void) | undefined {
  if (onReaderEvent === undefined || pageController === null || navigationController === null) return undefined
  onReaderEvent({ type: 'ready' })
  const publishOutline = (): void => {
    onReaderEvent({ type: 'outline-changed', outline: toReaderOutline(navigationController.getOutline()) })
  }
  const unsubscribeNavigation = navigationController.subscribe(publishOutline)
  /** 订阅后立即读取快照，避免目录异步加载早于 effect 时丢失首次更新。 */
  publishOutline()
  const unsubscribePage = pageController.subscribePageState(({ currentPage, totalPages }) => {
    onReaderEvent({ type: 'location-changed', location: { page: currentPage, chapter: null, percent: totalPages === 0 ? 0 : currentPage / totalPages } })
  })
  return () => { unsubscribePage(); unsubscribeNavigation() }
}

/** 创建受控 EmbedPDF 运行时，并将所有内核对象限定在数据层。 */
export function EmbedPdfReaderRuntime({ url, children, onReaderEvent }: { url: string; children(slot: PdfReaderRuntimeSlot): ReactNode; onReaderEvent?: (event: ReaderEvent) => void }): JSX.Element {
  const [registry, setRegistry] = useState<PluginRegistry | null>(null)
  const pageController = useMemo(() => registry === null ? null : createPdfReaderController(createEmbedPdfPagePort(registry)), [registry])
  const searchController = useMemo(() => registry === null ? null : createPdfSearchController(createEmbedPdfSearchPort(registry)), [registry])
  const navigationController = useMemo(() => registry === null ? null : createPdfNavigationController(createEmbedPdfNavigationPort(registry)), [registry])
  /** 注册表就绪后回写可序列化事件；effect 清理旧控制器订阅，避免切换文档后继续写入。 */
  useEffect(
    () => subscribePdfReaderEvents({ pageController, navigationController, onReaderEvent }),
    [navigationController, onReaderEvent, pageController]
  )
  const thumbnailContent = registry === null ? <p className="reader-sidebar__empty">正在准备缩略图…</p> : <EmbedPdfThumbnailPane registry={registry} onJump={(pageNumber) => navigationController?.goToPage(pageNumber)} />
  /** 将局部浮层放入视口，使搜索框的绝对定位始终以阅读区为参照。 */
  const renderViewer = (overlay: ReactNode): ReactNode => <section className="reader-viewport" aria-label="PDF 阅读视图">{overlay}<PDFViewer config={{ src: url, zoom: { defaultZoomLevel: ZoomMode.FitPage, minZoom: 0.1, maxZoom: 4 }, scroll: { defaultStrategy: ScrollStrategy.Vertical, defaultPageGap: 16 }, spread: { defaultSpreadMode: SpreadMode.None }, thumbnails: { width: 120, gap: 8, buffer: 3, labelHeight: 16, autoScroll: true }, search: { showAllResults: true } }} style={{ height: '100%' }} onReady={setRegistry} /></section>
  return <>{children({ ready: registry !== null, pageController, searchController, navigationController, thumbnailContent, renderViewer })}</>
}
