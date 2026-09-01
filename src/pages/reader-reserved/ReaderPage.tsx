/**
 * 职责：按当前阅读会话和临时来源分发加载、错误、PDF 与 Foliate 占位阅读状态。
 * 资源说明：页面只读取运行时提供的临时来源；实际 PDF 阅读器在卸载时自行释放其 effect 资源。
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
 * Foliate 会话目前明确告知尚未接入，避免把 EPUB 字节误交给 PDF 阅读器或伪造阅读内容。
 */
export function ReaderPage({ session, source }: ReaderPageProps): JSX.Element {
  if (session === undefined) return <main className="reader-page reader-page--empty">未选择文档</main>
  if (session.status === 'loading') return <main className="reader-page reader-page--loading" aria-live="polite">正在加载文档…</main>
  if (session.status === 'error') return <main className="reader-page reader-page--error" role="alert">{session.error?.message ?? '无法打开文档'}</main>

  if (session.kind === 'pdf' && source?.kind === 'pdf') return <PdfReaderPage url={source.url} />
  if (session.kind === 'foliate') return <main className="reader-page reader-page--foliate">EPUB 阅读器尚未接入</main>

  return <main className="reader-page reader-page--error" role="alert">阅读资源不可用</main>
}
