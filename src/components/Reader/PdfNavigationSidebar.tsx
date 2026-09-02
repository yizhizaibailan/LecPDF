/**
 * 职责：提供 PDF 目录高亮与按需缩略图导航；导出 PdfNavigationSidebar。
 * 资源说明：EmbedPDF 订阅、滚动监听、观察器及缩略图对象 URL 均在 effect 清理，防止页面切换泄漏。
 */
import { useEffect, useRef, useState } from 'react'
import { BookmarkPlugin, ScrollPlugin, ThumbnailPlugin, type PluginRegistry } from '@embedpdf/react-pdf-viewer'

type SidebarTab = 'thumbnails' | 'outline'
type OutlineItem = { title: string; target?: { type: 'destination' | 'action'; destination?: { pageIndex: number }; action?: { destination?: { pageIndex: number } } }; children?: OutlineItem[] }
type ThumbnailItem = { pageIndex: number; width: number; height: number; top: number; labelHeight: number; padding?: number }

function outlinePageNumber(item: OutlineItem): number | null {
  const pageIndex = item.target?.type === 'destination' ? item.target.destination?.pageIndex : item.target?.action?.destination?.pageIndex
  return pageIndex === undefined ? null : pageIndex + 1
}
function findActivePath(items: OutlineItem[], currentPage: number, parentPath = ''): string | null {
  let activePath: string | null = null
  for (const [index, item] of items.entries()) {
    const path = `${parentPath}${index}`
    const pageNumber = outlinePageNumber(item)
    if (pageNumber !== null && pageNumber <= currentPage) activePath = path
    if (item.children !== undefined) activePath = findActivePath(item.children, currentPage, `${path}.`) ?? activePath
  }
  return activePath
}
function OutlineTree({ items, depth, activePath, parentPath, onJump }: { items: OutlineItem[]; depth: number; activePath: string | null; parentPath: string; onJump(pageNumber: number): void }): JSX.Element {
  return <ul className="reader-outline__list">{items.map((item, index) => {
    const pageNumber = outlinePageNumber(item)
    const path = `${parentPath}${index}`
    return <li key={path}><button type="button" className={`reader-outline__item${activePath === path ? ' reader-outline__item--active' : ''}`} style={{ paddingLeft: `${12 + depth * 16}px` }} disabled={pageNumber === null} onClick={() => { if (pageNumber !== null) onJump(pageNumber) }}>{item.title}</button>{item.children !== undefined && item.children.length > 0 && <OutlineTree items={item.children} depth={depth + 1} activePath={activePath} parentPath={`${path}.`} onJump={onJump} />}</li>
  })}</ul>
}
function ThumbnailPreview({ item, registry, onJump }: { item: ThumbnailItem; registry: PluginRegistry; onJump(pageNumber: number): void }): JSX.Element {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let disposed = false
    let objectUrl: string | null = null
    const service = registry.getPlugin<ThumbnailPlugin>(ThumbnailPlugin.id)?.provides()
    if (service === undefined) return
    void service.renderThumb(item.pageIndex, window.devicePixelRatio || 1).toPromise().then((blob) => {
      const nextObjectUrl = URL.createObjectURL(blob)
      if (disposed) { URL.revokeObjectURL(nextObjectUrl); return }
      objectUrl = nextObjectUrl; setUrl(objectUrl)
    }).catch(() => { if (!disposed) setUrl(null) })
    return () => { disposed = true; if (objectUrl !== null) URL.revokeObjectURL(objectUrl) }
  }, [item.pageIndex, registry])
  return <button type="button" className="reader-thumbnail" style={{ height: `${item.height + item.labelHeight + (item.padding ?? 0) * 2}px`, top: `${item.top}px` }} onClick={() => onJump(item.pageIndex + 1)}>{url === null ? <span className="reader-thumbnail__placeholder">加载中…</span> : <img src={url} alt={`第 ${item.pageIndex + 1} 页缩略图`} />}<span>{item.pageIndex + 1}</span></button>
}
function ThumbnailPane({ registry, onJump }: { registry: PluginRegistry; onJump(pageNumber: number): void }): JSX.Element {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [items, setItems] = useState<ThumbnailItem[]>([])
  const [totalHeight, setTotalHeight] = useState(0)
  useEffect(() => {
    const service = registry.getPlugin<ThumbnailPlugin>(ThumbnailPlugin.id)?.provides()
    const viewport = viewportRef.current
    if (service === undefined || viewport === null) return
    const updateWindow = (): void => service.updateWindow(viewport.scrollTop, viewport.clientHeight)
    const unsubscribe = service.onWindow(({ window: state }) => { setItems(state?.items ?? []); setTotalHeight(state?.totalHeight ?? 0) })
    viewport.addEventListener('scroll', updateWindow, { passive: true })
    const resizeObserver = new ResizeObserver(updateWindow)
    resizeObserver.observe(viewport); updateWindow()
    return () => { unsubscribe(); viewport.removeEventListener('scroll', updateWindow); resizeObserver.disconnect() }
  }, [registry])
  return <div ref={viewportRef} className="reader-thumbnails" aria-label="PDF 缩略图列表"><div className="reader-thumbnails__canvas" style={{ height: `${totalHeight}px` }}>{items.map((item) => <ThumbnailPreview key={item.pageIndex} item={item} registry={registry} onJump={onJump} />)}</div></div>
}

export function PdfNavigationSidebar({ registry }: { registry: PluginRegistry | null }): JSX.Element {
  const [tab, setTab] = useState<SidebarTab>('outline')
  const [outline, setOutline] = useState<OutlineItem[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  useEffect(() => {
    const bookmarks = registry?.getPlugin<BookmarkPlugin>(BookmarkPlugin.id)?.provides()
    if (bookmarks === undefined) return
    let disposed = false
    let loaded = false
    const loadOutline = (): void => {
      if (loaded) return
      void bookmarks.getBookmarks().toPromise().then(({ bookmarks: items }) => {
        if (!disposed) { loaded = true; setOutline(items as OutlineItem[]) }
      }).catch(() => { if (!disposed) setOutline([]) })
    }
    loadOutline()
    const unsubscribe = registry?.getPlugin<ScrollPlugin>(ScrollPlugin.id)?.provides().onPageChange(({ pageNumber }) => { setCurrentPage(pageNumber); loadOutline() })
    return () => { disposed = true; unsubscribe?.() }
  }, [registry])
  const jumpToPage = (pageNumber: number): void => registry?.getPlugin<ScrollPlugin>(ScrollPlugin.id)?.provides().scrollToPage({ pageNumber, behavior: 'smooth' })
  return <aside className="reader-sidebar" aria-label="PDF 导航侧栏"><div className="reader-sidebar__tabs" role="tablist" aria-label="PDF 导航"><button type="button" role="tab" aria-label="打开 PDF 缩略图" aria-selected={tab === 'thumbnails'} onClick={() => setTab('thumbnails')}>缩略图</button><button type="button" role="tab" aria-label="打开 PDF 目录" aria-selected={tab === 'outline'} onClick={() => setTab('outline')}>目录</button></div><div className="reader-sidebar__content">{tab === 'outline' && (outline.length === 0 ? <p className="reader-sidebar__empty">PDF 没有可用目录</p> : <OutlineTree items={outline} depth={0} activePath={findActivePath(outline, currentPage)} parentPath="" onJump={jumpToPage} />)}{tab === 'thumbnails' && (registry === null ? <p className="reader-sidebar__empty">正在准备缩略图…</p> : <ThumbnailPane registry={registry} onJump={jumpToPage} />)}</div></aside>
}
