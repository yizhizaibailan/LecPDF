import { expect, test } from 'vitest'
import { detectReaderKind, isSupportedDocument } from './reader-formats'

/**
 * 该测试固定文档格式与阅读内核的分流规则，防止非 PDF 文件误进入 EmbedPDF。
 */
test('按扩展名将 PDF 和 EPUB 分派到各自阅读内核', () => {
  expect(detectReaderKind('BOOK.PDF')).toBe('pdf')
  expect(detectReaderKind('novel.epub')).toBe('foliate')
  expect(detectReaderKind('notes.txt')).toBeNull()
  expect(isSupportedDocument('novel.epub')).toBe(true)
})
