/**
 * 实现带 Range 支持的 lec-file 文件协议；通过登记路径和流式响应提供大 PDF 的受限读取。
 */
import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { Readable } from 'node:stream'

export type ProtocolFileSystem = {
  stat(path: string): Promise<{ size: number; isFile(): boolean }>
  createReadStream(path: string, options: { start: number; end: number }): Readable
  readFile(path: string): Promise<Uint8Array>
}

export type LecFileProtocolPort = {
  handle(scheme: string, handler: (request: Request) => Promise<Response>): void
}

type ByteRange = {
  start: number
  end: number
  partial: boolean
}

const nodeFileSystem: ProtocolFileSystem = { stat, createReadStream, readFile }

export class LecFileProtocol {
  private readonly documents = new Map<string, string>()
  private readonly urlsByPath = new Map<string, string>()
  private readonly authorizedPaths = new Set<string>()

  constructor(
    private readonly fileSystem: ProtocolFileSystem = nodeFileSystem,
    private readonly createToken: () => string = randomUUID
  ) {}

  registerPdf(path: string): string {
    const absolutePath = resolve(path)
    if (extname(absolutePath).toLowerCase() !== '.pdf') {
      throw new Error('只支持 PDF 文件')
    }

    this.authorizeDocument(absolutePath)

    const existingUrl = this.urlsByPath.get(absolutePath)
    if (existingUrl !== undefined) {
      return existingUrl
    }

    const token = this.createToken()
    const url = `lec-file://document/${token}`
    this.documents.set(token, absolutePath)
    this.urlsByPath.set(absolutePath, url)
    return url
  }

  /**
   * 将由系统打开流程验证过的文档登记为可读取资源。
   * 主进程只为 PDF 和 EPUB 建立白名单，避免渲染进程借由 IPC 读取任意本地路径。
   */
  authorizeDocument(path: string): void {
    const absolutePath = resolve(path)
    const extension = extname(absolutePath).toLowerCase()
    if (extension !== '.pdf' && extension !== '.epub') {
      throw new Error('不支持的文档格式')
    }
    this.authorizedPaths.add(absolutePath)
  }

  getPdfUrl(path: string): string {
    const absolutePath = resolve(path)
    if (!this.authorizedPaths.has(absolutePath)) {
      throw new Error('文档未获授权')
    }
    return this.urlsByPath.get(absolutePath) ?? this.registerPdf(absolutePath)
  }

  /**
   * 读取已授权 EPUB 的完整字节，供 foliate-js 在渲染层解析。
   * 这里复制 Uint8Array 后再返回精确 ArrayBuffer，避免暴露 Node Buffer 的额外底层容量。
   */
  async readEpubBuffer(path: string): Promise<ArrayBuffer> {
    const absolutePath = this.requireAuthorizedPath(path, '.epub')
    const bytes = await this.fileSystem.readFile(absolutePath)
    return Uint8Array.from(bytes).buffer
  }

  async handle(request: Request): Promise<Response> {
    const path = this.getRegisteredPath(request.url)
    if (path === null) {
      return new Response(null, { status: 404 })
    }

    let metadata: { size: number; isFile(): boolean }
    try {
      metadata = await this.fileSystem.stat(path)
    } catch {
      return new Response(null, { status: 404 })
    }

    if (!metadata.isFile() || metadata.size <= 0) {
      return new Response(null, { status: 404 })
    }

    const range = parseByteRange(request.headers.get('range'), metadata.size)
    if (range === null) {
      return new Response(null, {
        status: 416,
        headers: { 'content-range': `bytes */${metadata.size}` }
      })
    }

    const headers = new Headers({
      'accept-ranges': 'bytes',
      'content-length': String(range.end - range.start + 1),
      'content-type': 'application/pdf'
    })
    if (range.partial) {
      headers.set('content-range', `bytes ${range.start}-${range.end}/${metadata.size}`)
    }

    const stream = this.fileSystem.createReadStream(path, { start: range.start, end: range.end })
    return new Response(Readable.toWeb(stream) as unknown as ConstructorParameters<typeof Response>[0], {
      status: range.partial ? 206 : 200,
      headers
    })
  }

  private getRegisteredPath(requestUrl: string): string | null {
    let url: URL
    try {
      url = new URL(requestUrl)
    } catch {
      return null
    }

    if (url.protocol !== 'lec-file:' || url.hostname !== 'document') {
      return null
    }

    const token = decodeURIComponent(url.pathname.slice(1))
    if (token.length === 0 || token.includes('/')) {
      return null
    }

    return this.documents.get(token) ?? null
  }

  /**
   * 校验指定路径的扩展名和授权登记，集中保证每次文件读取都不能越过主进程白名单。
   */
  private requireAuthorizedPath(path: string, extension: '.epub'): string {
    const absolutePath = resolve(path)
    if (extname(absolutePath).toLowerCase() !== extension) {
      throw new Error('只支持 EPUB 文件')
    }
    if (!this.authorizedPaths.has(absolutePath)) {
      throw new Error('文档未获授权')
    }
    return absolutePath
  }
}

export function registerLecFileProtocol(protocol: LecFileProtocolPort, service: LecFileProtocol): void {
  protocol.handle('lec-file', (request) => service.handle(request))
}

function parseByteRange(header: string | null, size: number): ByteRange | null {
  if (header === null) {
    return { start: 0, end: size - 1, partial: false }
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (match === null || (match[1].length === 0 && match[2].length === 0)) {
    return null
  }

  if (match[1].length === 0) {
    const suffixLength = Number(match[2])
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
      return null
    }
    return { start: Math.max(0, size - suffixLength), end: size - 1, partial: true }
  }

  const start = Number(match[1])
  const requestedEnd = match[2].length === 0 ? size - 1 : Number(match[2])
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd) || start < 0 || start >= size || requestedEnd < start) {
    return null
  }

  return { start, end: Math.min(requestedEnd, size - 1), partial: true }
}
