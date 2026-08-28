import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import manifest from '../fixtures/manifest.json';

describe('generated fixtures', () => {
  it('contains the four approved CC0 fixtures', () => {
    expect(manifest.files.map((entry) => entry.path)).toEqual([
      'text.pdf',
      'scanned.pdf',
      'mixed.pdf',
      'reflow.epub',
    ]);
    expect(manifest.files.every((entry) => entry.license === 'CC0-1.0')).toBe(true);
  });

  for (const entry of manifest.files) {
    it(`${entry.path} matches its manifest digest`, async () => {
      const bytes = await readFile(new URL(`../fixtures/${entry.path}`, import.meta.url));
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);
    });
  }

  it.each(['text.pdf', 'scanned.pdf', 'mixed.pdf'])('%s contains exactly three pages', async (path) => {
    const bytes = await readFile(new URL(`../fixtures/${path}`, import.meta.url));
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(3);
  });

  it('EPUB contains three ordered XHTML chapters and required boundary cases', async () => {
    const bytes = await readFile(new URL('../fixtures/reflow.epub', import.meta.url));
    const zip = await JSZip.loadAsync(bytes);
    const packageXml = await zip.file('OEBPS/content.opf')?.async('string');
    const chapters = await Promise.all([1, 2, 3].map((number) => zip.file(`OEBPS/chapter-${number}.xhtml`)?.async('string')));

    expect(await zip.file('mimetype')?.async('string')).toBe('application/epub+zip');
    expect(packageXml).toContain('<spine>');
    expect(chapters.every(Boolean)).toBe(true);
    expect(chapters.join('')).toContain('<em>跨标签</em>选区');
    expect(chapters.join('')).toContain('<strong>strong boundary</strong> selection');
    expect(chapters.join('')).toContain('<a href="#repeat">重复短语</a>');
  });

  it('records known selections and image rectangles for downstream labs', () => {
    expect(manifest.knownSelections.length).toBeGreaterThanOrEqual(4);
    expect(manifest.knownSelections.some((selection) => selection.language === 'zh-CN')).toBe(true);
    expect(manifest.knownSelections.some((selection) => selection.language === 'en-US')).toBe(true);
    expect(manifest.imageRectangles).toEqual(expect.arrayContaining([
      expect.objectContaining({ fixture: 'scanned.pdf', page: 1 }),
      expect.objectContaining({ fixture: 'mixed.pdf', page: 1 }),
    ]));
  });
});
