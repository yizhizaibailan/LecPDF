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

/** 表示 Store 按标签保存的可订阅阅读会话。 */
export type ReaderSession = {
  tabId: string
  path: string
  title: string
  kind: DocumentKind | null
  status: ReaderSessionStatus
  location: ReaderLocation
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

/** 表示阅读内核发送给 Store 的位置更新或加载失败事件。 */
export type ReaderEvent =
  | { type: 'location-changed'; location: ReaderLocation }
  | { type: 'load-failed'; error: DocumentOpenError }
