import { expect, test, vi } from 'vitest'
import type { DocumentApi } from '../db-api/document-api'
import type { DocumentLoadResult, DocumentSource } from '../types/reader'
import { createDocumentSessionRegistry } from './document-session'

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => { resolve = next })
  return { promise, resolve }
}

/**
 * 验证临时文档来源由资源注册表按标签持有，不进入 Zustand，并会在关闭或清空时释放引用。
 */
test('按标签保存成功读取的来源，并在关闭时移除', async () => {
  const source: DocumentSource = { kind: 'pdf', url: 'lec-file://document/token-1' }
  const api: DocumentApi = { loadSource: vi.fn().mockResolvedValue({ ok: true, source }) }
  const registry = createDocumentSessionRegistry(api)

  await expect(registry.open('tab-1', 'C:\\Books\\guide.pdf', 'pdf')).resolves.toEqual({ ok: true, source })
  expect(registry.getSource('tab-1')).toBe(source)

  registry.close('tab-1')
  expect(registry.getSource('tab-1')).toBeNull()
})

test('读取失败不会覆盖已有资源，clear 会移除所有标签来源', async () => {
  const firstSource: DocumentSource = { kind: 'foliate', bytes: new Uint8Array([0x50, 0x4b]).buffer }
  const api: DocumentApi = {
    loadSource: vi
      .fn()
      .mockResolvedValueOnce({ ok: true, source: firstSource })
      .mockResolvedValueOnce({
        ok: false,
        error: { code: 'document-read-failed', message: '无法读取该文件' }
      })
  }
  const registry = createDocumentSessionRegistry(api)

  await registry.open('tab-1', 'C:\\Books\\novel.epub', 'foliate')
  await registry.open('tab-1', 'C:\\Books\\broken.epub', 'foliate')
  expect(registry.getSource('tab-1')).toBe(firstSource)

  registry.clear()
  expect(registry.getSource('tab-1')).toBeNull()
})

test('同一标签的晚到旧读取结果不能覆盖新来源', async () => {
  const first = createDeferred<DocumentLoadResult>()
  const newSource: DocumentSource = { kind: 'pdf', url: 'lec-file://document/new' }
  const api: DocumentApi = {
    loadSource: vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce({ ok: true, source: newSource })
  }
  const registry = createDocumentSessionRegistry(api)

  void registry.open('tab-1', 'C:\\Books\\old.pdf', 'pdf')
  await registry.open('tab-1', 'C:\\Books\\new.pdf', 'pdf')
  first.resolve({ ok: true, source: { kind: 'pdf', url: 'lec-file://document/old' } })
  await Promise.resolve()

  expect(registry.getSource('tab-1')).toBe(newSource)
})

test('关闭标签后，晚到读取结果不能重新写入来源', async () => {
  const pending = createDeferred<DocumentLoadResult>()
  const registry = createDocumentSessionRegistry({ loadSource: vi.fn().mockReturnValue(pending.promise) })

  void registry.open('tab-1', 'C:\\Books\\guide.pdf', 'pdf')
  registry.close('tab-1')
  pending.resolve({ ok: true, source: { kind: 'pdf', url: 'lec-file://document/late' } })
  await Promise.resolve()

  expect(registry.getSource('tab-1')).toBeNull()
})

test('清空注册表后，晚到读取结果不能重新写入来源', async () => {
  const pending = createDeferred<DocumentLoadResult>()
  const registry = createDocumentSessionRegistry({ loadSource: vi.fn().mockReturnValue(pending.promise) })

  void registry.open('tab-1', 'C:\\Books\\guide.pdf', 'pdf')
  registry.clear()
  pending.resolve({ ok: true, source: { kind: 'pdf', url: 'lec-file://document/late' } })
  await Promise.resolve()

  expect(registry.getSource('tab-1')).toBeNull()
})
/** 覆盖文档会话初始化、错误状态与会话标识的纯转换。 */
