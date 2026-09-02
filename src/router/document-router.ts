/**
 * 将文件路径纯粹地分流为 PDF 或 Foliate 阅读会话，不访问 IPC、Store 或 React。
 * 通过标准化错误和安全展示标题，让上层无需重复判断扩展名或处理路径隐私。
 */
import { detectReaderKind } from '../config/reader-formats'
import { getDocumentTitle, type DocumentRoute } from '../types/document'

/**
 * 根据文件扩展名生成阅读器路由结果。
 * 未支持格式只返回固定文案，避免错误状态意外展示用户的绝对路径。
 */
export function resolveDocumentRoute(path: string): DocumentRoute {
  const kind = detectReaderKind(path)
  if (kind === null) {
    return {
      ok: false,
      error: {
        code: 'unsupported-document',
        message: '暂不支持此文件格式'
      }
    }
  }

  return { ok: true, kind, title: getDocumentTitle(path) }
}
