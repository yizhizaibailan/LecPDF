import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const FIXED_DATE = new Date('2000-01-01T00:00:00.000Z');
const OUTPUT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const PAGE_SIZE = [612, 792];
const LICENSE = 'CC0-1.0';

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(bytes) {
  let a = 1;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function uint32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0);
  return buffer;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  return Buffer.concat([
    uint32(data.length),
    typeBytes,
    data,
    uint32(crc32(Buffer.concat([typeBytes, data]))),
  ]);
}

function storedZlib(bytes) {
  const blocks = [Buffer.from([0x78, 0x01])];
  for (let offset = 0; offset < bytes.length; offset += 65535) {
    const chunk = bytes.subarray(offset, Math.min(offset + 65535, bytes.length));
    const header = Buffer.alloc(5);
    header[0] = offset + chunk.length === bytes.length ? 1 : 0;
    header.writeUInt16LE(chunk.length, 1);
    header.writeUInt16LE(0xffff - chunk.length, 3);
    blocks.push(header, chunk);
  }
  blocks.push(uint32(adler32(bytes)));
  return Buffer.concat(blocks);
}

function createSyntheticPng(width, height, seed) {
  const scanlines = Buffer.alloc(height * (1 + width * 3));
  const chart = [
    [220, 40, 40],
    [40, 180, 70],
    [40, 90, 220],
    [240, 210, 40],
    [210, 50, 190],
    [40, 200, 210],
  ];

  for (let y = 0; y < height; y += 1) {
    const row = y * (1 + width * 3);
    scanlines[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const index = row + 1 + x * 3;
      const color = y < Math.floor(height / 6)
        ? chart[Math.min(chart.length - 1, Math.floor((x * chart.length) / width))]
        : [
            Math.floor((x * 255) / (width - 1)),
            Math.floor((y * 255) / (height - 1)),
            (x + y + seed * 31) % 256,
          ];
      scanlines[index] = color[0];
      scanlines[index + 1] = color[1];
      scanlines[index + 2] = color[2];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', storedZlib(scanlines)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function setPdfMetadata(document, title) {
  document.setTitle(title);
  document.setAuthor('LecPDF fixture generator');
  document.setSubject('Deterministic CC0 technical validation fixture');
  document.setKeywords(['LecPDF', 'CC0', 'fixture']);
  document.setCreator('LecPDF fixture generator 1');
  document.setProducer('pdf-lib 1.17.1');
  document.setCreationDate(FIXED_DATE);
  document.setModificationDate(FIXED_DATE);
}

async function createTextPdf() {
  const document = await PDFDocument.create();
  setPdfMetadata(document, 'LecPDF text fixture');
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);

  for (let pageNumber = 1; pageNumber <= 3; pageNumber += 1) {
    const page = document.addPage(PAGE_SIZE);
    page.drawText(`LecPDF text fixture - page ${pageNumber}`, { x: 72, y: 720, size: 20, font: bold });
    const lines = [
      'Stable text anchor: alpha beta gamma delta.',
      'The quick brown fox crosses an inline selection boundary.',
      'Repeated phrase appears here. Repeated phrase appears again.',
      `Known page token: TEXT-PAGE-${pageNumber}.`,
    ];
    lines.forEach((line, index) => page.drawText(line, {
      x: 72,
      y: 670 - index * 28,
      size: 13,
      font: regular,
      color: rgb(0.08, 0.1, 0.15),
    }));
  }
  return Buffer.from(await document.save({ useObjectStreams: false }));
}

async function createScannedPdf() {
  const document = await PDFDocument.create();
  setPdfMetadata(document, 'LecPDF scanned image fixture');
  for (let pageNumber = 1; pageNumber <= 3; pageNumber += 1) {
    const image = await document.embedPng(createSyntheticPng(180, 240, pageNumber));
    const page = document.addPage(PAGE_SIZE);
    page.drawImage(image, { x: 36, y: 36, width: 540, height: 720 });
  }
  return Buffer.from(await document.save({ useObjectStreams: false }));
}

async function createMixedPdf() {
  const document = await PDFDocument.create();
  setPdfMetadata(document, 'LecPDF mixed content fixture');
  const font = await document.embedFont(StandardFonts.Helvetica);
  const image = await document.embedPng(createSyntheticPng(160, 120, 7));

  for (let pageNumber = 1; pageNumber <= 3; pageNumber += 1) {
    const page = document.addPage(PAGE_SIZE);
    page.drawRectangle({ x: 48, y: 48, width: 516, height: 696, borderWidth: 2, borderColor: rgb(0.12, 0.35, 0.65) });
    page.drawText(`Mixed content page ${pageNumber}`, { x: 72, y: 700, size: 18, font });
    page.drawText('Text layer remains selectable while raster artwork stays photographic.', {
      x: 72,
      y: 660,
      size: 11,
      font,
    });
    page.drawRectangle({ x: 72, y: 520, width: 220, height: 80, color: rgb(0.92, 0.78, 0.22), opacity: 0.75 });
    page.drawLine({ start: { x: 72, y: 490 }, end: { x: 420, y: 450 }, thickness: 5, color: rgb(0.2, 0.55, 0.35) });
    page.drawImage(image, { x: 72, y: 250, width: 240, height: 180 });
  }
  return Buffer.from(await document.save({ useObjectStreams: false }));
}

function addZipFile(zip, path, content, options = {}) {
  zip.file(path, content, {
    date: FIXED_DATE,
    createFolders: false,
    unixPermissions: 0o100644,
    ...options,
  });
}

async function createEpub() {
  const zip = new JSZip();
  addZipFile(zip, 'mimetype', 'application/epub+zip', { compression: 'STORE' });
  addZipFile(zip, 'META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`);
  addZipFile(zip, 'OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="zh-CN">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">urn:uuid:00000000-0000-4000-8000-000000000001</dc:identifier>
    <dc:title>LecPDF Deterministic Reflow Fixture</dc:title>
    <dc:language>zh-CN</dc:language>
    <meta property="dcterms:modified">2000-01-01T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="c1" href="chapter-1.xhtml" media-type="application/xhtml+xml"/>
    <item id="c2" href="chapter-2.xhtml" media-type="application/xhtml+xml"/>
    <item id="c3" href="chapter-3.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine><itemref idref="c1"/><itemref idref="c2"/><itemref idref="c3"/></spine>
</package>`);
  addZipFile(zip, 'OEBPS/nav.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="zh-CN">
<head><title>目录</title></head><body><nav epub:type="toc"><ol>
<li><a href="chapter-1.xhtml">第一章</a></li><li><a href="chapter-2.xhtml">Chapter Two</a></li><li><a href="chapter-3.xhtml">第三章</a></li>
</ol></nav></body></html>`);
  addZipFile(zip, 'OEBPS/chapter-1.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="zh-CN"><head><title>第一章</title></head><body>
<h1>第一章：中文锚点</h1>
<p>这是用于稳定恢复的中文句子，包含<em>跨标签</em>选区以及后续文字。</p>
<p id="repeat">前缀甲 重复短语 后缀甲。前缀乙 <a href="#repeat">重复短语</a> 后缀乙。</p>
</body></html>`);
  addZipFile(zip, 'OEBPS/chapter-2.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en"><head><title>Chapter Two</title></head><body>
<h1>Chapter Two: English anchors</h1>
<p>This sentence crosses a <strong>strong boundary</strong> selection and continues afterward.</p>
<p>Prefix one repeated phrase suffix one. Prefix two repeated phrase suffix two.</p>
</body></html>`);
  addZipFile(zip, 'OEBPS/chapter-3.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="zh-CN"><head><title>第三章</title></head><body>
<h1>第三章：朗读队列</h1>
<p>第一句用于朗读。第二句用于暂停和继续！第三句用于章节末尾？</p>
<p lang="en">First TTS sentence. Second TTS sentence! Third TTS sentence?</p>
</body></html>`);

  return zip.generateAsync({
    type: 'nodebuffer',
    mimeType: 'application/epub+zip',
    compression: 'STORE',
    platform: 'UNIX',
  });
}

async function main() {
  await mkdir(OUTPUT_DIRECTORY, { recursive: true });
  const outputs = [
    ['text.pdf', await createTextPdf(), { type: 'pdf', pages: 3, content: ['text'] }],
    ['scanned.pdf', await createScannedPdf(), { type: 'pdf', pages: 3, content: ['raster-image'] }],
    ['mixed.pdf', await createMixedPdf(), { type: 'pdf', pages: 3, content: ['text', 'vector', 'raster-image'] }],
    ['reflow.epub', await createEpub(), { type: 'epub', chapters: 3, content: ['zh-CN', 'en-US', 'inline-boundaries'] }],
  ];

  for (const [path, bytes] of outputs) await writeFile(join(OUTPUT_DIRECTORY, path), bytes);

  const files = await Promise.all(outputs.map(async ([path, _bytes, metadata]) => ({
    path,
    ...metadata,
    sha256: sha256(await readFile(join(OUTPUT_DIRECTORY, path))),
    license: LICENSE,
  })));

  const manifest = {
    schemaVersion: 1,
    generatedAt: '2000-01-01T00:00:00.000Z',
    generator: 'fixtures/generate.mjs',
    files,
    knownSelections: [
      {
        id: 'zh-inline-boundary', fixture: 'reflow.epub', chapter: 'OEBPS/chapter-1.xhtml', language: 'zh-CN',
        exact: '包含跨标签选区以及后续文字', prefix: '这是用于稳定恢复的中文句子，', suffix: '。',
      },
      {
        id: 'zh-repeat-second', fixture: 'reflow.epub', chapter: 'OEBPS/chapter-1.xhtml', language: 'zh-CN',
        exact: '重复短语', prefix: '前缀乙 ', suffix: ' 后缀乙。',
      },
      {
        id: 'en-inline-boundary', fixture: 'reflow.epub', chapter: 'OEBPS/chapter-2.xhtml', language: 'en-US',
        exact: 'a strong boundary selection', prefix: 'This sentence crosses ', suffix: ' and continues afterward.',
      },
      {
        id: 'en-repeat-second', fixture: 'reflow.epub', chapter: 'OEBPS/chapter-2.xhtml', language: 'en-US',
        exact: 'repeated phrase', prefix: 'Prefix two ', suffix: ' suffix two.',
      },
    ],
    imageRectangles: [
      { fixture: 'scanned.pdf', page: 1, x: 36, y: 36, width: 540, height: 720, coordinateSystem: 'pdf-points-bottom-left' },
      { fixture: 'mixed.pdf', page: 1, x: 72, y: 250, width: 240, height: 180, coordinateSystem: 'pdf-points-bottom-left' },
    ],
    textRegions: [
      { fixture: 'text.pdf', page: 1, exact: 'Stable text anchor: alpha beta gamma delta.', x: 72, y: 670 },
      { fixture: 'mixed.pdf', page: 1, exact: 'Text layer remains selectable while raster artwork stays photographic.', x: 72, y: 660 },
    ],
  };
  await writeFile(join(OUTPUT_DIRECTORY, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`Generated ${files.length} deterministic CC0 fixtures.`);
}

await main();
