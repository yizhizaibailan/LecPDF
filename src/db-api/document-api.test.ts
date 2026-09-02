import { expect, test, vi } from 'vitest'
import type { LecApi } from '../../electron/shared/ipc'
import { createDocumentApi } from './document-api'

/**
 * 验证渲染层文件访问只能经由注入的白名单桥接对象，并将底层异常转换为脱敏的领域错误。
 */
test('PDF 仅请求受限的 PDF URL', async () => {
  const getPdfUrl = vi.fn().mockResolvedValue('lec-file://document/token-1')
  const readBuffer = vi.fn()
  const api = createDocumentApi({ fileRead: { getPdfUrl, readBuffer } } as Pick<LecApi, 'fileRead'>)

  await expect(api.loadSource('C:\\Books\\guide.pdf', 'pdf')).resolves.toEqual({
    ok: true,
    source: { kind: 'pdf', url: 'lec-file://document/token-1' }
  })
  expect(readBuffer).not.toHaveBeenCalled()
})

test('Foliate 仅请求受限的文件字节', async () => {
  const getPdfUrl = vi.fn()
  const bytes = new Uint8Array([0x50, 0x4b]).buffer
  const readBuffer = vi.fn().mockResolvedValue(bytes)
  const api = createDocumentApi({ fileRead: { getPdfUrl, readBuffer } } as Pick<LecApi, 'fileRead'>)

  await expect(api.loadSource('C:\\Books\\novel.epub', 'foliate')).resolves.toEqual({
    ok: true,
    source: { kind: 'foliate', bytes }
  })
  expect(getPdfUrl).not.toHaveBeenCalled()
})

test('读取失败只返回不含路径的标准错误', async () => {
  const api = createDocumentApi({
    fileRead: {
      getPdfUrl: vi.fn().mockRejectedValue(new Error('ENOENT C:\\Private\\secret.pdf')),
      readBuffer: vi.fn()
    }
  } as Pick<LecApi, 'fileRead'>)

  await expect(api.loadSource('C:\\Private\\secret.pdf', 'pdf')).resolves.toEqual({
    ok: false,
    error: { code: 'document-not-found', message: '找不到该文件，请重新定位' }
  })
})

test.each([
  [new Error('EACCES C:\\Private\\secret.pdf'), { code: 'permission-denied', message: '没有读取该文件的权限' }],
  [new Error('unexpected C:\\Private\\secret.pdf'), { code: 'document-read-failed', message: '无法读取该文件' }]
])('将底层读取错误映射为脱敏标准错误', async (failure, error) => {
  const api = createDocumentApi({
    fileRead: {
      getPdfUrl: vi.fn().mockRejectedValue(failure),
      readBuffer: vi.fn()
    }
  } as Pick<LecApi, 'fileRead'>)

  await expect(api.loadSource('C:\\Private\\secret.pdf', 'pdf')).resolves.toEqual({ ok: false, error })
})
