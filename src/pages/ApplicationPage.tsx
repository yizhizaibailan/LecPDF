/**
 * 职责：组合窗口布局、标签、开始页和当前阅读会话，并将外部打开入口汇入标签 Store。
 * 异步与资源说明：系统文件请求订阅由 effect 返回其取消函数，避免页面卸载后继续打开文档。
 */
import { useEffect } from 'react'
import type { LecApi } from '../../electron/shared/ipc'
import type { AppRuntime } from '../config/app-runtime'
import { DocumentTabs } from '../components/TabBar/DocumentTabs'
import { AppLayout } from '../layouts/AppLayout'
import { openDocumentsFromDialog } from '../router/open-documents'
import { useStoreSelector } from '../stores/use-store-selector'
import { HomePage } from './home/HomePage'
import { ReaderPage } from './reader-reserved/ReaderPage'
import { bindOpenFileRequests } from '../router'

/** 表示应用页面所需的运行时依赖和从渲染入口注入的受限 preload 能力。 */
export type ApplicationPageProps = {
  runtime: AppRuntime
  lifecycle: LecApi['lifecycle']
  dialogs: LecApi['dialogs']
}

/**
 * 组合应用内各区域，并让所有文件打开意图复用 tabStore 的唯一打开动作。
 * effect 清理生命周期订阅，开始页与标签栏只派发 Store action 而不直接读取 Electron API。
 */
export function ApplicationPage({ runtime, lifecycle, dialogs }: ApplicationPageProps): JSX.Element {
  const tabs = useStoreSelector(runtime.tabStore, (state) => state.tabs)
  const activeTabId = useStoreSelector(runtime.tabStore, (state) => state.activeTabId)
  const sessions = useStoreSelector(runtime.readerStore, (state) => state.sessions)

  useEffect(
    () => bindOpenFileRequests(lifecycle.onOpenFileRequest, runtime.tabStore.getState().openDocument),
    [lifecycle, runtime]
  )

  const tabStore = runtime.tabStore.getState()
  const activeSession = sessions[activeTabId]
  const activeSource = activeTabId === 'home' ? null : runtime.getSource(activeTabId)
  const content = activeTabId === 'home'
    ? <HomePage onOpenDocuments={() => openDocumentsFromDialog(dialogs.openDocuments, tabStore.openDocument)} />
    : <ReaderPage session={activeSession} source={activeSource} />

  return (
    <AppLayout
      tabs={<DocumentTabs tabs={tabs} activeTabId={activeTabId} onActivate={tabStore.activateTab} onClose={tabStore.closeTab} />}
    >
      {content}
    </AppLayout>
  )
}
