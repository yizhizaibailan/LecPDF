import type { EpubSettings, ReaderLayout, UnifiedAnnotation } from '../../../shared/schema'

export type EngineKind = 'pdf' | 'epub'
export type LayoutMode = ReaderLayout
export type ViewRotation = 0 | 90 | 180 | 270
export type LocationRef = { page: number | null; chapter: string | null; epubCfi: string | null; percent: number }
export type FileSource = { path: string; kind: EngineKind; url?: string; buffer?: ArrayBuffer; password?: () => Promise<string | null> }
export type DocMeta = { title: string; pageCount: number | null; chapters: number | null }
export type OutlineNode = { id: string; title: string; location: LocationRef; children: OutlineNode[]; active: boolean }
export type SearchHit = { id: string; location: LocationRef; excerpt: string; index: number }
export type SelectionRef = { text: string; location: LocationRef; anchor: string }
export type AnnotationDraft = { type: UnifiedAnnotation['type']; color: string; selection?: SelectionRef; body?: string }
export type EngineAnchor = { id: string; value: string }
export type EngineAnnotation = { id: string; anchor: EngineAnchor; draft: AnnotationDraft }
export type TtsController = { play(): void; pause(): void; stop(): void; setRate(rate: number): void }

export interface ReaderEngine {
  readonly kind: EngineKind
  open(source: FileSource): Promise<DocMeta>
  close(): void
  readonly layout: { setMode(mode: LayoutMode): void }
  readonly view: { zoom(value: number): void; rotate(degrees: ViewRotation): void; goto(location: LocationRef): void; getPosition(): LocationRef; setNightMode(enabled: boolean): void }
  outline(): OutlineNode[]
  readonly thumbs?: { count(): number; renderPage(index: number): Promise<Blob> }
  search(query: string, options?: { caseSensitive?: boolean }): SearchHit[]
  readonly selection: { onSelect(listener: (selection: SelectionRef) => void): () => void; getText(selection: SelectionRef): string }
  readonly annotations: { apply(draft: AnnotationDraft): EngineAnchor; list(): EngineAnnotation[]; update(id: string, patch: Partial<AnnotationDraft>): void; remove(id: string): void; serialize(annotation: EngineAnnotation): UnifiedAnnotation }
  readonly tts?: TtsController
  applySettings?(settings: EpubSettings): void
}
