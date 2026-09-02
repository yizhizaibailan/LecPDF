/**
 * 封装渲染层读取文档来源的安全边界。
 * 调用方只能注入 preload 暴露的 fileRead 白名单；本模块按阅读内核选择 URL 或字节，并把底层错误脱敏为领域错误。
 */
import type { LecApi } from '../../electron/shared/ipc'
import type { DocumentKind, DocumentOpenError } from '../types/document'
import type { DocumentLoadResult } from '../types/reader'

/** 表示供 Store 或资源注册表调用的受限文档读取能力。 */
export type DocumentApi = {
  loadSource(path: string, kind: DocumentKind): Promise<DocumentLoadResult>
}

/**
 * 由 preload 的 fileRead 能力创建文档访问对象。
 * 依赖注入使该层在测试中不需要全局 window，同时阻止组件直接取得 Electron API。
 */
export function createDocumentApi(port: Pick<LecApi, 'fileRead'>): DocumentApi {
  return {
    async loadSource(path, kind) {
      try {
        if (kind === 'pdf') {
          const url = await port.fileRead.getPdfUrl(path)
          return { ok: true, source: { kind, url } }
        }

        const bytes = await port.fileRead.readBuffer(path)
        return { ok: true, source: { kind, bytes } }
      } catch (error) {
        return { ok: false, error: toDocumentOpenError(error) }
      }
    }
  }
}

/**
 * 将主进程或 preload 的底层异常归一为可展示错误。
 * 用户界面只接收固定文案，避免把错误对象中可能含有的绝对路径或文件内容泄露出去。
 */
function toDocumentOpenError(error: unknown): DocumentOpenError {
  const message = error instanceof Error ? error.message.toUpperCase() : ''
  if (message.includes('ENOENT')) {
    return { code: 'document-not-found', message: '找不到该文件，请重新定位' }
  }
  if (message.includes('EACCES') || message.includes('EPERM')) {
    return { code: 'permission-denied', message: '没有读取该文件的权限' }
  }
  return { code: 'document-read-failed', message: '无法读取该文件' }
}
