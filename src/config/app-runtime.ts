/**
 * 应用运行时唯一的组合根：在此处把 preload 能力接入文档 API、资源注册表和 Zustand Store。
 * 本模块不创建 React 状态、事件监听器或 EmbedPDF 实例，确保临时来源不会进入 Store。
 */
import type { StoreApi } from 'zustand/vanilla'
import type { LecApi } from '../../electron/shared/ipc'
import { createDocumentApi } from '../db-api/document-api'
import { createDocumentSessionRegistry, type DocumentSessionRegistry } from '../data/document-session'
import { resolveDocumentRoute } from '../router/document-router'
import { createReaderStore, type ReaderStore } from '../stores/reader-store'
import { createTabStore, type TabStore } from '../stores/tab-store'
import type { DocumentSource } from '../types/reader'

/** 向页面公开的应用运行时资源；文件来源只通过 getSource 按标签短暂取得。 */
export type AppRuntime = {
  readonly sessions: DocumentSessionRegistry
  readonly readerStore: StoreApi<ReaderStore>
  readonly tabStore: StoreApi<TabStore>
  getSource(tabId: string): DocumentSource | null
}

/**
 * 创建一次应用级依赖图，并把 preload 的文件读取能力限制在文档 API 边界内。
 * 组合根不持有 UI 生命周期；调用方负责把这些 Store 注入 React 页面。
 */
export function createAppRuntime(
  port: Pick<LecApi, 'fileRead'>,
  createTabId: () => string = () => crypto.randomUUID()
): AppRuntime {
  const sessions = createDocumentSessionRegistry(createDocumentApi(port))
  const readerStore = createReaderStore({ resolveRoute: resolveDocumentRoute, registry: sessions })
  const tabStore = createTabStore({ reader: readerStore.getState(), createTabId })

  return {
    sessions,
    readerStore,
    tabStore,
    // 临时来源留在注册表中，运行时按标签公开只读访问，不复制到 Zustand 状态。
    getSource: (tabId) => sessions.getSource(tabId)
  }
}
