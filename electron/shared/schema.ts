/**
 * 定义应用持久化数据的版本化结构；通过判别联合和明确字段约束让主进程与渲染层以同一格式读写配置、索引和 sidecar。
 */
export const CURRENT_SCHEMA_VERSION = 1

export type UnixTimestamp = number
export type FileKind = 'pdf' | 'epub'
export type ApplicationTheme = 'light' | 'dark' | 'system'
export type EpubTheme = 'light' | 'sepia' | 'dark'
export type ReaderLayout = 'single' | 'continuous' | 'double'

export type NormalizedPoint = {
  x: number
  y: number
}

export type NormalizedRect = NormalizedPoint & {
  w: number
  h: number
}

export type DocumentLocation =
  | { page: number; epubCfi: null }
  | { page: null; epubCfi: string }

export type AnnotationBase = {
  id: string
  loc: DocumentLocation
  quote: string
  color: string
  createdAt: UnixTimestamp
  updatedAt: UnixTimestamp
}

export type TextMarkupAnnotation = AnnotationBase & {
  type: 'highlight' | 'underline' | 'strikeout' | 'squiggly'
  rects: NormalizedRect[]
}

export type NoteAnnotation = AnnotationBase & {
  type: 'note'
  point: NormalizedPoint
  body: string
}

export type FreeTextAnnotation = AnnotationBase & {
  type: 'freetext'
  rect: NormalizedRect
  body: string
}

export type InkAnnotation = AnnotationBase & {
  type: 'ink'
  ink: NormalizedPoint[][]
}

export type UnifiedAnnotation = TextMarkupAnnotation | NoteAnnotation | FreeTextAnnotation | InkAnnotation

export type AnnotationColors = Record<UnifiedAnnotation['type'], string>

export type Config = {
  version: number
  language: 'zh-CN' | 'en-US'
  appearance: {
    theme: ApplicationTheme
  }
  reading: {
    defaultZoom: number
    defaultLayout: ReaderLayout
    pdfNightMode: boolean
    pageAnimation: boolean
  }
  annotation: {
    defaultColors: AnnotationColors
  }
  shortcuts: {
    open: string
    closeTab: string
    search: string
    highlight: string
    underline: string
    strikeout: string
    squiggly: string
    note: string
    ink: string
    fullscreen: string
    print: string
    undo: string
    redo: string
    zoomIn: string
    zoomOut: string
    zoomReset: string
  }
  general: {
    launchAtStartup: boolean
    autoBackup: {
      enabled: boolean
      intervalDays: number
      keep: number
    }
  }
  window: {
    bounds: {
      x: number
      y: number
      width: number
      height: number
    }
    maximized: boolean
  }
}

export type ReadingProgress = {
  page: number | null
  chapter: string | null
  percent: number
}

export type LibraryFile = {
  kind: FileKind
  name: string
  size: number
  mtime: UnixTimestamp
  addedAt: UnixTimestamp
  pageCount: number | null
  missing: boolean
}

export type Library = {
  version: number
  recent: Array<{
    path: string
    openedAt: UnixTimestamp
    progress: ReadingProgress
  }>
  starred: string[]
  folders: string[]
  files: Record<string, LibraryFile>
}

export type BookProgress = {
  page: number | null
  epubCfi: string | null
  scrollTop: number
  percent: number
  zoom: number
  layout: ReaderLayout
  updatedAt: UnixTimestamp
}

export type Bookmark = {
  id: string
  name: string
  loc: DocumentLocation
  createdAt: UnixTimestamp
}

export type EpubSettings = {
  fontSize: number
  lineHeight: number
  margin: number
  theme: EpubTheme
}

export type TtsSettings = {
  rate: number
  voice: string | null
  lang: string
}

type SidecarBase = {
  version: number
  path: string
  book: {
    progress: BookProgress
  }
  annotations: UnifiedAnnotation[]
  bookmarks: Bookmark[]
}

export type PdfSidecar = SidecarBase & {
  kind: 'pdf'
  epubSettings: null
  tts: null
}

export type EpubSidecar = SidecarBase & {
  kind: 'epub'
  epubSettings: EpubSettings
  tts: TtsSettings
}

export type Sidecar = PdfSidecar | EpubSidecar

export type RuntimeMark = {
  version: number
  cleanExit: boolean
  lastTabPaths: string[]
  startedAt: UnixTimestamp
}

export type BackupManifest = {
  app: 'LecPDF'
  version: number
  exportedAt: UnixTimestamp
}
