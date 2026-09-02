import { expect, test } from 'vitest'
import { resolveDocumentRoute } from './document-router'

/**
 * 固定文档路由的格式分流与隐私边界，确保页面只取得展示标题而不会收到本机绝对路径错误。
 */
test('将受支持格式转换为安全展示标题和阅读内核类型', () => {
  expect(resolveDocumentRoute('C:\\Books\\Guide.PDF')).toEqual({
    ok: true,
    kind: 'pdf',
    title: 'Guide.PDF'
  })
  expect(resolveDocumentRoute('C:\\Books\\Novel.epub')).toEqual({
    ok: true,
    kind: 'foliate',
    title: 'Novel.epub'
  })
})

test('从 POSIX 路径提取展示标题', () => {
  expect(resolveDocumentRoute('/books/Guide.PDF')).toEqual({
    ok: true,
    kind: 'pdf',
    title: 'Guide.PDF'
  })
})

test('未知格式不泄露本机绝对路径', () => {
  expect(resolveDocumentRoute('C:\\Private\\secret.txt')).toEqual({
    ok: false,
    error: {
      code: 'unsupported-document',
      message: '暂不支持此文件格式'
    }
  })
})
