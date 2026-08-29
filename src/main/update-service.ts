import type { UpdateCheckResult } from '../../shared/ipc'

export type UpdateClient = {
  checkForUpdates(): Promise<{ updateInfo: { version: string; releaseNotes?: string | Array<{ note: string | null }> | null } } | null>
}

export class UpdateService {
  constructor(private readonly currentVersion: string, private readonly client: UpdateClient) {}

  async checkForUpdates(): Promise<UpdateCheckResult> {
    const result = await this.client.checkForUpdates()
    const latestVersion = result?.updateInfo.version ?? null
    return {
      available: latestVersion !== null && latestVersion !== this.currentVersion,
      currentVersion: this.currentVersion,
      latestVersion,
      releaseNotes: formatReleaseNotes(result?.updateInfo.releaseNotes),
      downloadUrl: null
    }
  }
}

function formatReleaseNotes(releaseNotes: string | Array<{ note: string | null }> | null | undefined): string | null {
  if (Array.isArray(releaseNotes)) return releaseNotes.map((note) => note.note).filter((note): note is string => note !== null).join('\n')
  return releaseNotes ?? null
}
