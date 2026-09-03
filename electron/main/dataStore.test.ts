import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import { DataStore } from './dataStore'

const testRoots: string[] = []

async function createStore(fileSystem?: ConstructorParameters<typeof DataStore>[1]): Promise<DataStore> {
  const root = await mkdtemp(join(tmpdir(), 'lecpdf-data-store-'))
  testRoots.push(root)
  return new DataStore(root, fileSystem)
}

afterEach(async () => {
  await Promise.all(testRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })))
})

test('writes JSON atomically and reads the committed document back', async () => {
  const store = await createStore()

  await store.writeJson('config.json', { version: 1, language: 'zh-CN' })

  await expect(store.readJson<{ version: number; language: string }>('config.json')).resolves.toEqual({ version: 1, language: 'zh-CN' })
  await expect(readdir(store.rootPath)).resolves.toEqual(['config.json'])
})

test('serializes concurrent writes to the same document', async () => {
  const store = await createStore()

  await Promise.all([
    store.writeJson('library.json', { revision: 1 }),
    store.writeJson('library.json', { revision: 2 })
  ])

  await expect(store.readJson<{ revision: number }>('library.json')).resolves.toEqual({ revision: 2 })
})

test('reports corrupted JSON instead of returning partial data', async () => {
  const store = await createStore()
  await writeFile(join(store.rootPath, 'runtime.json'), '{not-json}', 'utf8')

  await expect(store.readJson('runtime.json')).rejects.toThrow('无法解析 JSON')
})

test('removes its temporary file when an atomic write fails', async () => {
  const store = await createStore({
    writeFile: async () => {
      throw new Error('disk full')
    }
  })

  await expect(store.writeJson('data/example.json', { version: 1 })).rejects.toThrow('disk full')
  await expect(readdir(join(store.rootPath, 'data'))).resolves.toEqual([])
})

test('resolves document paths beneath the configured user-data root only', async () => {
  const store = await createStore()

  expect(store.resolvePath('data/example.json')).toBe(join(store.rootPath, 'data', 'example.json'))
  expect(() => store.resolvePath('../outside.json')).toThrow('超出用户数据目录')
})
/** 覆盖 JSON 数据仓库的原子读写与损坏文件处理。 */
