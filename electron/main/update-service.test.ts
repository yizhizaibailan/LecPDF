import { expect, test } from 'vitest'
import { UpdateService } from './update-service'

test('returns available version information without downloading or installing it', async () => {
  let checks = 0
  const service = new UpdateService('0.1.0', { checkForUpdates: async () => { checks += 1; return { updateInfo: { version: '0.2.0', releaseNotes: '改进阅读体验' } } } })

  await expect(service.checkForUpdates()).resolves.toEqual({ available: true, currentVersion: '0.1.0', latestVersion: '0.2.0', releaseNotes: '改进阅读体验', downloadUrl: null })
  expect(checks).toBe(1)
})
