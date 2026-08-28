import { normalizedToPage, pageToNormalized, type PdfPageSpace } from './coordinates';
import { assertPdfAnnotationRecord, assertPdfAnnotationRecords, type PdfAnnotationRecord } from './model';

/** Mirror of `PdfAnnotationSubtype` in @embedpdf/models, kept local so unit tests stay engine-free. */
const SUBTYPE = {
  TEXT: 1,
  FREETEXT: 3,
  HIGHLIGHT: 9,
  UNDERLINE: 10,
  SQUIGGLY: 11,
  STRIKEOUT: 12,
  INK: 15,
} as const;

/** Half-size (in PDF points) of the rect synthesized around a sticky-note point. */
const NOTE_RECT_HALF = 9;

export interface PageSpaceProvider {
  getPageSpace(pageIndex: number): PdfPageSpace;
}

export interface EnginePosition {
  x: number;
  y: number;
}

export interface EngineRect {
  origin: EnginePosition;
  size: { width: number; height: number };
}

/**
 * Structural subset of @embedpdf/models annotation objects. Both the real
 * embedpdf `PdfAnnotationObject` union and unit-test fakes satisfy this shape.
 */
export interface EngineAnnotationObject {
  id: string;
  type: number;
  pageIndex: number;
  rect: EngineRect;
  contents?: string;
  strokeColor?: string;
  color?: string;
  opacity?: number;
  segmentRects?: EngineRect[];
  inkList?: Array<{ points: EnginePosition[] }>;
  strokeWidth?: number;
  fontSize?: number;
  fontColor?: string;
  fontFamily?: number;
  created?: Date | string;
  modified?: Date | string;
}

export interface EngineTransferItem {
  annotation: EngineAnnotationObject;
  ctx?: unknown;
}

export interface TaskLike<T> {
  wait(ok: (value: T) => void, fail: (error: unknown) => void): void;
}

/**
 * Structural subset of the embedpdf annotation capability. Real capability
 * objects satisfy it without adapter shims; tests provide fakes.
 */
export interface AnnotationEngineApi {
  importAnnotations(items: EngineTransferItem[]): void;
  exportAnnotations(): TaskLike<EngineTransferItem[]>;
  commit(): TaskLike<boolean>;
  createAnnotation(pageIndex: number, annotation: EngineAnnotationObject, ctx?: unknown): void;
  updateAnnotation(pageIndex: number, id: string, patch: Partial<EngineAnnotationObject>): void;
  deleteAnnotation(pageIndex: number, id: string): void;
}

export function taskToPromise<T>(task: TaskLike<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => task.wait(resolve, reject));
}

const TEXT_MARKUP_SUBTYPES: Record<'highlight' | 'underline' | 'strikeout' | 'squiggly', number> = {
  highlight: SUBTYPE.HIGHLIGHT,
  underline: SUBTYPE.UNDERLINE,
  strikeout: SUBTYPE.STRIKEOUT,
  squiggly: SUBTYPE.SQUIGGLY,
};

const SUBTYPE_TO_TEXT_MARKUP = new Map(
  Object.entries(TEXT_MARKUP_SUBTYPES).map(([type, subtype]) => [subtype, type]),
);

function toIso(value: Date | string | undefined): string {
  if (value === undefined) return new Date(0).toISOString();
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) return new Date(0).toISOString();
  return date.toISOString();
}

function toDate(value: string): Date {
  return new Date(value);
}

function quadToRect(points: number[], page: PdfPageSpace): EngineRect {
  const pagePoints = normalizedToPage(points, page);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let index = 0; index < pagePoints.length; index += 2) {
    xs.push(pagePoints[index]);
    ys.push(pagePoints[index + 1]);
  }
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { origin: { x: minX, y: minY }, size: { width: maxX - minX, height: maxY - minY } };
}

function rectToQuad(rect: EngineRect, page: PdfPageSpace): number[] {
  const { x, y } = rect.origin;
  const { width, height } = rect.size;
  const pagePoints = [x, y + height, x + width, y + height, x, y, x + width, y];
  return pageToNormalized(pagePoints, page);
}

