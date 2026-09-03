/**
 * 职责：验证通用阅读页按会话与临时来源展示状态，并以标签身份隔离 PDF 阅读器实例。
 * 异步说明：这里使用静态会话快照，不等待真实阅读器初始化。
 * 安全说明：测试只传入受限 lec-file URL，不接触本机文件系统或 Electron 能力。
 * 资源说明：不同 tabId 的 key 契约保证切换标签时回收旧 PDF registry 与订阅。
 */
import { expect, test } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReaderSession } from '../../types/reader'
import { PdfReaderPage } from './PdfReaderPage'
import { ReaderPage } from './ReaderPage'

const noopReaderEvent = (): void => undefined

const readyPdfSession: ReaderSession = {
  tabId: 'tab-1',
  path: 'C:\\Books\\guide.pdf',
  title: 'guide.pdf',
  kind: 'pdf',
  status: 'ready',
  location: { page: null, chapter: null, percent: 0 },
  outline: [],
  search: { query: '', total: 0, activeIndex: -1, searching: false },
  view: { layout: null, zoom: null },
  error: null,
  requestId: 1
}

test('ready PDF 会话和 URL 渲染 EmbedPDF 页面', () => {
  const html = renderToStaticMarkup(<ReaderPage session={readyPdfSession} source={{ kind: 'pdf', url: 'lec-file://token' }} onReaderEvent={noopReaderEvent} />)

  expect(html).toContain('aria-label="PDF 阅读视图"')
})

test('相同路径的不同 PDF 标签使用各自 tabId 作为阅读器 key', () => {
  const source = { kind: 'pdf' as const, url: 'lec-file://token' }
  const first = ReaderPage({ session: readyPdfSession, source, onReaderEvent: noopReaderEvent })
  const second = ReaderPage({ session: { ...readyPdfSession, tabId: 'tab-2' }, source, onReaderEvent: noopReaderEvent })

  expect(first.type).toBe(PdfReaderPage)
  expect(first.key).toBe('tab-1')
  expect(second.type).toBe(PdfReaderPage)
  expect(second.key).toBe('tab-2')
})

test('就绪 PDF 会话将统一阅读事件回调传给 PDF 页面', () => {
  const onReaderEvent = (): void => undefined
  const element = ReaderPage({
    session: readyPdfSession,
    source: { kind: 'pdf', url: 'lec-file://token' },
    onReaderEvent
  })

  expect(element.type).toBe(PdfReaderPage)
  expect(element.props.onReaderEvent).toBe(onReaderEvent)
})

test('加载、错误和 Foliate 会话呈现明确状态', () => {
  const loading = renderToStaticMarkup(<ReaderPage session={{ ...readyPdfSession, status: 'loading' }} source={null} onReaderEvent={noopReaderEvent} />)
  const error = renderToStaticMarkup(<ReaderPage session={{ ...readyPdfSession, status: 'error', error: { code: 'document-read-failed', message: '无法读取文档' } }} source={null} onReaderEvent={noopReaderEvent} />)
  const foliate = renderToStaticMarkup(<ReaderPage session={{ ...readyPdfSession, kind: 'foliate' }} source={{ kind: 'foliate', bytes: new ArrayBuffer(0) }} onReaderEvent={noopReaderEvent} />)

  expect(loading).toContain('正在加载文档')
  expect(error).toContain('无法读取文档')
  expect(foliate).toContain('电子书阅读器架构已就绪，等待 Foliate 内核验证接入')
  expect(foliate).toContain('aria-live="polite"')
})

test('Foliate 会话来源缺失时保持资源错误分支', () => {
  const html = renderToStaticMarkup(<ReaderPage session={{ ...readyPdfSession, kind: 'foliate' }} source={null} onReaderEvent={noopReaderEvent} />)

  expect(html).toContain('阅读资源不可用')
  expect(html).not.toContain('电子书阅读器架构已就绪')
})

test('Foliate 来源不会进入 PDF 阅读器', () => {
  const element = ReaderPage({ session: { ...readyPdfSession, kind: 'foliate' }, source: { kind: 'foliate', bytes: new ArrayBuffer(0) }, onReaderEvent: noopReaderEvent })

  expect(element.type).not.toBe(PdfReaderPage)
})
