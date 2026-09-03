/**
 * 职责：按当前阅读会话和临时来源分发加载、错误、PDF 与 Foliate 占位阅读状态。
 * 异步说明：加载状态由外部 Store 驱动，本组件不发起文件读取任务。
 * 安全说明：页面只接收受限临时来源，不读取本机路径或 Electron 能力。
 * 资源说明：PDF 子树以 tabId 标识实例，切换标签时卸载旧 registry 与订阅。
 */
import type { DocumentSource, ReaderSession } from '../../types/reader'
import { PdfReaderPage } from './PdfReaderPage'

/** 表示通用阅读页所需的会话状态与不会写入 Store 的临时阅读来源。 */
export type ReaderPageProps = {
  session: ReaderSession | undefined
  source: DocumentSource | null
}

/**
 * 渲染当前文档的状态页面；仅已就绪 PDF 且来源为 URL 时挂载 EmbedPDF。
 * Foliate 会话仅展示架构就绪占位，避免把 EPUB 字节误交给 PDF 阅读器或伪造阅读内容。
 */
export function ReaderPage({ session, source }: ReaderPageProps): JSX.Element {
  if (session === undefined) return <main className="reader-page reader-page--empty">未选择文档</main>
  if (session.status === 'loading') return <main className="reader-page reader-page--loading" aria-live="polite">正在加载文档…</main>
  if (session.status === 'error') return <main className="reader-page reader-page--error" role="alert">{session.error?.message ?? '无法打开文档'}</main>

  if (session.kind === 'pdf' && source?.kind === 'pdf') return <PdfReaderPage key={session.tabId} url={source.url} />
  if (session.kind === 'foliate' && source?.kind === 'foliate') {
    return <main className="reader-page reader-page--foliate" aria-live="polite">电子书阅读器架构已就绪，等待 Foliate 内核验证接入</main>
  }

  return <main className="reader-page reader-page--error" role="alert">阅读资源不可用</main>
}
