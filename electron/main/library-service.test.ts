import { mkdtemp, mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import { LibraryService } from './library-service'

const testRoots: string[] = []

async function createDirectory(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'lecpdf-library-service-'))
  testRoots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(testRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })))
})

test('recursively scans PDF and EPUB metadata while ignoring other files', async () => {
  const root = await createDirectory()
  const nested = join(root, 'nested')
  const pdfPath = join(root, 'paper.PDF')
  const epubPath = join(nested, 'novel.epub')
  await mkdir(nested)
  await writeFile(pdfPath, 'pdf')
  await writeFile(epubPath, 'epub')
  await writeFile(join(nested, 'notes.txt'), 'ignore')
  const [pdfStats, epubStats] = await Promise.all([stat(pdfPath), stat(epubPath)])
  const service = new LibraryService(undefined, () => 123)

  const entries = await service.scanFolders([root, root])

  expect(entries).toEqual([
    {
      path: join(root, 'nested', 'novel.epub'),
      kind: 'epub',
      name: 'novel.epub',
      size: 4,
      mtime: Math.floor(epubStats.mtimeMs / 1000),
      addedAt: 123,
      pageCount: null,
      missing: false
    },
    {
      path: join(root, 'paper.PDF'),
      kind: 'pdf',
      name: 'paper.PDF',
      size: 3,
      mtime: Math.floor(pdfStats.mtimeMs / 1000),
      addedAt: 123,
      pageCount: null,
      missing: false
    }
  ])
})

test('skips folders that disappear or cannot be read without losing other results', async () => {
  const root = await createDirectory()
  const pdfPath = join(root, 'available.pdf')
  await writeFile(pdfPath, 'pdf')
  const service = new LibraryService(undefined, () => 456)

  const entries = await service.scanFolders([join(root, 'missing'), root])

  expect(entries).toMatchObject([{ path: pdfPath, kind: 'pdf', addedAt: 456 }])
})
