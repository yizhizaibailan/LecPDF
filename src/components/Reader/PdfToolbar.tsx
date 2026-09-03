/**
 * 职责：提供 PDF 的版式、翻页、缩放与旋转控制；导出 PdfToolbar。
 * 订阅说明：页码订阅在 effect 清理，避免替换 registry 后仍更新已卸载的工具栏。
 */
import { useEffect, useState } from 'react'
import type { PdfReaderController } from '../../data/readers/pdf/pdf-reader-controller'

type ReaderLayout = 'single' | 'continuous' | 'double'

export function PdfToolbar({ ready, pageController }: { ready: boolean; pageController: PdfReaderController | null }): JSX.Element {
  const [layout, setLayout] = useState<ReaderLayout>('continuous')
  const [pageNumber, setPageNumber] = useState('1')
  const [totalPages, setTotalPages] = useState<number | null>(null)
  useEffect(() => {
    if (pageController === null) return
    const update = (state: { currentPage: number; totalPages: number }): void => {
      setPageNumber(String(state.currentPage))
      setTotalPages(state.totalPages)
    }
    update(pageController.getPageState())
    return pageController.subscribePageState(update)
  }, [pageController])

  const applyLayout = (next: ReaderLayout): void => {
    if (pageController === null) return
    setLayout(next)
    pageController.setLayout(next)
  }
  const jumpToPage = (): void => {
    const requested = Number(pageNumber)
    if (!Number.isInteger(requested) || requested < 1) return
    pageController?.goToPage(totalPages === null ? requested : Math.min(requested, totalPages))
  }
  const disabled = !ready

  return (
    <nav className="reader-toolbar" aria-label="PDF 阅读控制">
      <div className="reader-toolbar__group" aria-label="页面布局">
        <button type="button" aria-label="单页阅读" aria-pressed={layout === 'single'} disabled={disabled} onClick={() => applyLayout('single')}>单页</button>
        <button type="button" aria-label="连续阅读" aria-pressed={layout === 'continuous'} disabled={disabled} onClick={() => applyLayout('continuous')}>连续</button>
        <button type="button" aria-label="双页阅读" aria-pressed={layout === 'double'} disabled={disabled} onClick={() => applyLayout('double')}>双页</button>
      </div>
      <div className="reader-toolbar__group" aria-label="翻页">
        <button type="button" aria-label="上一页" disabled={disabled} onClick={() => pageController?.previousPage()}>上一页</button>
        <input aria-label="跳转到页码" inputMode="numeric" min="1" type="number" value={pageNumber} disabled={disabled} onChange={(event) => setPageNumber(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') jumpToPage() }} />
        <span className="reader-toolbar__page-total">/ {totalPages ?? '—'}</span>
        <button type="button" aria-label="跳转到输入页码" disabled={disabled} onClick={jumpToPage}>跳转</button>
        <button type="button" aria-label="下一页" disabled={disabled} onClick={() => pageController?.nextPage()}>下一页</button>
      </div>
      <div className="reader-toolbar__group" aria-label="缩放">
        <button type="button" aria-label="缩小 PDF" disabled={disabled} onClick={() => pageController?.zoomOut()}>缩小</button>
        <button type="button" aria-label="适合页面" disabled={disabled} onClick={() => pageController?.zoomToFitPage()}>适合页面</button>
        <button type="button" aria-label="放大 PDF" disabled={disabled} onClick={() => pageController?.zoomIn()}>放大</button>
      </div>
      <div className="reader-toolbar__group" aria-label="旋转">
        <button type="button" aria-label="逆时针旋转 90 度" disabled={disabled} onClick={() => pageController?.rotateBackward()}>向左旋转</button>
        <button type="button" aria-label="顺时针旋转 90 度" disabled={disabled} onClick={() => pageController?.rotateForward()}>向右旋转</button>
      </div>
    </nav>
  )
}
