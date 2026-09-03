/**
 * 将 EmbedPDF 目录与滚动插件适配为导航端口。
 * 目录转换、页码事件和跳转命令均停留在数据层，导航组件只读取 PdfOutlineItem。
 */
import { BookmarkPlugin, ScrollPlugin, type PluginRegistry } from '@embedpdf/react-pdf-viewer'
import type { PdfNavigationPort, PdfOutlineItem } from './pdf-navigation-controller'

/** 从 EmbedPDF 注册表创建导航端口；目录异步加载前返回空数组。 */
export function createEmbedPdfNavigationPort(registry: PluginRegistry): PdfNavigationPort {
  let outline: PdfOutlineItem[] = []
  let currentPage = 1
  const listeners = new Set<() => void>()
  const notify = (): void => listeners.forEach((listener) => listener())
  void registry.getPlugin<BookmarkPlugin>(BookmarkPlugin.id)?.provides().getBookmarks().toPromise().then(({ bookmarks }) => { outline = convertOutline(bookmarks as EmbedOutlineItem[]); notify() }).catch(() => { outline = []; notify() })
  registry.getPlugin<ScrollPlugin>(ScrollPlugin.id)?.provides().onPageChange(({ pageNumber }) => { currentPage = pageNumber; notify() })
  return {
    getOutline: () => outline,
    getCurrentPage: () => currentPage,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener) } },
    goToPage: (pageNumber) => registry.getPlugin<ScrollPlugin>(ScrollPlugin.id)?.provides().scrollToPage({ pageNumber, behavior: 'smooth' })
  }
}

type EmbedOutlineItem = { title: string; target?: { type: 'destination' | 'action'; destination?: { pageIndex: number }; action?: { destination?: { pageIndex: number } } }; children?: EmbedOutlineItem[] }
function convertOutline(items: EmbedOutlineItem[]): PdfOutlineItem[] {
  return items.map((item) => ({ title: item.title, pageNumber: item.target?.type === 'destination' ? (item.target.destination?.pageIndex ?? -1) + 1 : item.target?.action?.destination?.pageIndex === undefined ? null : item.target.action.destination.pageIndex + 1, children: convertOutline(item.children ?? []) }))
}
