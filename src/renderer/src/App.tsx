import { BorderOutlined, CloseOutlined, MinusOutlined, ShrinkOutlined } from '@ant-design/icons'
import { Empty, Typography } from 'antd'
import { useEffect, useRef, useState } from 'react'
import {
  BookmarkPlugin,
  PDFViewer,
  RotatePlugin,
  ScrollPlugin,
  ScrollStrategy,
  SpreadMode,
  SpreadPlugin,
  ThumbnailPlugin,
  ZoomMode,
  ZoomPlugin,
  type PluginRegistry
} from '@embedpdf/react-pdf-viewer'
import { SolarIcon } from './SolarIcon'

type AppProps = {
  version: string
}

type ReaderLayout = 'single' | 'continuous' | 'double'
type ReaderSidebarTab = 'thumbnails' | 'outline'

type PdfOutlineItem = {
  title: string
  target?: {
    type: 'destination' | 'action'
    destination?: { pageIndex: number }
    action?: { destination?: { pageIndex: number } }
  }
  children?: PdfOutlineItem[]
}

type ThumbnailItem = {
  pageIndex: number
  width: number
  height: number
  top: number
  labelHeight: number
  padding?: number
}

function WindowTitlebar(): JSX.Element {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => window.lec.window.onMaximizedChange(setMaximized), [])

  return (
    <header
      className="window-titlebar"
      data-window-drag-region="true"
      onDoubleClick={(event) => {
        if ((event.target as HTMLElement).closest('button') === null) {
          void window.lec.window.toggleMaximize()
        }
      }}
    >
      <span className="window-titlebar__name">LecPDF</span>
      <div className="window-titlebar__controls" aria-label="窗口控制">
        <button type="button" aria-label="最小化窗口" onClick={() => void window.lec.window.minimize()}>
          <MinusOutlined />
        </button>
        <button
          type="button"
          aria-label="最大化或还原窗口"
          title={maximized ? '还原窗口' : '最大化窗口'}
          onClick={() => void window.lec.window.toggleMaximize()}
        >
          {maximized ? <ShrinkOutlined /> : <BorderOutlined />}
        </button>
        <button type="button" aria-label="关闭窗口" className="window-titlebar__close" onClick={() => void window.lec.window.close()}>
          <CloseOutlined />
        </button>
      </div>
    </header>
  )
}

