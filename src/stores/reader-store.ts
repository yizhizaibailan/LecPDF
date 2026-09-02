/**
 * 管理按标签隔离的可渲染阅读会话状态。
 * Store 只保存状态、位置和错误；文件来源仍由 document-session 注册表持有，避免大字节和临时资源进入 Zustand。
 */
import { createStore, type StoreApi } from 'zustand/vanilla'
import type { DocumentSessionRegistry } from '../data/document-session'
import { getDocumentTitle, type DocumentRoute } from '../types/document'
import type { DocumentLoadResult, ReaderLocation, ReaderSession } from '../types/reader'

/** 表示阅读界面可订阅的会话状态与唯一的状态修改动作。 */
export type ReaderStore = {
  sessions: Record<string, ReaderSession>
  openSession(tabId: string, path: string): Promise<void>
  closeSession(tabId: string): void
  updateLocation(tabId: string, location: ReaderLocation): void
}

/** 表示创建 Store 时注入的纯路由和临时资源边界，便于测试且避免 Store 直接调用 IPC。 */
export type ReaderStoreDependencies = {
  resolveRoute(path: string): DocumentRoute
  registry: Pick<DocumentSessionRegistry, 'open' | 'close'>
}

const INITIAL_LOCATION: ReaderLocation = { page: null, chapter: null, percent: 0 }

/**
 * 创建独立的阅读会话 Store。
 * 每次打开递增请求号，只有仍匹配当前标签会话的异步结果才可更新状态，防止晚到请求回退界面。
 */
export function createReaderStore(dependencies: ReaderStoreDependencies): StoreApi<ReaderStore> {
  let nextRequestId = 0

  return createStore<ReaderStore>()((set) => ({
    sessions: {},
    async openSession(tabId, path) {
      const route = dependencies.resolveRoute(path)
      nextRequestId += 1
      const requestId = nextRequestId
      const session = createLoadingSession(tabId, path, route, requestId)
      set((state) => ({ sessions: { ...state.sessions, [tabId]: session } }))

      if (!route.ok) {
        set((state) => applyRouteError(state, tabId, requestId, route.error))
        return
      }

      const result = await dependencies.registry.open(tabId, path, route.kind)
      set((state) => applyLoadResult(state, tabId, requestId, result))
    },
    closeSession(tabId) {
      dependencies.registry.close(tabId)
      set((state) => removeSession(state, tabId))
    },
    updateLocation(tabId, location) {
      set((state) => updateSessionLocation(state, tabId, location))
    }
  }))
}

/** 以固定初始位置创建加载中会话，使重新打开时旧错误不会残留。 */
function createLoadingSession(tabId: string, path: string, route: DocumentRoute, requestId: number): ReaderSession {
  return {
    tabId,
    path,
    title: route.ok ? route.title : getDocumentTitle(path),
    kind: route.ok ? route.kind : null,
    status: 'loading',
    location: INITIAL_LOCATION,
    error: null,
    requestId
  }
}

/** 仅在路由失败仍属于当前请求时写入错误，避免旧同步结果覆盖新会话。 */
function applyRouteError(state: ReaderStore, tabId: string, requestId: number, error: ReaderSession['error']): ReaderStore {
  const session = state.sessions[tabId]
  if (session?.requestId !== requestId || error === null) return state
  return {
    ...state,
    sessions: {
      ...state.sessions,
      [tabId]: { ...session, status: 'error', error }
    }
  }
}

/** 将资源注册表结果写入仍属于当前请求的会话；来源本身不保存到 Store。 */
function applyLoadResult(state: ReaderStore, tabId: string, requestId: number, result: DocumentLoadResult): ReaderStore {
  const session = state.sessions[tabId]
  if (session?.requestId !== requestId) return state
  if (result.ok) {
    return {
      ...state,
      sessions: {
        ...state.sessions,
        [tabId]: { ...session, status: 'ready', error: null }
      }
    }
  }
  return {
    ...state,
    sessions: {
      ...state.sessions,
      [tabId]: { ...session, status: 'error', error: result.error }
    }
  }
}

/** 关闭后不保留已释放标签的状态，防止侧栏继续订阅旧会话。 */
function removeSession(state: ReaderStore, tabId: string): ReaderStore {
  if (!(tabId in state.sessions)) return state
  const { [tabId]: _removed, ...sessions } = state.sessions
  return { ...state, sessions }
}

/** 只更新已存在会话的位置，未知标签不能通过事件隐式创建状态。 */
function updateSessionLocation(state: ReaderStore, tabId: string, location: ReaderLocation): ReaderStore {
  const session = state.sessions[tabId]
  if (session === undefined) return state
  return {
    ...state,
    sessions: {
      ...state.sessions,
      [tabId]: { ...session, location }
    }
  }
}