function toEngineObject(record: PdfAnnotationRecord, page: PdfPageSpace): EngineAnnotationObject {
  const base = {
    id: record.id,
    pageIndex: record.pageIndex,
    opacity: record.opacity,
    created: toDate(record.createdAt),
    modified: toDate(record.updatedAt),
  };

  switch (record.type) {
    case 'highlight':
    case 'underline':
    case 'strikeout':
    case 'squiggly': {
      const segmentRects = record.quads.map((quad) => quadToRect(quad, page));
      const bounding = segmentRects.reduce<EngineRect>(
        (acc, rect) => {
          const minX = Math.min(acc.origin.x, rect.origin.x);
          const minY = Math.min(acc.origin.y, rect.origin.y);
          const maxX = Math.max(acc.origin.x + acc.size.width, rect.origin.x + rect.size.width);
          const maxY = Math.max(acc.origin.y + acc.size.height, rect.origin.y + rect.size.height);
          return { origin: { x: minX, y: minY }, size: { width: maxX - minX, height: maxY - minY } };
        },
        { ...segmentRects[0] },
      );
      return {
        ...base,
        type: TEXT_MARKUP_SUBTYPES[record.type],
        rect: bounding,
        contents: record.quote,
        strokeColor: record.color,
        segmentRects,
      };
    }

    case 'note': {
      const pagePoints = normalizedToPage([record.point.x, record.point.y], page);
      return {
        ...base,
        type: SUBTYPE.TEXT,
        rect: {
          origin: { x: pagePoints[0] - NOTE_RECT_HALF, y: pagePoints[1] - NOTE_RECT_HALF },
          size: { width: NOTE_RECT_HALF * 2, height: NOTE_RECT_HALF * 2 },
        },
        contents: record.body,
        strokeColor: record.color,
      };
    }

    case 'freeText': {
      const pageRect = normalizedToPage(
        [record.rect.x, record.rect.y, record.rect.x + record.rect.width, record.rect.y + record.rect.height],
        page,
      );
      return {
        ...base,
        type: SUBTYPE.FREETEXT,
        rect: {
          origin: { x: pageRect[0], y: pageRect[1] },
          size: { width: pageRect[2] - pageRect[0], height: pageRect[3] - pageRect[1] },
        },
        contents: record.body,
        fontSize: record.fontSize,
        fontColor: record.color,
      };
    }

    case 'ink': {
      const inkList = record.paths.map((path) => ({
        points: path.map((point) => {
          const [x, y] = normalizedToPage([point.x, point.y], page);
          return { x, y };
        }),
      }));
      const bounding = inkList.reduce<EngineRect | null>((acc, stroke) => {
        const xs = stroke.points.map((point) => point.x);
        const ys = stroke.points.map((point) => point.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);
        if (!acc) return { origin: { x: minX, y: minY }, size: { width: maxX - minX, height: maxY - minY } };
        const aMinX = Math.min(acc.origin.x, minX);
        const aMinY = Math.min(acc.origin.y, minY);
        const aMaxX = Math.max(acc.origin.x + acc.size.width, maxX);
        const aMaxY = Math.max(acc.origin.y + acc.size.height, maxY);
        return { origin: { x: aMinX, y: aMinY }, size: { width: aMaxX - aMinX, height: aMaxY - aMinY } };
      }, null);
      return {
        ...base,
        type: SUBTYPE.INK,
        rect: bounding ?? { origin: { x: 0, y: 0 }, size: { width: 0, height: 0 } },
        inkList,
        strokeWidth: record.strokeWidth,
        strokeColor: record.color,
      };
    }
  }
}

function fromEngineObject(object: EngineAnnotationObject, page: PdfPageSpace): PdfAnnotationRecord | null {
  const base = {
    id: object.id,
    pageIndex: object.pageIndex,
    color: object.strokeColor ?? object.fontColor ?? object.color ?? '#000000',
    opacity: typeof object.opacity === 'number' ? object.opacity : 1,
    createdAt: toIso(object.created ?? object.modified),
    updatedAt: toIso(object.modified ?? object.created),
  };

  const markupType = SUBTYPE_TO_TEXT_MARKUP.get(object.type);
  if (markupType) {
    const segmentRects = object.segmentRects ?? [];
    if (segmentRects.length === 0) return null;
    const quads = segmentRects.map((rect) => rectToQuad(rect, page));
    return { ...base, type: markupType as 'highlight' | 'underline' | 'strikeout' | 'squiggly', quads, quote: object.contents ?? '' };
  }

  if (object.type === SUBTYPE.TEXT) {
    const [x, y] = pageToNormalized(
      [object.rect.origin.x + object.rect.size.width / 2, object.rect.origin.y + object.rect.size.height / 2],
      page,
    );
    return { ...base, type: 'note', point: { x, y }, body: object.contents ?? '' };
  }

  if (object.type === SUBTYPE.FREETEXT) {
    const [x, y, right, top] = pageToNormalized(
      [object.rect.origin.x, object.rect.origin.y, object.rect.origin.x + object.rect.size.width, object.rect.origin.y + object.rect.size.height],
      page,
    );
    return {
      ...base,
      type: 'freeText',
      rect: { x, y, width: right - x, height: top - y },
      body: object.contents ?? '',
      fontSize: object.fontSize ?? 12,
    };
  }

  if (object.type === SUBTYPE.INK) {
    const paths = (object.inkList ?? [])
      .filter((stroke) => stroke.points.length >= 2)
      .map((stroke) => stroke.points.map((point) => {
        const [x, y] = pageToNormalized([point.x, point.y], page);
        return { x, y };
      }));
    if (paths.length === 0) return null;
    return { ...base, type: 'ink', paths, strokeWidth: object.strokeWidth ?? 1 };
  }

  return null;
}

/**
 * Bridges LecPDF sidecar records and the embedpdf annotation capability.
 * Engine transfer items never cross this boundary: only `PdfAnnotationRecord[]`
 * enters and leaves the adapter.
 */
export class EmbedPdfAnnotationAdapter {
  constructor(
    private readonly engine: AnnotationEngineApi,
    private readonly pages: PageSpaceProvider,
  ) {}

  async importSidecar(records: PdfAnnotationRecord[]): Promise<void> {
    assertPdfAnnotationRecords(records);
    const items: EngineTransferItem[] = records.map((record) => ({
      annotation: toEngineObject(record, this.pages.getPageSpace(record.pageIndex)),
    }));
    this.engine.importAnnotations(items);
    await taskToPromise(this.engine.commit());
  }

  async exportSidecar(): Promise<PdfAnnotationRecord[]> {
    const items = await taskToPromise(this.engine.exportAnnotations());
    const records: PdfAnnotationRecord[] = [];
    for (const item of items) {
      const record = fromEngineObject(item.annotation, this.pages.getPageSpace(item.annotation.pageIndex));
      if (!record) continue;
      try {
        assertPdfAnnotationRecord(record);
        records.push(record);
      } catch {
        // Unknown or malformed engine annotations are skipped, never silently mutated.
      }
    }
    return records;
  }
}