export function ReaderToolbar({ registry }: { registry: PluginRegistry | null }): JSX.Element {
  const [layout, setLayout] = useState<ReaderLayout>('continuous')
  const [pageNumber, setPageNumber] = useState('1')
  const [totalPages, setTotalPages] = useState<number | null>(null)

  const getScroll = () => registry?.getPlugin<ScrollPlugin>(ScrollPlugin.id)?.provides() ?? null
  const getSpread = () => registry?.getPlugin<SpreadPlugin>(SpreadPlugin.id)?.provides() ?? null
  const getZoom = () => registry?.getPlugin<ZoomPlugin>(ZoomPlugin.id)?.provides() ?? null
  const getRotation = () => registry?.getPlugin<RotatePlugin>(RotatePlugin.id)?.provides() ?? null

  useEffect(() => {
    const scroll = getScroll()
    if (scroll === null) return

    return scroll.onPageChange(({ pageNumber: currentPage, totalPages: pages }) => {
      setPageNumber(String(currentPage))
      setTotalPages(pages)
    })
  }, [registry])

  const applyLayout = (nextLayout: ReaderLayout): void => {
    const scroll = getScroll()
    const spread = getSpread()
    if (scroll === null || spread === null) return

    setLayout(nextLayout)
    if (nextLayout === 'single') {
      spread.setSpreadMode(SpreadMode.None)
      scroll.setScrollStrategy(ScrollStrategy.Horizontal)
      return
    }

    scroll.setScrollStrategy(ScrollStrategy.Vertical)
    spread.setSpreadMode(nextLayout === 'double' ? SpreadMode.Odd : SpreadMode.None)
  }

  const jumpToPage = (): void => {
    const requestedPage = Number(pageNumber)
    const scroll = getScroll()
    if (scroll === null || !Number.isInteger(requestedPage) || requestedPage < 1) return

    const targetPage = totalPages === null ? requestedPage : Math.min(requestedPage, totalPages)
    scroll.scrollToPage({ pageNumber: targetPage, behavior: 'smooth' })
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
        <button type="button" aria-label="上一页" disabled={disabled} onClick={() => getScroll()?.scrollToPreviousPage('smooth')}>上一页</button>
        <label className="reader-toolbar__page-input">
          <span className="sr-only">跳转到页码</span>
          <input aria-label="跳转到页码" inputMode="numeric" min="1" type="number" value={pageNumber} disabled={disabled} onChange={(event) => setPageNumber(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') jumpToPage() }} />
        </label>
        <span className="reader-toolbar__page-total">/ {totalPages ?? '—'}</span>
        <button type="button" aria-label="跳转到输入页码" disabled={disabled} onClick={jumpToPage}>跳转</button>
        <button type="button" aria-label="下一页" disabled={disabled} onClick={() => getScroll()?.scrollToNextPage('smooth')}>下一页</button>
      </div>
      <div className="reader-toolbar__group" aria-label="缩放">
        <button type="button" aria-label="缩小 PDF" disabled={disabled} onClick={() => getZoom()?.zoomOut()}>缩小</button>
        <button type="button" aria-label="适合页面" disabled={disabled} onClick={() => getZoom()?.requestZoom(ZoomMode.FitPage)}>适合页面</button>
        <button type="button" aria-label="放大 PDF" disabled={disabled} onClick={() => getZoom()?.zoomIn()}>放大</button>
      </div>
      <div className="reader-toolbar__group" aria-label="旋转">
        <button type="button" aria-label="逆时针旋转 90 度" disabled={disabled} onClick={() => getRotation()?.rotateBackward()}>向左旋转</button>
        <button type="button" aria-label="顺时针旋转 90 度" disabled={disabled} onClick={() => getRotation()?.rotateForward()}>向右旋转</button>
      </div>
    </nav>
  )
}

function outlinePageNumber(item: PdfOutlineItem): number | null {
  const pageIndex = item.target?.type === 'destination'
    ? item.target.destination?.pageIndex
    : item.target?.action?.destination?.pageIndex
  return pageIndex === undefined ? null : pageIndex + 1
}

function findActiveOutlinePath(items: PdfOutlineItem[], currentPage: number, parentPath = ''): string | null {
  let activePath: string | null = null
  for (const [index, item] of items.entries()) {
    const path = `${parentPath}${index}`
    const pageNumber = outlinePageNumber(item)
    if (pageNumber !== null && pageNumber <= currentPage) activePath = path
    if (item.children !== undefined) {
      const childPath = findActiveOutlinePath(item.children, currentPage, `${path}.`)
      if (childPath !== null) activePath = childPath
    }
  }
  return activePath
}

function OutlineTree({ items, depth, activePath, parentPath, onJumpToPage }: { items: PdfOutlineItem[]; depth: number; activePath: string | null; parentPath: string; onJumpToPage: (pageNumber: number) => void }): JSX.Element {
  return (
    <ul className="reader-outline__list">
      {items.map((item, index) => {
        const pageNumber = outlinePageNumber(item)
        const path = `${parentPath}${index}`
        return (
          <li key={path}>
            <button type="button" className={`reader-outline__item${activePath === path ? ' reader-outline__item--active' : ''}`} style={{ paddingLeft: `${12 + depth * 16}px` }} disabled={pageNumber === null} onClick={() => { if (pageNumber !== null) onJumpToPage(pageNumber) }}>
              {item.title}
            </button>
            {item.children !== undefined && item.children.length > 0 && <OutlineTree items={item.children} depth={depth + 1} activePath={activePath} parentPath={`${path}.`} onJumpToPage={onJumpToPage} />}
          </li>
        )
      })}
    </ul>
  )
}

function ThumbnailPreview({ item, registry, onJumpToPage }: { item: ThumbnailItem; registry: PluginRegistry; onJumpToPage: (pageNumber: number) => void }): JSX.Element {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let objectUrl: string | null = null
    const thumbnails = registry.getPlugin<ThumbnailPlugin>(ThumbnailPlugin.id)?.provides()
    if (thumbnails === undefined) return

    void thumbnails.renderThumb(item.pageIndex, window.devicePixelRatio || 1).toPromise()
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => setUrl(null))

    return () => { if (objectUrl !== null) URL.revokeObjectURL(objectUrl) }
  }, [item.pageIndex, registry])

  return (
    <button
      type="button"
      className="reader-thumbnail"
      style={{ height: `${item.height + item.labelHeight + (item.padding ?? 0) * 2}px`, top: `${item.top}px` }}
      onClick={() => onJumpToPage(item.pageIndex + 1)}
    >
      {url === null ? <span className="reader-thumbnail__placeholder">加载中…</span> : <img src={url} alt={`第 ${item.pageIndex + 1} 页缩略图`} />}
      <span>{item.pageIndex + 1}</span>
    </button>
  )
}

function ThumbnailPane({ registry, onJumpToPage }: { registry: PluginRegistry; onJumpToPage: (pageNumber: number) => void }): JSX.Element {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [items, setItems] = useState<ThumbnailItem[]>([])
  const [totalHeight, setTotalHeight] = useState(0)

  useEffect(() => {
    const thumbnails = registry.getPlugin<ThumbnailPlugin>(ThumbnailPlugin.id)?.provides()
    const viewport = viewportRef.current
    if (thumbnails === undefined || viewport === null) return

    const updateWindow = (): void => thumbnails.updateWindow(viewport.scrollTop, viewport.clientHeight)
    const unsubscribe = thumbnails.onWindow(({ window: windowState }) => {
      setItems(windowState?.items ?? [])
      setTotalHeight(windowState?.totalHeight ?? 0)
    })
    viewport.addEventListener('scroll', updateWindow, { passive: true })
    const resizeObserver = new ResizeObserver(updateWindow)
    resizeObserver.observe(viewport)
    updateWindow()

    return () => {
      unsubscribe()
      viewport.removeEventListener('scroll', updateWindow)
      resizeObserver.disconnect()
    }
  }, [registry])

  return (
    <div ref={viewportRef} className="reader-thumbnails" aria-label="PDF 缩略图列表">
      <div className="reader-thumbnails__canvas" style={{ height: `${totalHeight}px` }}>
        {items.map((item) => <ThumbnailPreview key={item.pageIndex} item={item} registry={registry} onJumpToPage={onJumpToPage} />)}
      </div>
    </div>
  )
}

