import { PDFDocument, rgb } from 'pdf-lib';
import { normalizedToPage, type PdfRotation } from './coordinates';
import type { PdfAnnotationRecord } from './model';

function color(hex: string) {
  return rgb(Number.parseInt(hex.slice(1, 3), 16) / 255, Number.parseInt(hex.slice(3, 5), 16) / 255, Number.parseInt(hex.slice(5, 7), 16) / 255);
}

function rotation(angle: number): PdfRotation {
  return angle === 90 || angle === 180 || angle === 270 ? angle : 0;
}

/** Builds a static print PDF: the original pages remain untouched and sidecar annotations are drawn as a new visible layer. */
export async function composePdfWithAnnotations(source: Uint8Array, records: PdfAnnotationRecord[]): Promise<Uint8Array> {
  const document = await PDFDocument.load(source);
  for (const record of records) {
    const page = document.getPages()[record.pageIndex];
    if (!page) continue;
    const space = { ...page.getSize(), rotation: rotation(page.getRotation().angle) };
    const paint = color(record.color);
    const options = { color: paint, opacity: record.opacity };

    if (record.type === 'note') {
      const [x, y] = normalizedToPage([record.point.x, record.point.y], space);
      page.drawCircle({ x, y, size: 7, borderColor: paint, borderWidth: 1, opacity: record.opacity });
      page.drawText(record.body, { x: x + 9, y: y + 3, size: 9, ...options });
    } else if (record.type === 'freeText') {
      const [x, y, right, top] = normalizedToPage([record.rect.x, record.rect.y, record.rect.x + record.rect.width, record.rect.y + record.rect.height], space);
      page.drawRectangle({ x, y, width: right - x, height: top - y, borderColor: paint, borderWidth: 1, opacity: record.opacity });
      page.drawText(record.body, { x: x + 3, y: top - record.fontSize - 3, size: record.fontSize, ...options });
    } else if (record.type === 'ink') {
      for (const path of record.paths) for (let i = 1; i < path.length; i += 1) {
        const [startX, startY] = normalizedToPage([path[i - 1].x, path[i - 1].y], space);
        const [endX, endY] = normalizedToPage([path[i].x, path[i].y], space);
        page.drawLine({ start: { x: startX, y: startY }, end: { x: endX, y: endY }, color: paint, thickness: record.strokeWidth, opacity: record.opacity });
      }
    } else {
      for (const quad of record.quads) {
        const points = normalizedToPage(quad, space);
        const xs = [points[0], points[2], points[4], points[6]];
        const ys = [points[1], points[3], points[5], points[7]];
        const x = Math.min(...xs); const y = Math.min(...ys); const width = Math.max(...xs) - x; const height = Math.max(...ys) - y;
        if (record.type === 'highlight') page.drawRectangle({ x, y, width, height, ...options });
        else page.drawLine({ start: { x, y: record.type === 'underline' ? y : y + height / 2 }, end: { x: x + width, y: record.type === 'underline' ? y : y + height / 2 }, color: paint, thickness: 1.5, opacity: record.opacity });
      }
    }
  }
  return document.save();
}
