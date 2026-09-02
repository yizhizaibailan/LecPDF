/**
 * 按版本迁移已持久化 JSON；通过拒绝未知未来版本保护用户数据不被旧程序覆盖。
 */
import { DataStore } from './dataStore'

export type VersionedDocument = {
  version: number
}

export type Migration<T extends VersionedDocument> = (document: T) => T

export type MigrationResult<T extends VersionedDocument> =
  | {
      mode: 'readWrite'
      migrated: boolean
      document: T
    }
  | {
      mode: 'readOnly'
      document: T
      reason: '检测到较新版本的数据，已进入只读保护'
    }

export class SchemaMigrator<T extends VersionedDocument> {
  constructor(
    private readonly currentVersion: number,
    private readonly migrations: Partial<Record<number, Migration<T>>>
  ) {}

  migrate(document: T): MigrationResult<T> {
    if (document.version > this.currentVersion) {
      return {
        mode: 'readOnly',
        document,
        reason: '检测到较新版本的数据，已进入只读保护'
      }
    }

    let current = structuredClone(document)
    let migrated = false

    while (current.version < this.currentVersion) {
      const sourceVersion = current.version
      const migration = this.migrations[sourceVersion]

      if (!migration) {
        throw new Error(`缺少 v${sourceVersion} 到 v${sourceVersion + 1} 的迁移器`)
      }

      const next = migration(structuredClone(current))

      if (next.version !== sourceVersion + 1) {
        throw new Error(`迁移器必须将版本从 v${sourceVersion} 升级到 v${sourceVersion + 1}`)
      }

      current = next
      migrated = true
    }

    return { mode: 'readWrite', migrated, document: current }
  }
}

export async function loadMigratedDocument<T extends VersionedDocument>(
  dataStore: DataStore,
  relativePath: string,
  migrator: SchemaMigrator<T>
): Promise<MigrationResult<T> | null> {
  const document = await dataStore.readJson<T>(relativePath)

  if (!document) {
    return null
  }

  const result = migrator.migrate(document)

  if (result.mode === 'readWrite' && result.migrated) {
    await dataStore.writeJson(relativePath, result.document)
  }

  return result
}