export function ReaderSidebar({ registry }: { registry: PluginRegistry | null }): JSX.Element {
  const [tab, setTab] = useState<ReaderSidebarTab>('outline')
  const [outline, setOutline] = useState<PdfOutlineItem[]>([])
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    const bookmarks = registry?.getPlugin<BookmarkPlugin>(BookmarkPlugin.id)?.provides()
    if (bookmarks === undefined) return

    let disposed = false
    let loaded = false
    const loadOutline = (): void => {
      if (loaded) return
      void bookmarks.getBookmarks().toPromise()
        .then(({ bookmarks: items }) => {
          if (!disposed) {
            loaded = true
            setOutline(items as PdfOutlineItem[])
          }
        })
        .catch(() => { if (!disposed) setOutline([]) })
    }
    loadOutline()
    const scroll = registry?.getPlugin<ScrollPlugin>(ScrollPlugin.id)?.provides()
    const unsubscribe = scroll?.onPageChange(({ pageNumber }) => {
      setCurrentPage(pageNumber)
      loadOutline()
    })

    return () => { disposed = true; unsubscribe?.() }
  }, [registry])

  const jumpToPage = (pageNumber: number): void => registry?.getPlugin<ScrollPlugin>(ScrollPlugin.id)?.provides().scrollToPage({ pageNumber, behavior: 'smooth' })
  const activeOutlinePath = findActiveOutlinePath(outline, currentPage)

  return (
    <aside className="reader-sidebar" aria-label="PDF 导航侧栏">
      <div className="reader-sidebar__tabs" role="tablist" aria-label="PDF 导航">
        <button type="button" role="tab" aria-label="打开 PDF 缩略图" aria-selected={tab === 'thumbnails'} onClick={() => setTab('thumbnails')}>缩略图</button>
        <button type="button" role="tab" aria-label="打开 PDF 目录" aria-selected={tab === 'outline'} onClick={() => setTab('outline')}>目录</button>
      </div>
      <div className="reader-sidebar__content">
        {tab === 'outline' && (outline.length === 0 ? <p className="reader-sidebar__empty">PDF 没有可用目录</p> : <OutlineTree items={outline} depth={0} activePath={activeOutlinePath} parentPath="" onJumpToPage={jumpToPage} />)}
        {tab === 'thumbnails' && (registry === null ? <p className="reader-sidebar__empty">正在准备缩略图…</p> : <ThumbnailPane registry={registry} onJumpToPage={jumpToPage} />)}
      </div>
    </aside>
  )
}

export function App({ version }: AppProps): JSX.Element {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [openError, setOpenError] = useState<string | null>(null)
  const [registry, setRegistry] = useState<PluginRegistry | null>(null)

  useEffect(() => window.lec.lifecycle.onOpenFileRequest((path) => {
    if (!path.toLowerCase().endsWith('.pdf')) return
    void window.lec.fileRead.getPdfUrl(path)
      .then((url) => { setOpenError(null); setRegistry(null); setPdfUrl(url) })
      .catch(() => setOpenError('无法打开此 PDF 文件'))
  }), [])

  if (pdfUrl !== null) {
    return (
      <div className="app-frame">
        <WindowTitlebar />
        <main className="reader-shell">
          <ReaderToolbar registry={registry} />
          <div className="reader-workspace">
            <ReaderSidebar registry={registry} />
            <PDFViewer
              config={{
                src: pdfUrl,
                zoom: { defaultZoomLevel: ZoomMode.FitPage, minZoom: 0.1, maxZoom: 4 },
                scroll: { defaultStrategy: ScrollStrategy.Vertical, defaultPageGap: 16 },
                spread: { defaultSpreadMode: SpreadMode.None },
                thumbnails: { width: 120, gap: 8, buffer: 3, labelHeight: 16, autoScroll: true }
              }}
              style={{ height: '100%' }}
              onReady={setRegistry}
            />
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app-frame">
      <WindowTitlebar />
      <main className="project-shell">
        <section className="project-shell__card" aria-label="LecPDF 项目状态">
          <span className="project-shell__tag">LecPDF</span>
          <Empty
            image={<SolarIcon className="project-shell__icon" name="book-2-linear" width="72" aria-hidden />}
            description={
              <div className="project-shell__description">
                <Typography.Title level={1}>项目骨架已就绪</Typography.Title>
                <Typography.Text>版本 {version}</Typography.Text>
              </div>
            }
          />
          {openError !== null && <Typography.Text type="danger">{openError}</Typography.Text>}
        </section>
      </main>
    </div>
  )
}
