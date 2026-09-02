/**
 * 职责：在页面局部组合受控 EmbedPDF 视图及其阅读控件；导出 PdfReaderPage。
 * 资源说明：registry 与 Ctrl+F 监听仅服务当前页面，effect 清理可避免关闭标签后遗留监听。
 */
import { useEffect, useState } from 'react'
import { PDFViewer, ScrollStrategy, SpreadMode, ZoomMode, type PluginRegistry } from '@embedpdf/react-pdf-viewer'
import { PdfNavigationSidebar } from '../../components/Reader/PdfNavigationSidebar'
import { PdfSearchBar } from '../../components/Reader/PdfSearchBar'
import { PdfToolbar } from '../../components/Reader/PdfToolbar'

export function PdfReaderPage({ url }: { url: string }): JSX.Element {
  const [registry, setRegistry] = useState<PluginRegistry | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.ctrlKey && event.key.toLowerCase() === 'f') { event.preventDefault(); setSearchOpen(true) }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return <main className="reader-shell"><PdfToolbar registry={registry} /><div className="reader-workspace"><PdfNavigationSidebar registry={registry} /><section className="reader-viewport" aria-label="PDF 阅读视图">{searchOpen && <PdfSearchBar registry={registry} onClose={() => setSearchOpen(false)} />}<PDFViewer config={{ src: url, zoom: { defaultZoomLevel: ZoomMode.FitPage, minZoom: 0.1, maxZoom: 4 }, scroll: { defaultStrategy: ScrollStrategy.Vertical, defaultPageGap: 16 }, spread: { defaultSpreadMode: SpreadMode.None }, thumbnails: { width: 120, gap: 8, buffer: 3, labelHeight: 16, autoScroll: true }, search: { showAllResults: true } }} style={{ height: '100%' }} onReady={setRegistry} /></section></div></main>
}
