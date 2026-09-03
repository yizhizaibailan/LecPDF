import { Readable } from 'node:stream'
import { expect, test } from 'vitest'
import {
  LecFileProtocol,
  registerLecFileProtocol,
  type LecFileProtocolPort,
  type ProtocolFileSystem
} from './lec-file-protocol'

function createFileSystem(): { fileSystem: ProtocolFileSystem; streamOptions: Array<{ start: number; end: number }> } {
  const streamOptions: Array<{ start: number; end: number }> = []
  return {
    fileSystem: {
      stat: async () => ({ size: 200 * 1024 * 1024, isFile: () => true }),
      createReadStream: (_path, options) => {
        streamOptions.push({ start: options.start, end: options.end })
        return Readable.from(Buffer.from('PDF range bytes'))
      },
      readFile: async () => Buffer.from('PDF bytes')
    },
    streamOptions
  }
}

test('serves a registered PDF range without exposing its local path', async () => {
  const { fileSystem, streamOptions } = createFileSystem()
  const protocol = new LecFileProtocol(fileSystem, () => 'token-1')
  const url = protocol.registerPdf('C:\\private\\large-document.pdf')

  const response = await protocol.handle(new Request(url, { headers: { Range: 'bytes=1024-2047' } }))

  expect(url).toBe('lec-file://document/token-1')
  expect(url).not.toContain('large-document.pdf')
  expect(response.status).toBe(206)
  expect(response.headers.get('content-range')).toBe(`bytes 1024-2047/${200 * 1024 * 1024}`)
  expect(response.headers.get('content-length')).toBe('1024')
  expect(response.headers.get('accept-ranges')).toBe('bytes')
  expect(streamOptions).toEqual([{ start: 1024, end: 2047 }])
  await expect(response.text()).resolves.toBe('PDF range bytes')
})

test('rejects unknown documents and invalid byte ranges without touching disk', async () => {
  const { fileSystem, streamOptions } = createFileSystem()
  const protocol = new LecFileProtocol(fileSystem, () => 'token-2')
  const url = protocol.registerPdf('C:\\private\\document.pdf')

  const unknown = await protocol.handle(new Request('lec-file://document/forged-token'))
  const invalidRange = await protocol.handle(new Request(url, { headers: { Range: 'bytes=999999999-1000000000' } }))

  expect(unknown.status).toBe(404)
  expect(invalidRange.status).toBe(416)
  expect(invalidRange.headers.get('content-range')).toBe(`bytes */${200 * 1024 * 1024}`)
  expect(streamOptions).toEqual([])
})

test('rejects non-PDF documents before issuing a capability URL', () => {
  const { fileSystem } = createFileSystem()
  const protocol = new LecFileProtocol(fileSystem, () => 'token-3')

  expect(() => protocol.registerPdf('C:\\private\\book.epub')).toThrow('只支持 PDF 文件')
})

test('returns reader URLs only for PDFs that the main process has registered', () => {
  const { fileSystem } = createFileSystem()
  const protocol = new LecFileProtocol(fileSystem, () => 'token-5')
  const url = protocol.registerPdf('C:\\private\\approved.pdf')

  expect(protocol.getPdfUrl('C:\\private\\approved.pdf')).toBe(url)
  expect(() => protocol.getPdfUrl('C:\\private\\unapproved.pdf')).toThrow('文档未获授权')
})

test('issues a PDF URL for a document already authorized by the open-file flow', () => {
  const { fileSystem } = createFileSystem()
  const protocol = new LecFileProtocol(fileSystem, () => 'token-7')
  protocol.authorizeDocument('C:\\private\\opened.pdf')

  expect(protocol.getPdfUrl('C:\\private\\opened.pdf')).toBe('lec-file://document/token-7')
})

test('only reads bytes for an authorized EPUB document', async () => {
  const { fileSystem } = createFileSystem()
  const readPaths: string[] = []
  const protocol = new LecFileProtocol({
    ...fileSystem,
    readFile: async (path) => {
      readPaths.push(path)
      return new Uint8Array([0x50, 0x4b])
    }
  })

  protocol.authorizeDocument('C:\\books\\novel.epub')

  await expect(protocol.readEpubBuffer('C:\\books\\novel.epub')).resolves.toEqual(new Uint8Array([0x50, 0x4b]).buffer)
  await expect(protocol.readEpubBuffer('C:\\private\\secret.epub')).rejects.toThrow('文档未获授权')
  await expect(protocol.readEpubBuffer('C:\\books\\guide.pdf')).rejects.toThrow('只支持 EPUB 文件')
  expect(readPaths).toEqual(['C:\\books\\novel.epub'])
})

test('registers the lec-file scheme with Electron protocol handling', async () => {
  const { fileSystem } = createFileSystem()
  const service = new LecFileProtocol(fileSystem, () => 'token-4')
  const registered = new Map<string, (request: Request) => Promise<Response>>()
  const protocolPort: LecFileProtocolPort = {
    handle: (scheme, handler) => registered.set(scheme, handler)
  }

  registerLecFileProtocol(protocolPort, service)
  const response = await registered.get('lec-file')?.(new Request('lec-file://document/not-registered'))

  expect(response?.status).toBe(404)
})
/** 覆盖受限 lec-file 协议对本地 PDF 的访问边界。 */
