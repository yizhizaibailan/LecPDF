/**
 * 职责：把 Foliate 自定义元素的局部事件转换为不含阅读器实例的标准 ReaderEvent。
 * 异步说明：open 等待 Foliate 打开 Blob；失败会转为安全事件而不将原始异常传播给调用方。
 * 资源说明：close 只释放一次 DOM 监听与视图资源，并清空所有订阅者以阻止关闭后的回写。
 */
import type { ReaderEvent, ReaderOutlineItem } from '../../../types/reader'
import type { FoliateReaderPort } from './foliate-reader-controller'

/** 表示 Foliate 目录中由标签、定位地址和递归子项组成的可读节点。 */
export type FoliateTocItem = {
  label: string
  href: string
  subitems?: FoliateTocItem[] | null
}

/** 表示 Foliate relocate 事件中提供的章节索引与阅读进度。 */
export type FoliateRelocate = {
  index: number
  fraction: number
}

/** 表示受控适配器所需的最小 Foliate 自定义元素能力。 */
export type FoliateViewElement = EventTarget & {
  open(source: Blob): Promise<void>
  close(): void
  book?: { toc?: FoliateTocItem[] }
}

/** Foliate 视图端口将阅读器专用事件限制在数据层，并实现统一的 ReaderEvent 契约。 */
export type FoliateViewPort = FoliateReaderPort

/** 将 Foliate 目录递归转换为 Store 可序列化的统一目录，索引路径保证 id 稳定。 */
function toReaderOutline(items: FoliateTocItem[], path: number[] = []): ReaderOutlineItem[] {
  return items.map((item, index) => {
    const itemPath = [...path, index]
    return {
      id: `foliate-outline-${itemPath.join('.')}`,
      title: item.label,
      location: { page: null, chapter: item.href, percent: 0 },
      children: toReaderOutline(item.subitems ?? [], itemPath)
    }
  })
}

/** 将 Foliate 的阅读进度约束为 ReaderEvent 可安全保存的零到一范围。 */
function normalizeFraction(fraction: number): number {
  if (!Number.isFinite(fraction)) return 0
  return Math.min(1, Math.max(0, fraction))
}

/**
 * 创建 Foliate 视图与标准阅读事件之间的受控端口。
 * 资源说明：端口持有唯一 relocate 监听器，close 会移除它并使后续订阅与事件均不再生效。
 */
export function createFoliateViewPort(view: FoliateViewElement): FoliateViewPort {
  const listeners = new Set<(event: ReaderEvent) => void>()
  let closed = false
  const publish = (event: ReaderEvent): void => {
    if (closed) return
    listeners.forEach((listener) => listener(event))
  }
  const onRelocate = (event: Event): void => {
    const detail = (event as Event & { detail?: FoliateRelocate }).detail
    if (detail === undefined) return
    publish({
      type: 'location-changed',
      location: { page: null, chapter: String(detail.index), percent: normalizeFraction(detail.fraction) }
    })
  }
  view.addEventListener('relocate', onRelocate)

  return {
    /** 异步打开只发布可展示的安全失败，不保留 Foliate 原始异常或本机路径。 */
    open: async (bytes) => {
      try {
        await view.open(new Blob([bytes], { type: 'application/epub+zip' }))
      } catch {
        publish({ type: 'load-failed', error: { code: 'document-read-failed', message: '无法打开电子书' } })
        return
      }
      publish({ type: 'outline-changed', outline: toReaderOutline(view.book?.toc ?? []) })
      publish({ type: 'ready' })
    },
    /** 关闭视图后释放唯一 DOM 监听器与内存中的订阅引用，重复关闭不重复释放。 */
    close: () => {
      if (closed) return
      closed = true
      view.removeEventListener('relocate', onRelocate)
      view.close()
      listeners.clear()
    },
    /** 订阅返回幂等清理函数，避免调用方重复取消订阅导致重复释放。 */
    subscribe: (listener) => {
      if (closed) return () => undefined
      listeners.add(listener)
      let unsubscribed = false
      return () => {
        if (unsubscribed) return
        unsubscribed = true
        listeners.delete(listener)
      }
    }
  }
}
