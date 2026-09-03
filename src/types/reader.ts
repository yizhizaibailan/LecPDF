/**
 * 定义阅读会话及阅读内核之间的通用数据契约。
 * Store 只保存可序列化会话状态；文件字节和阅读器实例由数据层资源注册表持有。
 */
import type { DocumentKind, DocumentOpenError } from './document'

/** 表示阅读会话当前处于加载、可阅读或失败状态。 */
export type ReaderSessionStatus = 'loading' | 'ready' | 'error'

/** 表示 PDF 页码或电子书章节的统一阅读位置。 */
export type ReaderLocation = {
  page: number | null
  chapter: string | null
  percent: number
}

/** 表示目录树中的一个可定位节点，子节点使用同一可序列化结构递归表达。 */
export type ReaderOutlineItem = {
  id: string
  title: string
  location: ReaderLocation
  children: ReaderOutlineItem[]
}

/** 表示当前查询及其结果导航状态，不保存阅读内核的查询对象。 */
export type ReaderSearchState = {
  query: string
  total: number
  activeIndex: number
  searching: boolean
}

/** 表示会话级布局与缩放偏好，null 表示尚未由阅读内核提供值。 */
export type ReaderViewPreferences = {
  layout: 'single' | 'continuous' | 'double' | null
  zoom: number | null
}

/** 表示 Store 按标签保存的可订阅阅读会话。 */
export type ReaderSession = {
  tabId: string
  path: string
  title: string
  kind: DocumentKind | null
  status: ReaderSessionStatus
  location: ReaderLocation
  outline: ReaderOutlineItem[]
  search: ReaderSearchState
  view: ReaderViewPreferences
  error: DocumentOpenError | null
  requestId: number
}

/** 表示只在数据层资源注册表中短暂保存的 PDF URL 或 Foliate 文件字节。 */
export type DocumentSource =
  | { kind: 'pdf'; url: string }
  | { kind: 'foliate'; bytes: ArrayBuffer }

/** 表示安全文件读取完成或被转换为标准错误后的结果。 */
export type DocumentLoadResult =
  | { ok: true; source: DocumentSource }
  | { ok: false; error: DocumentOpenError }

/** 表示阅读内核发送给 Store 的可序列化会话事件。 */
export type ReaderEvent =
  | { type: 'ready' }
  | { type: 'location-changed'; location: ReaderLocation }
  | { type: 'outline-changed'; outline: ReaderOutlineItem[] }
  | { type: 'search-changed'; search: ReaderSearchState }
  | { type: 'view-preferences-changed'; view: ReaderViewPreferences }
  | { type: 'load-failed'; error: DocumentOpenError }
