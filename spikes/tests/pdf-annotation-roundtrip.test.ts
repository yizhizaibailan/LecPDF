import { describe, expect, it } from 'vitest';
import {
  EmbedPdfAnnotationAdapter,
  taskToPromise,
  type AnnotationEngineApi,
  type EngineTransferItem,
} from '../labs/pdf-annotations-print/embedpdf-adapter';
import { assertPdfAnnotationRecords, type PdfAnnotationRecord } from '../labs/pdf-annotations-print/model';

function makeSevenFixtureAnnotations(): PdfAnnotationRecord[] {
  const base = {
    pageIndex: 0,
    color: '#ffd54f',
    opacity: 0.75,
    createdAt: '2026-08-28T00:00:00.000Z',
    updatedAt: '2026-08-28T00:00:00.000Z',
  };
  return [
    { ...base, id: 'highlight', type: 'highlight', quads: [[0.1, 0.2, 0.4, 0.2, 0.1, 0.18, 0.4, 0.18]], quote: 'alpha' },
    { ...base, id: 'underline', type: 'underline', quads: [[0.1, 0.2, 0.4, 0.2, 0.1, 0.18, 0.4, 0.18]], quote: 'beta' },
    { ...base, id: 'strikeout', type: 'strikeout', quads: [[0.1, 0.2, 0.4, 0.2, 0.1, 0.18, 0.4, 0.18]], quote: 'gamma' },
    { ...base, id: 'squiggly', type: 'squiggly', quads: [[0.1, 0.2, 0.4, 0.2, 0.1, 0.18, 0.4, 0.18]], quote: 'delta' },
    { ...base, id: 'note', type: 'note', point: { x: 0.25, y: 0.75 }, body: 'note body' },
    { ...base, id: 'freeText', type: 'freeText', rect: { x: 0.25, y: 0.5, width: 0.25, height: 0.125 }, body: 'free text', fontSize: 12 },
    { ...base, id: 'ink', type: 'ink', paths: [[{ x: 0.25, y: 0.25 }, { x: 0.5, y: 0.375 }]], strokeWidth: 2 },
  ];
}

function makeFakeEngine(): AnnotationEngineApi {
  const store: EngineTransferItem[] = [];
  return {
    createAnnotation: () => undefined,
    updateAnnotation: () => undefined,
    deleteAnnotation: () => undefined,
    importAnnotations(items: EngineTransferItem[]): void {
      store.push(...items);
    },
    exportAnnotations: () => ({
      wait(ok: (value: EngineTransferItem[]) => void): void {
        ok(JSON.parse(JSON.stringify(store)) as EngineTransferItem[]);
      },
    }),
    commit: () => ({ wait(ok: (value: boolean) => void): void { ok(true); } }),
  };
}

const fixedPages = {
  getPageSpace: () => ({ width: 100, height: 100, rotation: 0 as const }),
};

describe('taskToPromise', () => {
  it('resolves with the task value', async () => {
    await expect(taskToPromise({ wait: (ok) => ok(42) })).resolves.toBe(42);
  });

  it('rejects with the task error', async () => {
    await expect(taskToPromise({ wait: (_ok, fail) => fail?.(new Error('boom')) })).rejects.toThrow('boom');
  });
});

describe('EmbedPdfAnnotationAdapter round trip', () => {
  it('round-trips all seven LecPDF annotation types through sidecar', async () => {
    const records = makeSevenFixtureAnnotations();
    assertPdfAnnotationRecords(records);
    const adapter = new EmbedPdfAnnotationAdapter(makeFakeEngine(), fixedPages);

    await adapter.importSidecar(records);
    const exported = await adapter.exportSidecar();

    assertPdfAnnotationRecords(exported);
    expect(exported).toEqual(records);
  });

  it('maps text markups to segment rects and note to TEXT subtype', async () => {
    const records = makeSevenFixtureAnnotations();
    const engine = makeFakeEngine();
    const adapter = new EmbedPdfAnnotationAdapter(engine, fixedPages);

    await adapter.importSidecar(records);
    const items = await taskToPromise(engine.exportAnnotations());

    const byId = new Map(items.map((item) => [item.annotation.id, item.annotation]));
    expect(byId.get('highlight')?.type).toBe(9);
    expect(byId.get('underline')?.type).toBe(10);
    expect(byId.get('strikeout')?.type).toBe(12);
    expect(byId.get('squiggly')?.type).toBe(11);
    expect(byId.get('note')?.type).toBe(1);
    expect(byId.get('freeText')?.type).toBe(3);
    expect(byId.get('ink')?.type).toBe(15);
  });
});
