/**
 * 记录本次运行是否正常结束及打开文档列表；通过 DataStore 持久化为下次启动的恢复决策提供依据。
 */
import { CURRENT_SCHEMA_VERSION, type RuntimeMark } from '../shared/schema'
import { DataStore } from './dataStore'

const RUNTIME_MARK_PATH = 'runtime.json'

export type CrashRecovery = {
  needsRecovery: boolean
  lastTabPaths: string[]
}

export class CrashMarker {
  private runtime: RuntimeMark | null = null

  constructor(
    private readonly dataStore: DataStore,
    private readonly now: () => number = () => Math.floor(Date.now() / 1000)
  ) {}

  async start(initialTabPaths: string[] = []): Promise<CrashRecovery> {
    const previousRuntime = await this.dataStore.readJson<RuntimeMark>(RUNTIME_MARK_PATH)
    const recoveryPaths = previousRuntime?.cleanExit === false ? previousRuntime.lastTabPaths : []

    this.runtime = {
      version: CURRENT_SCHEMA_VERSION,
      cleanExit: false,
      lastTabPaths: uniquePaths(initialTabPaths),
      startedAt: this.now()
    }
    await this.persist()

    return {
      needsRecovery: previousRuntime?.cleanExit === false,
      lastTabPaths: recoveryPaths
    }
  }

  async recordOpenTabPaths(paths: string[]): Promise<void> {
    const runtime = this.requireRuntime()
    this.runtime = { ...runtime, lastTabPaths: uniquePaths(paths) }
    await this.persist()
  }

  async markCleanExit(): Promise<void> {
    const runtime = this.requireRuntime()
    this.runtime = { ...runtime, cleanExit: true }
    await this.persist()
  }

  private requireRuntime(): RuntimeMark {
    if (this.runtime === null) {
      throw new Error('崩溃标记尚未启动')
    }

    return this.runtime
  }

  private async persist(): Promise<void> {
    await this.dataStore.writeJson(RUNTIME_MARK_PATH, this.requireRuntime())
  }
}

function uniquePaths(paths: string[]): string[] {
  return [...new Set(paths)]
}
