import { expect, test, vi } from 'vitest'
import type { DocumentRoute } from '../types/document'
import type { DocumentLoadResult, DocumentSource, ReaderLocation } from '../types/reader'
import { createReaderStore } from './reader-store'

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => { resolve = next })
  return { promise, resolve }
}

const pdfRoute: DocumentRoute = { ok: true, kind: 'pdf', title: 'guide.pdf' }
const pdfSource: DocumentSource = { kind: 'pdf', url: 'lec-file://document/token-1' }

/**
 * 验证阅读 Store 只维护按标签划分的可渲染状态，并将文件来源生命周期交给资源注册表。
 */
test('成功打开文档后将目标标签会话设为 ready', async () => {
  const registry = {
    open: vi.fn().mockResolvedValue({ ok: true, source: pdfSource }),
    close: vi.fn()
  }
  const store = createReaderStore({ resolveRoute: vi.fn().mockReturnValue(pdfRoute), registry })

  await store.getState().openSession('tab-1', 'C:\\Books\\guide.pdf')

  expect(registry.open).toHaveBeenCalledWith('tab-1', 'C:\\Books\\guide.pdf', 'pdf')
  expect(store.getState().sessions['tab-1']).toMatchObject({
    tabId: 'tab-1',
    path: 'C:\\Books\\guide.pdf',
    title: 'guide.pdf',
    kind: 'pdf',
    status: 'ready',
    error: null
  })
})

test('不支持格式不会调用资源注册表，并记录脱敏错误', async () => {
  const registry = { open: vi.fn(), close: vi.fn() }
  const store = createReaderStore({
    resolveRoute: vi.fn().mockReturnValue({
      ok: false,
      error: { code: 'unsupported-document', message: '暂不支持此文件格式' }
    }),
    registry
  })

  await store.getState().openSession('tab-1', 'C:\\Private\\secret.txt')

  expect(registry.open).not.toHaveBeenCalled()
  expect(store.getState().sessions['tab-1']).toMatchObject({ status: 'error' })
  expect(store.getState().sessions['tab-1']?.error).toEqual({
    code: 'unsupported-document',
    message: '暂不支持此文件格式'
  })
})

test('晚到旧打开结果不能覆盖同一标签的新会话', async () => {
  const first = createDeferred<DocumentLoadResult>()
  const registry = {
    open: vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce({ ok: true, source: { kind: 'pdf', url: 'lec-file://document/new' } }),
    close: vi.fn()
  }
  const store = createReaderStore({ resolveRoute: vi.fn().mockReturnValue(pdfRoute), registry })

  void store.getState().openSession('tab-1', 'C:\\Books\\old.pdf')
  await store.getState().openSession('tab-1', 'C:\\Books\\new.pdf')
  first.resolve({
    ok: false,
    error: { code: 'document-read-failed', message: '无法读取该文件' }
  })
  await Promise.resolve()

  expect(store.getState().sessions['tab-1']).toMatchObject({
    path: 'C:\\Books\\new.pdf',
    status: 'ready',
    error: null
  })
})

test('关闭后晚到的打开结果不能重建已释放会话', async () => {
  const pending = createDeferred<DocumentLoadResult>()
  const registry = { open: vi.fn().mockReturnValue(pending.promise), close: vi.fn() }
  const store = createReaderStore({ resolveRoute: vi.fn().mockReturnValue(pdfRoute), registry })

  void store.getState().openSession('tab-1', 'C:\\Books\\guide.pdf')
  store.getState().closeSession('tab-1')
  pending.resolve({ ok: true, source: pdfSource })
  await Promise.resolve()

  expect(registry.close).toHaveBeenCalledWith('tab-1')
  expect(store.getState().sessions['tab-1']).toBeUndefined()
})

test('位置更新只作用于已存在的目标标签', async () => {
  const registry = { open: vi.fn().mockResolvedValue({ ok: true, source: pdfSource }), close: vi.fn() }
  const store = createReaderStore({ resolveRoute: vi.fn().mockReturnValue(pdfRoute), registry })
  const location: ReaderLocation = { page: 6, chapter: null, percent: 0.2 }

  await store.getState().openSession('tab-1', 'C:\\Books\\guide.pdf')
  store.getState().updateLocation('missing-tab', location)
  store.getState().updateLocation('tab-1', location)

  expect(store.getState().sessions['tab-1']?.location).toEqual(location)
  expect(store.getState().sessions['missing-tab']).toBeUndefined()
})

test('位置变更事件只更新目标标签会话', async () => {
  const registry = { open: vi.fn().mockResolvedValue({ ok: true, source: pdfSource }), close: vi.fn() }
  const store = createReaderStore({ resolveRoute: vi.fn().mockReturnValue(pdfRoute), registry })

  await store.getState().openSession('tab-a', 'C:\\Books\\first.pdf')
  await store.getState().openSession('tab-b', 'C:\\Books\\second.pdf')
  store.getState().applyEvent('tab-a', {
    type: 'location-changed',
    location: { page: 9, chapter: null, percent: 0.4 }
  })

  expect(store.getState().sessions['tab-a']?.location.page).toBe(9)
  expect(store.getState().sessions['tab-b']?.location.page).toBeNull()
})

