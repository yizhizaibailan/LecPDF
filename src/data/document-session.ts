/**
 * 管理不应进入 Zustand 的临时文档来源资源。
 * 注册表按标签保存 PDF URL 或 EPUB 字节，并用活动请求号阻止晚到请求覆盖当前标签的最新资源。
 */
import type { DocumentApi } from '../db-api/document-api'
import type { DocumentKind } from '../types/document'
import type { DocumentLoadResult, DocumentSource } from '../types/reader'

/** 表示供阅读器适配器取得或释放某个标签临时来源的资源注册表。 */
export type DocumentSessionRegistry = {
  open(tabId: string, path: string, kind: DocumentKind): Promise<DocumentLoadResult>
  getSource(tabId: string): DocumentSource | null
  close(tabId: string): void
  clear(): void
}

/**
 * 使用受限 DocumentApi 创建会话资源注册表。
 * `sources` 不被 React 订阅，避免大文件字节、短期 URL 和异步资源句柄进入前端状态树。
 */
export function createDocumentSessionRegistry(api: DocumentApi): DocumentSessionRegistry {
  const sources = new Map<string, DocumentSource>()
  const activeRequestIds = new Map<string, number>()
  let nextRequestId = 0

  const startRequest = (tabId: string): number => {
    nextRequestId += 1
    activeRequestIds.set(tabId, nextRequestId)
    return nextRequestId
  }

  return {
    async open(tabId, path, kind) {
      const requestId = startRequest(tabId)
      const result = await api.loadSource(path, kind)

      // 新请求、关闭或清空已移除活动请求号时，保留结果给调用者处理，但不重新写入失效资源。
      if (result.ok && activeRequestIds.get(tabId) === requestId) {
        sources.set(tabId, result.source)
      }
      return result
    },
    getSource(tabId) {
      return sources.get(tabId) ?? null
    },
    close(tabId) {
      activeRequestIds.delete(tabId)
      sources.delete(tabId)
    },
    clear() {
      sources.clear()
      activeRequestIds.clear()
    }
  }
}
