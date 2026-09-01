/**
 * 职责：验证通用阅读页按会话与临时来源展示加载、错误、PDF 和 EPUB 状态。
 * 异步说明：这里使用静态渲染固定会话快照，不会创建阅读器订阅或临时资源。
 */
import { expect, test } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReaderSession } from '../../types/reader'
import { ReaderPage } from './ReaderPage'

const readyPdfSession: ReaderSession = {
  tabId: 'tab-1',
  path: 'C:\\Books\\guide.pdf',
  title: 'guide.pdf',
  kind: 'pdf',
  status: 'ready',
  location: { page: null, chapter: null, percent: 0 },
  error: null,
  requestId: 1
}

test('ready PDF 会话和 URL 渲染 EmbedPDF 页面', () => {
  const html = renderToStaticMarkup(<ReaderPage session={readyPdfSession} source={{ kind: 'pdf', url: 'lec-file://token' }} />)

  expect(html).toContain('aria-label="PDF 阅读视图"')
})

test('加载、错误和 Foliate 会话呈现明确状态', () => {
  const loading = renderToStaticMarkup(<ReaderPage session={{ ...readyPdfSession, status: 'loading' }} source={null} />)
  const error = renderToStaticMarkup(<ReaderPage session={{ ...readyPdfSession, status: 'error', error: { code: 'document-read-failed', message: '无法读取文档' } }} source={null} />)
  const foliate = renderToStaticMarkup(<ReaderPage session={{ ...readyPdfSession, kind: 'foliate' }} source={{ kind: 'foliate', bytes: new ArrayBuffer(0) }} />)

  expect(loading).toContain('正在加载文档')
  expect(error).toContain('无法读取文档')
  expect(foliate).toContain('EPUB 阅读器尚未接入')
})
