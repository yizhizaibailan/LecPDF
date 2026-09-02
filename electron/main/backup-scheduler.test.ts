import { expect, test, vi } from 'vitest'
import { BackupScheduler, type BackupTimerPort } from './backup-scheduler'

test('runs a backup on the configured interval and carries the retention setting', async () => {
  const scheduled: Array<{ callback: () => void; delay: number }> = []
  const timer: BackupTimerPort = {
    setTimeout(callback, delay) {
      scheduled.push({ callback, delay })
      return scheduled.length
    },
    clearTimeout: () => undefined
  }
  const retentionCounts: number[] = []
  const scheduler = new BackupScheduler({ runBackup: async (keep) => { retentionCounts.push(keep) } }, timer)

  scheduler.configure({ enabled: true, intervalDays: 2, keep: 5 })
  scheduled[0].callback()

  await vi.waitFor(() => {
    expect(retentionCounts).toEqual([5])
    expect(scheduled.map((task) => task.delay)).toEqual([172_800_000, 172_800_000])
  })
})

test('cancels the prior schedule when automatic backup is disabled or its interval changes', () => {
  const cleared: unknown[] = []
  const timer: BackupTimerPort = {
    setTimeout: () => 7,
    clearTimeout: (timerId) => { cleared.push(timerId) }
  }
  const scheduler = new BackupScheduler({ runBackup: async () => undefined }, timer)

  scheduler.configure({ enabled: true, intervalDays: 7, keep: 3 })
  scheduler.configure({ enabled: true, intervalDays: 1, keep: 3 })
  scheduler.configure({ enabled: false, intervalDays: 1, keep: 3 })

  expect(cleared).toEqual([7, 7])
})
