import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import { DataStore } from './dataStore'
import { SchemaMigrator, loadMigratedDocument } from './schemaMigration'

type ExampleDocument = {
  version: number
  title?: string
  name?: string
}

const testRoots: string[] = []

async function createStore(): Promise<DataStore> {
  const root = await mkdtemp(join(tmpdir(), 'lecpdf-schema-migration-'))
  testRoots.push(root)
  return new DataStore(root)
}

afterEach(async () => {
  await Promise.all(testRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })))
})

test('migrates a v0 document through the declared v0-to-v1 chain and persists it', async () => {
  const store = await createStore()
  const migrator = new SchemaMigrator<ExampleDocument>(1, {
    0: (document) => ({ version: 1, title: document.name ?? '未命名' })
  })
  await store.writeJson('config.json', { version: 0, name: '旧配置' })

  const result = await loadMigratedDocument(store, 'config.json', migrator)

  expect(result).toEqual({ mode: 'readWrite', migrated: true, document: { version: 1, title: '旧配置' } })
  await expect(store.readJson('config.json')).resolves.toEqual({ version: 1, title: '旧配置' })
})

test('returns a read-only result for a document from a newer schema version', () => {
  const migrator = new SchemaMigrator<ExampleDocument>(1, {})

  expect(migrator.migrate({ version: 99, title: '未来配置' })).toEqual({
    mode: 'readOnly',
    document: { version: 99, title: '未来配置' },
    reason: '检测到较新版本的数据，已进入只读保护'
  })
})

test('leaves the stored source unchanged when a migration step fails', async () => {
  const store = await createStore()
  const sourcePath = join(store.rootPath, 'library.json')
  const original = '{\n  "version": 0,\n  "name": "不能丢失"\n}'
  const migrator = new SchemaMigrator<ExampleDocument>(1, {
    0: () => {
      throw new Error('迁移失败')
    }
  })
  await writeFile(sourcePath, original, 'utf8')

  await expect(loadMigratedDocument(store, 'library.json', migrator)).rejects.toThrow('迁移失败')
  await expect(readFile(sourcePath, 'utf8')).resolves.toBe(original)
})
/** 覆盖持久化 schema 的迁移链与未知版本保护。 */
