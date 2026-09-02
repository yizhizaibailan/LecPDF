/**
 * 职责：提供 PDF 的版式、翻页、缩放与旋转控制；导出 PdfToolbar。
 * 订阅说明：页码订阅在 effect 清理，避免替换 registry 后仍更新已卸载的工具栏。
 */
import { useEffect, useState } from 'react'
import {
  RotatePlugin, ScrollPlugin, ScrollStrategy, SpreadMode, SpreadPlugin, ZoomMode, ZoomPlugin,
  type PluginRegistry
} from '@embedpdf/react-pdf-viewer'

type ReaderLayout = 'single' | 'continuous' | 'double'

export function PdfToolbar({ registry }: { registry: PluginRegistry | null }): JSX.Element {
  const [layout, setLayout] = useState<ReaderLayout>('continuous')
  const [pageNumber, setPageNumber] = useState('1')
  const [totalPages, setTotalPages] = useState<number | null>(null)
  const scroll = () => registry?.getPlugin<ScrollPlugin>(ScrollPlugin.id)?.provides() ?? null
  const spread = () => registry?.getPlugin<SpreadPlugin>(SpreadPlugin.id)?.provides() ?? null
  const zoom = () => registry?.getPlugin<ZoomPlugin>(ZoomPlugin.id)?.provides() ?? null
  const rotation = () => registry?.getPlugin<RotatePlugin>(RotatePlugin.id)?.provides() ?? null

  useEffect(() => {
    const service = scroll()
    return service?.onPageChange(({ pageNumber: current, totalPages: pages }) => {
      setPageNumber(String(current))
      setTotalPages(pages)
    })
  }, [registry])

  const applyLayout = (next: ReaderLayout): void => {
    const scrollService = scroll()
    const spreadService = spread()
    if (scrollService === null || spreadService === null) return
    setLayout(next)
    scrollService.setScrollStrategy(next === 'single' ? ScrollStrategy.Horizontal : ScrollStrategy.Vertical)
    spreadService.setSpreadMode(next === 'double' ? SpreadMode.Odd : SpreadMode.None)
  }
  const jumpToPage = (): void => {
    const requested = Number(pageNumber)
    if (!Number.isInteger(requested) || requested < 1) return
    scroll()?.scrollToPage({ pageNumber: totalPages === null ? requested : Math.min(requested, totalPages), behavior: 'smooth' })
  }
  const disabled = registry === null

  return (
    <nav className="reader-toolbar" aria-label="PDF 阅读控制">
      <div className="reader-toolbar__group" aria-label="页面布局">
        <button type="button" aria-label="单页阅读" aria-pressed={layout === 'single'} disabled={disabled} onClick={() => applyLayout('single')}>单页</button>
        <button type="button" aria-label="连续阅读" aria-pressed={layout === 'continuous'} disabled={disabled} onClick={() => applyLayout('continuous')}>连续</button>
        <button type="button" aria-label="双页阅读" aria-pressed={layout === 'double'} disabled={disabled} onClick={() => applyLayout('double')}>双页</button>
      </div>
      <div className="reader-toolbar__group" aria-label="翻页">
        <button type="button" aria-label="上一页" disabled={disabled} onClick={() => scroll()?.scrollToPreviousPage('smooth')}>上一页</button>
        <input aria-label="跳转到页码" inputMode="numeric" min="1" type="number" value={pageNumber} disabled={disabled} onChange={(event) => setPageNumber(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') jumpToPage() }} />
        <span className="reader-toolbar__page-total">/ {totalPages ?? '—'}</span>
        <button type="button" aria-label="跳转到输入页码" disabled={disabled} onClick={jumpToPage}>跳转</button>
        <button type="button" aria-label="下一页" disabled={disabled} onClick={() => scroll()?.scrollToNextPage('smooth')}>下一页</button>
      </div>
      <div className="reader-toolbar__group" aria-label="缩放">
        <button type="button" aria-label="缩小 PDF" disabled={disabled} onClick={() => zoom()?.zoomOut()}>缩小</button>
        <button type="button" aria-label="适合页面" disabled={disabled} onClick={() => zoom()?.requestZoom(ZoomMode.FitPage)}>适合页面</button>
        <button type="button" aria-label="放大 PDF" disabled={disabled} onClick={() => zoom()?.zoomIn()}>放大</button>
      </div>
      <div className="reader-toolbar__group" aria-label="旋转">
        <button type="button" aria-label="逆时针旋转 90 度" disabled={disabled} onClick={() => rotation()?.rotateBackward()}>向左旋转</button>
        <button type="button" aria-label="顺时针旋转 90 度" disabled={disabled} onClick={() => rotation()?.rotateForward()}>向右旋转</button>
      </div>
    </nav>
  )
}
