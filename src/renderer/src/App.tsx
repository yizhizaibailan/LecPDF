import { BorderOutlined, CloseOutlined, MinusOutlined, ShrinkOutlined } from '@ant-design/icons'
import { Empty, Typography } from 'antd'
import { useEffect, useState } from 'react'
import {
  PDFViewer,
  RotatePlugin,
  ScrollPlugin,
  ScrollStrategy,
  SpreadMode,
  SpreadPlugin,
  ZoomMode,
  ZoomPlugin,
  type PluginRegistry
} from '@embedpdf/react-pdf-viewer'
import { SolarIcon } from './SolarIcon'

type AppProps = {
  version: string
}

type ReaderLayout = 'single' | 'continuous' | 'double'

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
          <PDFViewer
            config={{
              src: pdfUrl,
              zoom: { defaultZoomLevel: ZoomMode.FitPage, minZoom: 0.1, maxZoom: 4 },
              scroll: { defaultStrategy: ScrollStrategy.Vertical, defaultPageGap: 16 },
              spread: { defaultSpreadMode: SpreadMode.None }
            }}
            style={{ height: '100%' }}
            onReady={setRegistry}
          />
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
