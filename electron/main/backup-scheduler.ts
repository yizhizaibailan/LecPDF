/**
 * 按配置周期触发自动备份；通过替换旧定时器和限制运行状态避免重复调度。
 */
import type { Config } from '../shared/schema'

export type BackupTimerPort = {
  setTimeout(callback: () => void, delay: number): unknown
  clearTimeout(timerId: unknown): void
}

export type BackupRunner = {
  runBackup(keep: number): Promise<unknown>
}

export type BackupSchedule = Config['general']['autoBackup']

const dayInMilliseconds = 24 * 60 * 60 * 1000
const defaultTimer: BackupTimerPort = {
  setTimeout,
  clearTimeout(timerId) {
    clearTimeout(timerId as NodeJS.Timeout)
  }
}

export class BackupScheduler {
  private timerId: unknown = null
  private scheduleVersion = 0
  private schedule: BackupSchedule | null = null

  constructor(private readonly runner: BackupRunner, private readonly timer: BackupTimerPort = defaultTimer) {}

  configure(schedule: BackupSchedule): void {
    this.scheduleVersion += 1
    this.clearPendingTimer()
    this.schedule = { ...schedule }

    if (schedule.enabled && schedule.intervalDays > 0) {
      this.scheduleNext(this.scheduleVersion)
    }
  }

  stop(): void {
    this.scheduleVersion += 1
    this.clearPendingTimer()
    this.schedule = null
  }

  private scheduleNext(scheduleVersion: number): void {
    const schedule = this.schedule
    if (schedule === null || !schedule.enabled || schedule.intervalDays <= 0) {
      return
    }

    this.timerId = this.timer.setTimeout(() => {
      this.timerId = null
      void this.runThenSchedule(scheduleVersion, schedule.keep)
    }, schedule.intervalDays * dayInMilliseconds)
  }

  private async runThenSchedule(scheduleVersion: number, keep: number): Promise<void> {
    await this.runner.runBackup(keep).catch(() => undefined)
    if (scheduleVersion === this.scheduleVersion) {
      this.scheduleNext(scheduleVersion)
    }
  }

  private clearPendingTimer(): void {
    if (this.timerId !== null) {
      this.timer.clearTimeout(this.timerId)
      this.timerId = null
    }
  }
}