test('打开会话为目录、搜索与视图写入稳定初值', async () => {
  const registry = { open: vi.fn().mockResolvedValue({ ok: true, source: pdfSource }), close: vi.fn() }
  const store = createReaderStore({ resolveRoute: vi.fn().mockReturnValue(pdfRoute), registry })

  await store.getState().openSession('tab-1', 'C:\\Books\\guide.pdf')

  expect(store.getState().sessions['tab-1']).toMatchObject({
    outline: [],
    search: { query: '', total: 0, activeIndex: -1, searching: false },
    view: { layout: null, zoom: null }
  })
})

test('目录变更事件替换目标标签目录', async () => {
  const registry = { open: vi.fn().mockResolvedValue({ ok: true, source: pdfSource }), close: vi.fn() }
  const store = createReaderStore({ resolveRoute: vi.fn().mockReturnValue(pdfRoute), registry })
  const outline = [{ id: 'chapter-1', title: '第一章', location: { page: 1, chapter: null, percent: 0 }, children: [] }]

  await store.getState().openSession('tab-1', 'C:\\Books\\guide.pdf')
  store.getState().applyEvent('tab-1', { type: 'outline-changed', outline })

  expect(store.getState().sessions['tab-1']?.outline).toEqual(outline)
})

test('搜索变更事件替换目标标签搜索状态', async () => {
  const registry = { open: vi.fn().mockResolvedValue({ ok: true, source: pdfSource }), close: vi.fn() }
  const store = createReaderStore({ resolveRoute: vi.fn().mockReturnValue(pdfRoute), registry })
  const search = { query: 'LecPDF', total: 3, activeIndex: 1, searching: false }

  await store.getState().openSession('tab-1', 'C:\\Books\\guide.pdf')
  store.getState().applyEvent('tab-1', { type: 'search-changed', search })

  expect(store.getState().sessions['tab-1']?.search).toEqual(search)
})

test('视图偏好变更事件替换目标标签视图状态', async () => {
  const registry = { open: vi.fn().mockResolvedValue({ ok: true, source: pdfSource }), close: vi.fn() }
  const store = createReaderStore({ resolveRoute: vi.fn().mockReturnValue(pdfRoute), registry })
  const view = { layout: 'continuous' as const, zoom: 1.25 }

  await store.getState().openSession('tab-1', 'C:\\Books\\guide.pdf')
  store.getState().applyEvent('tab-1', { type: 'view-preferences-changed', view })

  expect(store.getState().sessions['tab-1']?.view).toEqual(view)
})

test('就绪事件恢复可读状态并清除错误', async () => {
  const registry = { open: vi.fn().mockResolvedValue({ ok: true, source: pdfSource }), close: vi.fn() }
  const store = createReaderStore({ resolveRoute: vi.fn().mockReturnValue(pdfRoute), registry })
  const error = { code: 'document-read-failed' as const, message: '无法读取该文件' }

  await store.getState().openSession('tab-1', 'C:\\Books\\guide.pdf')
  store.getState().applyEvent('tab-1', { type: 'load-failed', error })
  store.getState().applyEvent('tab-1', { type: 'ready' })

  expect(store.getState().sessions['tab-1']).toMatchObject({ status: 'ready', error: null })
})

test('加载失败事件记录错误状态', async () => {
  const registry = { open: vi.fn().mockResolvedValue({ ok: true, source: pdfSource }), close: vi.fn() }
  const store = createReaderStore({ resolveRoute: vi.fn().mockReturnValue(pdfRoute), registry })
  const error = { code: 'document-read-failed' as const, message: '无法读取该文件' }

  await store.getState().openSession('tab-1', 'C:\\Books\\guide.pdf')
  store.getState().applyEvent('tab-1', { type: 'load-failed', error })

  expect(store.getState().sessions['tab-1']).toMatchObject({ status: 'error', error })
})

test('未知标签事件不会创建阅读会话', () => {
  const registry = { open: vi.fn(), close: vi.fn() }
  const store = createReaderStore({ resolveRoute: vi.fn().mockReturnValue(pdfRoute), registry })

  store.getState().applyEvent('missing-tab', { type: 'ready' })

  expect(store.getState().sessions['missing-tab']).toBeUndefined()
})

test('关闭会话释放资源和对应状态', async () => {
  const registry = { open: vi.fn().mockResolvedValue({ ok: true, source: pdfSource }), close: vi.fn() }
  const store = createReaderStore({ resolveRoute: vi.fn().mockReturnValue(pdfRoute), registry })

  await store.getState().openSession('tab-1', 'C:\\Books\\guide.pdf')
  store.getState().closeSession('tab-1')

  expect(registry.close).toHaveBeenCalledWith('tab-1')
  expect(store.getState().sessions['tab-1']).toBeUndefined()
})
/** 覆盖阅读会话 Store 的状态迁移与跨标签隔离。 */
