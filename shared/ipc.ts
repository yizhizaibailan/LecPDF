import type { BackupManifest, Config, FileKind, Library, LibraryFile, RuntimeMark, Sidecar } from './schema'

export const IPC_API_GROUPS = [
  'window',
  'dialogs',
  'fs',
  'library',
  'fileRead',
  'data',
  'backup',
  'update',
  'lifecycle'
] as const

export type IpcApiGroup = (typeof IPC_API_GROUPS)[number]
export type Unsubscribe = () => void

export const WINDOW_IPC_CHANNELS = {
  minimize: 'lec:window:minimize',
  toggleMaximize: 'lec:window:toggle-maximize',
  close: 'lec:window:close',
  maximizedChange: 'lec:window:maximized-change'
} as const

export const LIFECYCLE_IPC_CHANNELS = {
  openFileRequest: 'lec:lifecycle:open-file-request'
} as const

export const FILE_READ_IPC_CHANNELS = {
  getPdfUrl: 'lec:file-read:get-pdf-url'
} as const

export const LIBRARY_IPC_CHANNELS = {
  scanFolders: 'lec:library:scan-folders'
} as const

export const BACKUP_IPC_CHANNELS = {
  runBackup: 'lec:backup:run',
  exportData: 'lec:backup:export',
  importData: 'lec:backup:import'
} as const

export const UPDATE_IPC_CHANNELS = { checkForUpdates: 'lec:update:check' } as const
export const DATA_IPC_CHANNELS = { readJson: 'lec:data:read-json', writeJson: 'lec:data:write-json' } as const
export const SIDECAR_IPC_CHANNELS = { read: 'lec:sidecar:read', write: 'lec:sidecar:write' } as const

export type PersistedDocument = Config | Library | RuntimeMark | Sidecar
export type PersistedDocumentPath = 'config' | 'library' | 'runtime' | `data/${string}`

export type FileStat = {
  path: string
  kind: FileKind | null
  size: number
  mtime: number
  exists: boolean
}

export type FileIndexEntry = LibraryFile & {
  path: string
}

export type BackupResult = {
  path: string
  manifest: BackupManifest
}

export type ImportResult = {
  importedPaths: string[]
  missingPaths: string[]
}

export type ConfigImportMode = 'overwrite' | 'skip'

export type UpdateCheckResult = {
  available: boolean
  currentVersion: string
  latestVersion: string | null
  releaseNotes: string | null
  downloadUrl: string | null
}

export interface LecApi {
  readonly app: Readonly<{
    version: string
  }>
  readonly window: Readonly<{
    minimize(): Promise<void>
    toggleMaximize(): Promise<void>
    close(): Promise<void>
    onMaximizedChange(listener: (maximized: boolean) => void): Unsubscribe
  }>
  readonly dialogs: Readonly<{
    openDocuments(): Promise<string[]>
    openFolder(): Promise<string | null>
    locateMissingFile(path: string): Promise<string | null>
  }>
  readonly fs: Readonly<{
    stat(path: string): Promise<FileStat>
    trashItem(path: string): Promise<void>
    getCacheSize(): Promise<number>
    clearCache(): Promise<void>
  }>
  readonly library: Readonly<{
    scanFolders(paths: string[]): Promise<FileIndexEntry[]>
  }>
  readonly fileRead: Readonly<{
    readBuffer(path: string): Promise<ArrayBuffer>
    getPdfUrl(path: string): Promise<string>
  }>
  readonly data: Readonly<{
    readJson<T extends PersistedDocument>(path: PersistedDocumentPath): Promise<T | null>
    writeJson<T extends PersistedDocument>(path: PersistedDocumentPath, document: T): Promise<void>
  }>
  readonly sidecar: Readonly<{
    read(path: string): Promise<Sidecar | null>
    write(sidecar: Sidecar): Promise<void>
  }>
  readonly backup: Readonly<{
    runBackup(): Promise<BackupResult>
    exportData(): Promise<BackupResult | null>
    importData(sourcePath: string, configMode?: ConfigImportMode): Promise<ImportResult>
  }>
  readonly update: Readonly<{
    checkForUpdates(): Promise<UpdateCheckResult>
  }>
  readonly lifecycle: Readonly<{
    onOpenFileRequest(listener: (path: string) => void): Unsubscribe
    openLogsFolder(): Promise<void>
  }>
}
