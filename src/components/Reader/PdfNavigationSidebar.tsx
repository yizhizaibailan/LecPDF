/**
 * 渲染不依赖阅读内核的 PDF 导航侧栏。
 * 目录状态与跳转由控制器提供；缩略图作为数据层视图插槽传入，组件不持有插件、URL 或观察器。
 */
import { useEffect, useState, type ReactNode } from 'react'
import type { PdfNavigationController } from '../../data/readers/pdf/pdf-navigation-controller'
import { PdfOutlineView } from './PdfOutlineView'

type SidebarTab = 'thumbnails' | 'outline'

/** 导出 PDF 导航侧栏，订阅控制器状态并在卸载时归还监听器。 */
export function PdfNavigationSidebar({ controller, thumbnailContent }: { controller: PdfNavigationController | null; thumbnailContent: ReactNode }): JSX.Element {
  const [tab, setTab] = useState<SidebarTab>('outline')
  const [, setVersion] = useState(0)
  useEffect(() => controller?.subscribe(() => setVersion((current) => current + 1)), [controller])

  const outline = controller?.getOutline() ?? []
  const currentPage = controller?.getCurrentPage() ?? 1
  return <aside className="reader-sidebar" aria-label="PDF 导航侧栏"><div className="reader-sidebar__tabs" role="tablist" aria-label="PDF 导航"><button type="button" role="tab" aria-label="打开 PDF 缩略图" aria-selected={tab === 'thumbnails'} onClick={() => setTab('thumbnails')}>缩略图</button><button type="button" role="tab" aria-label="打开 PDF 目录" aria-selected={tab === 'outline'} onClick={() => setTab('outline')}>目录</button></div><div className="reader-sidebar__content">{tab === 'outline' ? (outline.length === 0 ? <p className="reader-sidebar__empty">PDF 没有可用目录</p> : <PdfOutlineView items={outline} currentPage={currentPage} onJump={(pageNumber) => controller?.goToPage(pageNumber)} />) : thumbnailContent}</div></aside>
}
