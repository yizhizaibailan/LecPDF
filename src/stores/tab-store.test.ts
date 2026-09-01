import { expect, test, vi } from 'vitest'
import { createTabStore } from './tab-store'

/** 创建可预测的标签编号，避免测试依赖随机实现。 */
function createTabIdFactory(): () => string {
  let sequence = 0
  return () => {
    sequence += 1
    return `tab-${sequence}`
  }
}

/** 创建可手动完成的 Promise，用于模拟仍在加载的阅读会话。 */
function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => { resolve = next })
  return { promise, resolve }
}

/** 验证新文档标签、开始页和阅读会话之间的单向协调关系。 */
test('开始页常驻，并将新文档标签交给阅读 Store', async () => {
  const reader = { openSession: vi.fn().mockResolvedValue(undefined), closeSession: vi.fn() }
  const store = createTabStore({ reader, createTabId: createTabIdFactory() })

  await expect(store.getState().openDocument('C:\\Books\\guide.pdf')).resolves.toBe('tab-1')

  expect(reader.openSession).toHaveBeenCalledWith('tab-1', 'C:\\Books\\guide.pdf')
  expect(store.getState()).toMatchObject({ activeTabId: 'tab-1' })
  expect(store.getState().tabs).toEqual([
    { id: 'home', kind: 'home', title: '开始页', closable: false },
    { id: 'tab-1', kind: 'document', title: 'guide.pdf', path: 'C:\\Books\\guide.pdf', closable: true }
  ])
})

test('文档标签最多二十个，达到上限不再创建或加载会话', async () => {
  const reader = { openSession: vi.fn().mockResolvedValue(undefined), closeSession: vi.fn() }
  const store = createTabStore({ reader, createTabId: createTabIdFactory() })

  for (let index = 1; index <= 20; index += 1) {
    await store.getState().openDocument(`C:\\Books\\book-${index}.pdf`)
  }

  await expect(store.getState().openDocument('C:\\Books\\over-limit.pdf')).resolves.toBeNull()
  expect(store.getState().tabs).toHaveLength(21)
  expect(reader.openSession).toHaveBeenCalledTimes(20)
})

test('关闭文档会先释放阅读会话，关闭当前标签后回退到剩余最后标签', async () => {
  const reader = { openSession: vi.fn().mockResolvedValue(undefined), closeSession: vi.fn() }
  const store = createTabStore({ reader, createTabId: createTabIdFactory() })

  await store.getState().openDocument('C:\\Books\\first.pdf')
  await store.getState().openDocument('C:\\Books\\second.pdf')
  store.getState().closeTab('tab-2')
  store.getState().closeTab('home')

  expect(reader.closeSession).toHaveBeenCalledWith('tab-2')
  expect(store.getState()).toMatchObject({ activeTabId: 'tab-1' })
  expect(store.getState().tabs.map((tab) => tab.id)).toEqual(['home', 'tab-1'])
})

test('加载中关闭标签后，打开动作不返回已经失效的标签编号', async () => {
  const pending = createDeferred<void>()
  const reader = { openSession: vi.fn().mockReturnValue(pending.promise), closeSession: vi.fn() }
  const store = createTabStore({ reader, createTabId: createTabIdFactory() })

  const opening = store.getState().openDocument('C:\\Books\\guide.pdf')
  store.getState().closeTab('tab-1')
  pending.resolve()

  await expect(opening).resolves.toBeNull()
  expect(store.getState().tabs.map((tab) => tab.id)).toEqual(['home'])
})

test('激活未知标签和关闭非当前标签不会改变当前选择', async () => {
  const reader = { openSession: vi.fn().mockResolvedValue(undefined), closeSession: vi.fn() }
  const store = createTabStore({ reader, createTabId: createTabIdFactory() })

  await store.getState().openDocument('C:\\Books\\first.pdf')
  await store.getState().openDocument('C:\\Books\\second.pdf')
  store.getState().activateTab('missing-tab')
  store.getState().closeTab('tab-1')

  expect(reader.closeSession).toHaveBeenCalledWith('tab-1')
  expect(store.getState().activeTabId).toBe('tab-2')
})
