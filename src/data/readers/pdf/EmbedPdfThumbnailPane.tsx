/**
 * 在 PDF 数据层渲染 EmbedPDF 缩略图窗口。
 * PluginRegistry、滚动监听、ResizeObserver 和对象 URL 的创建与回收均由此组件拥有，通用侧栏不依赖内核。
 */
import { useEffect, useRef, useState } from 'react'
import { ThumbnailPlugin, type PluginRegistry } from '@embedpdf/react-pdf-viewer'

type Item = { pageIndex: number; height: number; top: number; labelHeight: number; padding?: number }

/** 渲染当前窗口内的缩略图，并在卸载或替换图片时撤销对象 URL。 */
function Preview({ item, registry, onJump }: { item: Item; registry: PluginRegistry; onJump(pageNumber: number): void }): JSX.Element {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let disposed = false
    let objectUrl: string | null = null
    const service = registry.getPlugin<ThumbnailPlugin>(ThumbnailPlugin.id)?.provides()
    if (service === undefined) return
    void service.renderThumb(item.pageIndex, window.devicePixelRatio || 1).toPromise().then((blob) => { const next = URL.createObjectURL(blob); if (disposed) { URL.revokeObjectURL(next); return }; objectUrl = next; setUrl(next) }).catch(() => { if (!disposed) setUrl(null) })
    return () => { disposed = true; if (objectUrl !== null) URL.revokeObjectURL(objectUrl) }
  }, [item.pageIndex, registry])
  return <button type="button" className="reader-thumbnail" style={{ height: `${item.height + item.labelHeight + (item.padding ?? 0) * 2}px`, top: `${item.top}px` }} onClick={() => onJump(item.pageIndex + 1)}>{url === null ? <span className="reader-thumbnail__placeholder">加载中…</span> : <img src={url} alt={`第 ${item.pageIndex + 1} 页缩略图`} />}<span>{item.pageIndex + 1}</span></button>
}

/** 导出数据层缩略图窗格，供通用导航侧栏作为不透明视图插槽使用。 */
export function EmbedPdfThumbnailPane({ registry, onJump }: { registry: PluginRegistry; onJump(pageNumber: number): void }): JSX.Element {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [totalHeight, setTotalHeight] = useState(0)
  useEffect(() => {
    const service = registry.getPlugin<ThumbnailPlugin>(ThumbnailPlugin.id)?.provides()
    const viewport = viewportRef.current
    if (service === undefined || viewport === null) return
    const update = (): void => service.updateWindow(viewport.scrollTop, viewport.clientHeight)
    const unsubscribe = service.onWindow(({ window: state }) => { setItems((state?.items ?? []) as Item[]); setTotalHeight(state?.totalHeight ?? 0) })
    viewport.addEventListener('scroll', update, { passive: true }); const observer = new ResizeObserver(update); observer.observe(viewport); update()
    return () => { unsubscribe(); viewport.removeEventListener('scroll', update); observer.disconnect() }
  }, [registry])
  return <div ref={viewportRef} className="reader-thumbnails" aria-label="PDF 缩略图列表"><div className="reader-thumbnails__canvas" style={{ height: `${totalHeight}px` }}>{items.map((item) => <Preview key={item.pageIndex} item={item} registry={registry} onJump={onJump} />)}</div></div>
}
