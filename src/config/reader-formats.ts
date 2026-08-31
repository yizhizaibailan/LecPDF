/**
 * 集中声明当前已验证的文档扩展名与阅读内核映射。
 * 通过先规范化扩展名再返回固定内核类型，路由层可以避免把 EPUB 等电子书交给 EmbedPDF。
 */
export type ReaderKind = 'pdf' | 'foliate'

const READER_KIND_BY_EXTENSION: Readonly<Record<string, ReaderKind>> = {
  '.pdf': 'pdf',
  '.epub': 'foliate'
}

/**
 * 根据文件路径判断应由哪个阅读内核打开；未验证或不支持的格式返回 null。
 */
export function detectReaderKind(path: string): ReaderKind | null {
  const dotIndex = path.lastIndexOf('.')
  if (dotIndex < 0) return null

  return READER_KIND_BY_EXTENSION[path.slice(dotIndex).toLowerCase()] ?? null
}

/**
 * 将格式判断转换为布尔值，供文件选择、拖放和列表过滤共用。
 */
export function isSupportedDocument(path: string): boolean {
  return detectReaderKind(path) !== null
}
