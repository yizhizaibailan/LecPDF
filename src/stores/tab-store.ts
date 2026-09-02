/**
 * 管理开始页与文档标签的可渲染状态。
 * 该 Store 只协调标签元数据和阅读 Store Action，不读取文件、不持有文档资源，也不直接调用 Electron IPC。
 */
import { createStore, type StoreApi } from 'zustand/vanilla'
import { getDocumentTitle, type ReaderTab } from '../types/document'
import type { ReaderStore } from './reader-store'

/** 单个窗口允许同时保留的文档标签数量；开始页不计入该上限。 */
const MAX_DOCUMENT_TABS = 20

/** 开始页始终位于标签列表首位，且不能被关闭。 */
const HOME_TAB: ReaderTab = { id: 'home', kind: 'home', title: '开始页', closable: false }

/** 表示标签栏可订阅的状态与唯一的状态修改动作。 */
export type TabStore = {
  tabs: ReaderTab[]
  activeTabId: string
  openDocument(path: string): Promise<string | null>
  activateTab(tabId: string): void
  closeTab(tabId: string): void
  closeActiveTab(): void
}

/** 表示标签协调所需的阅读状态边界和标签编号来源，便于测试且避免耦合到 UI。 */
export type TabStoreDependencies = {
  reader: Pick<ReaderStore, 'openSession' | 'closeSession'>
  createTabId(): string
}

/**
 * 创建独立的标签 Store。
 * 打开动作先写入标签和当前选择，再交给阅读 Store 加载，使界面能够立刻显示加载中的标签。
 */
export function createTabStore(dependencies: TabStoreDependencies): StoreApi<TabStore> {
  return createStore<TabStore>()((set, get) => ({
    tabs: [HOME_TAB],
    activeTabId: HOME_TAB.id,
    async openDocument(path) {
      if (countDocumentTabs(get().tabs) >= MAX_DOCUMENT_TABS) return null

      const tabId = dependencies.createTabId()
      const tab = createDocumentTab(tabId, path)
      set((state) => ({ tabs: [...state.tabs, tab], activeTabId: tabId }))
      await dependencies.reader.openSession(tabId, path)
      // 加载期间标签可能已被用户关闭；此时不能把悬空编号交给等待该动作的调用方。
      return hasTab(get().tabs, tabId) ? tabId : null
    },
    activateTab(tabId) {
      set((state) => (hasTab(state.tabs, tabId) ? { activeTabId: tabId } : state))
    },
    closeTab(tabId) {
      const tab = get().tabs.find((candidate) => candidate.id === tabId)
      if (tab?.kind !== 'document') return

      // 先释放该标签的临时文档资源，再删除 UI 标签，避免资源脱离可追踪的生命周期。
      dependencies.reader.closeSession(tabId)
      set((state) => removeTabAndSelectFallback(state, tabId))
    },
    /**
     * 关闭当前标签，供全局快捷键等没有具体标签编号的交互入口复用。
     * 具体的开始页保护仍统一交由 closeTab 判断，避免每个调用方重复实现同一规则。
     */
    closeActiveTab() {
      get().closeTab(get().activeTabId)
    }
  }))
}

/** 只统计文档标签，保证常驻开始页不会消耗二十个文档位。 */
function countDocumentTabs(tabs: ReaderTab[]): number {
  return tabs.filter((tab) => tab.kind === 'document').length
}

/** 根据路径构造可关闭的文档标签，并仅展示文件名以避免标签栏暴露完整本机路径。 */
function createDocumentTab(id: string, path: string): ReaderTab {
  return { id, kind: 'document', title: getDocumentTitle(path), path, closable: true }
}

/** 判断候选标签是否存在，避免未知的激活事件制造无法渲染的当前标签。 */
function hasTab(tabs: ReaderTab[], tabId: string): boolean {
  return tabs.some((tab) => tab.id === tabId)
}

/** 删除已关闭标签；仅当当前标签被关闭时，才回退到剩余列表的最后一个标签。 */
function removeTabAndSelectFallback(state: TabStore, tabId: string): Pick<TabStore, 'tabs' | 'activeTabId'> {
  const tabs = state.tabs.filter((tab) => tab.id !== tabId)
  const activeTabId = state.activeTabId === tabId ? (tabs.at(-1)?.id ?? HOME_TAB.id) : state.activeTabId
  return { tabs, activeTabId }
}
