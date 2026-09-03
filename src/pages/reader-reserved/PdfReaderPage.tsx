/**
 * 组合 PDF 阅读页的通用 UI 插槽。
 * EmbedPDF 运行时、插件实例和资源释放均由数据层管理；页面只保存搜索框可见性这一界面状态。
 */
import { useEffect, useState } from 'react'
import { PdfNavigationSidebar } from '../../components/Reader/PdfNavigationSidebar'
import { PdfSearchBar } from '../../components/Reader/PdfSearchBar'
import { PdfToolbar } from '../../components/Reader/PdfToolbar'
import { EmbedPdfReaderRuntime } from '../../data/readers/pdf/EmbedPdfReaderRuntime'
import type { ReaderEvent } from '../../types/reader'

/** 渲染 PDF 阅读页，并将键盘搜索意图交给本页的局部 UI 状态。 */
export function PdfReaderPage({ url, onReaderEvent }: { url: string; onReaderEvent(event: ReaderEvent): void }): JSX.Element {
  const [searchOpen, setSearchOpen] = useState(false)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => { if (event.ctrlKey && event.key.toLowerCase() === 'f') { event.preventDefault(); setSearchOpen(true) } }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
  return <EmbedPdfReaderRuntime url={url} onReaderEvent={onReaderEvent}>{({ ready, pageController, searchController, navigationController, thumbnailContent, renderViewer }) => <main className="reader-shell"><PdfToolbar ready={ready} pageController={pageController} /><div className="reader-workspace"><PdfNavigationSidebar controller={navigationController} thumbnailContent={thumbnailContent} />{renderViewer(searchOpen ? <PdfSearchBar controller={searchController} onClose={() => setSearchOpen(false)} /> : null)}</div></main>}</EmbedPdfReaderRuntime>
}
