import { PDFArray, PDFDict, PDFDocument, PDFName } from 'pdf-lib';

export interface AnnotationAppearanceReport {
  annotationCount: number;
  appearanceCount: number;
  subtypes: string[];
}

/**
 * Inspects annotation dictionaries in a saved PDF. This deliberately reads
 * PDF objects instead of scanning bytes, so content text cannot be mistaken
 * for an annotation or an appearance stream.
 */
export async function inspectAnnotationAppearances(bytes: Uint8Array): Promise<AnnotationAppearanceReport> {
  const document = await PDFDocument.load(bytes);
  let annotationCount = 0;
  let appearanceCount = 0;
  const subtypes: string[] = [];

  for (const page of document.getPages()) {
    const annotations = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
    if (!annotations) continue;

    for (let index = 0; index < annotations.size(); index += 1) {
      const annotation = annotations.lookup(index, PDFDict);
      annotationCount += 1;
      if (annotation.has(PDFName.of('AP'))) appearanceCount += 1;
      const subtype = annotation.lookupMaybe(PDFName.of('Subtype'), PDFName);
      if (subtype) subtypes.push(subtype.asString().replace(/^\//, ''));
    }
  }

  return { annotationCount, appearanceCount, subtypes };
}
