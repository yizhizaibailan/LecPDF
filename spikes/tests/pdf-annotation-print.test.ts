import { PDFDocument, PDFName } from 'pdf-lib';
import { writeFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { composePdfWithAnnotations } from '../labs/pdf-annotations-print/print-composer';
import { inspectAnnotationAppearances } from '../labs/pdf-annotations-print/pdf-inspector';

async function makeAnnotatedPdf(withAppearance: boolean): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const annotation = pdf.context.obj({
    Type: 'Annot',
    Subtype: 'Highlight',
    Rect: [72, 680, 240, 700],
    ...(withAppearance ? { AP: { N: pdf.context.formXObject([], { BBox: [0, 0, 1, 1] }) } } : {}),
  });
  const ref = pdf.context.register(annotation);
  page.node.set(PDFName.of('Annots'), pdf.context.obj([ref]));
  return pdf.save();
}

describe('inspectAnnotationAppearances', () => {
  it('counts annotations and their appearance streams', async () => {
    const report = await inspectAnnotationAppearances(await makeAnnotatedPdf(true));

    expect(report.annotationCount).toBe(1);
    expect(report.appearanceCount).toBe(1);
    expect(report.subtypes).toEqual(['Highlight']);
  });

  it('reports imported annotations that are missing an appearance stream', async () => {
    const report = await inspectAnnotationAppearances(await makeAnnotatedPdf(false));

    expect(report.annotationCount).toBe(1);
    expect(report.appearanceCount).toBe(0);
    expect(report.subtypes).toEqual(['Highlight']);
  });
});

it('keeps the source page size when composing a printable annotation layer', async () => {
  const source = await makeAnnotatedPdf(false);
  const base = { pageIndex: 0, color: '#fadb14', opacity: 1, createdAt: '2026-08-29T00:00:00.000Z', updatedAt: '2026-08-29T00:00:00.000Z' };
  const output = await composePdfWithAnnotations(source, [
    { ...base, id: 'highlight', type: 'highlight', quads: [[0.1, 0.8, 0.4, 0.8, 0.1, 0.77, 0.4, 0.77]], quote: 'highlight' },
    { ...base, id: 'underline', type: 'underline', quads: [[0.1, 0.72, 0.4, 0.72, 0.1, 0.69, 0.4, 0.69]], quote: 'underline' },
    { ...base, id: 'strikeout', type: 'strikeout', quads: [[0.1, 0.64, 0.4, 0.64, 0.1, 0.61, 0.4, 0.61]], quote: 'strikeout' },
    { ...base, id: 'squiggly', type: 'squiggly', quads: [[0.1, 0.56, 0.4, 0.56, 0.1, 0.53, 0.4, 0.53]], quote: 'squiggly' },
    { ...base, id: 'note', type: 'note', point: { x: 0.5, y: 0.5 }, body: 'printable note' },
    { ...base, id: 'free-text', type: 'freeText', rect: { x: 0.1, y: 0.32, width: 0.3, height: 0.08 }, body: 'free text', fontSize: 12 },
    { ...base, id: 'ink', type: 'ink', paths: [[{ x: 0.1, y: 0.18 }, { x: 0.4, y: 0.1 }]], strokeWidth: 2 },
  ]);
  await writeFile('results/pdf-annotations-print-composer.pdf', output);
  const document = await PDFDocument.load(output);

  expect(document.getPageCount()).toBe(1);
  expect(document.getPage(0).getSize()).toEqual({ width: 612, height: 792 });
  expect(output.byteLength).toBeGreaterThan(source.byteLength);
});
