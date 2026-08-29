import { PDFDocument, PDFName } from 'pdf-lib';
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
  const output = await composePdfWithAnnotations(source, [{
    id: 'note', type: 'note', pageIndex: 0, color: '#fadb14', opacity: 1,
    createdAt: '2026-08-29T00:00:00.000Z', updatedAt: '2026-08-29T00:00:00.000Z',
    point: { x: 0.5, y: 0.5 }, body: 'printable note',
  }]);
  const document = await PDFDocument.load(output);

  expect(document.getPageCount()).toBe(1);
  expect(document.getPage(0).getSize()).toEqual({ width: 612, height: 792 });
  expect(output.byteLength).toBeGreaterThan(source.byteLength);
});
