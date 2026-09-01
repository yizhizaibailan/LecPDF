/**
 * 定义渲染层共享的文档、标签和错误契约。
 * 这些类型不依赖 React、Electron 或阅读内核，使路由、Store 与数据层能以同一语言传递文档意图。
 */

/** 表示当前已验证且可分流到阅读器的文档内核类型。 */
export type DocumentKind = 'pdf' | 'foliate'

/** 表示可以安全展示给用户的文档打开失败类别。 */
export type DocumentOpenErrorCode =
  | 'unsupported-document'
  | 'document-not-found'
  | 'permission-denied'
  | 'document-read-failed'

/** 将失败类别与不包含本机路径的用户提示组合为标准错误。 */
export type DocumentOpenError = {
  code: DocumentOpenErrorCode
  message: string
}

/** 表示格式路由成功或失败后的标准结果，供 Store 决定后续加载状态。 */
export type DocumentRoute =
  | { ok: true; kind: DocumentKind; title: string }
  | { ok: false; error: DocumentOpenError }

/** 表示标签栏需要渲染的常驻开始页或可关闭文档标签。 */
export type ReaderTab =
  | { id: 'home'; kind: 'home'; title: string; closable: false }
  | { id: string; kind: 'document'; title: string; path: string; closable: true }

/**
 * 从任意 Windows 或 POSIX 路径中提取界面可见的文件名。
 * 错误状态和 UI 只使用该标题，避免把用户完整本机路径带入渲染界面。
 */
export function getDocumentTitle(path: string): string {
  const parts = path.split(/[\\/]/)
  return parts.at(-1) || '未命名文档'
}
