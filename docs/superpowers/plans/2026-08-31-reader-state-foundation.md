# LecPDF 单向数据流基础层实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立以 Zustand 为唯一前端状态来源的文档路由、受限数据访问、会话资源管理和标签协调基础层。

**Architecture:** 组件未来只通过 Store Action 发起意图；本计划先实现 Store 所需的纯类型、格式路由、`db-api` 边界和不放入 Store 的会话资源注册表。`tabStore` 管理标签元数据并调用 `readerStore` Action；`readerStore` 只保存按 `tabId` 索引的可序列化阅读状态，并使用请求编号忽略晚到结果。

**Tech Stack:** Electron 44、React 18、TypeScript 5、Zustand 5、Vitest 4。

**Spec:** `docs/superpowers/specs/2026-08-31-lecpdf-unidirectional-data-flow-design.md`

## Global Constraints

- PDF 只允许经由 EmbedPDF 适配器打开；EPUB 与后续已验证的非 PDF 电子书只允许经由 `foliate-js` 适配器打开。
- Zustand 是唯一前端状态来源；组件不得直接调用 `window.lec`、EmbedPDF 或 `foliate-js`。
- `db-api` 是唯一可访问 `window.lec` 的渲染层目录；下层不得导入 React、页面或 Store。
- 文件字节、阅读器实例、DOM 引用和临时对象 URL 不得保存到 Zustand；它们由 `src/data/document-session.ts` 管理。
- 每个切片的生产代码目标不超过 300 行（测试文件不计入），并在完成后独立测试、类型检查、构建、中文提交与推送。
- 所有新增或迁移的 TypeScript/TSX 文件必须含中文文件职责注释、导出项注释和关键异步/资源释放说明。
- 本计划不接入 foliate-js 依赖、不迁移 PDF UI、不创建页面组件；这些是后续独立计划的范围。

---

## 文件结构与接口地图

| 文件 | 职责 | 生产代码上限 |
| --- | --- | ---: |
| `electron/shared/ipc.ts` | 受限 EPUB 字节读取的白名单 IPC 通道 | 30 行 |
| `electron/main/lec-file-protocol.ts` | 已授权文档登记与 EPUB 字节读取 | 220 行 |
| `electron/main/file-read-ipc.ts` | 文件读取 IPC 的输入校验与调用转发 | 120 行 |
| `electron/preload/api.ts` | 将受限字节读取暴露为 `LecApi.fileRead.readBuffer` | 180 行 |
| `src/types/document.ts` | 文档类型、标准化错误与安全展示标题 | 100 行 |
| `src/types/reader.ts` | 会话状态、阅读位置与临时文档来源类型 | 130 行 |
| `src/router/document-router.ts` | 纯格式分流；不访问 IPC 或 Store | 100 行 |
| `src/db-api/document-api.ts` | 唯一 `window.lec.fileRead` 访问入口 | 130 行 |
| `src/data/document-session.ts` | 非 Store 的临时来源资源注册与释放 | 180 行 |
| `src/stores/reader-store.ts` | 按标签的可序列化阅读状态及异步请求守卫 | 260 行 |
| `src/stores/tab-store.ts` | 常驻开始页、标签上限及与阅读 Action 的协调 | 220 行 |
| `src/router/index.ts` | 将系统“打开文件”事件转发为标签 Action | 100 行 |
| `src/types/window.d.ts` | 渲染层 `window.lec` 声明 | 40 行 |

本计划完成后，后续 PDF 计划可消费 `ReaderSession`、`DocumentSource` 和 `DocumentSessionRegistry`；后续页面计划可消费 `useTabStore` 与 `useReaderStore`。阅读内核适配器仍将放入 `src/data/readers/pdf/` 和 `src/data/readers/foliate/`。

## Task 1：建立已授权 EPUB 字节读取 IPC

**Files:**

- Modify: `electron/shared/ipc.ts`
- Modify: `electron/main/lec-file-protocol.ts`
- Modify: `electron/main/lec-file-protocol.test.ts`
- Modify: `electron/main/file-read-ipc.ts`
- Modify: `electron/main/file-read-ipc.test.ts`
- Modify: `electron/main/index.ts`
- Modify: `electron/preload/api.ts`
- Modify: `electron/preload/api.test.ts`

**Interfaces:**

- Consumes: 系统文件打开流程中的已验证 `.pdf` / `.epub` 路径，以及现有 `LecFileProtocol` 的路径标准化能力。
- Produces:

```ts
export const FILE_READ_IPC_CHANNELS = {
  getPdfUrl: 'lec:file-read:get-pdf-url',
  readBuffer: 'lec:file-read:read-buffer'
} as const

export type AuthorizedDocumentReader = {
  authorizeDocument(path: string): void
  getPdfUrl(path: string): string
  readEpubBuffer(path: string): Promise<ArrayBuffer>
}
```

- `readBuffer` 只接受已登记的 `.epub`；PDF 继续使用 `getPdfUrl`，其他扩展名或未登记路径必须拒绝。

- [x] **Step 1: 写失败的主进程、preload 与授权测试**

```ts
test('只读取已授权的 EPUB 字节，且拒绝未授权路径和 PDF', async () => {
  const protocol = new LecFileProtocol({
    stat: async () => ({ size: 2, isFile: () => true }),
    createReadStream: () => new Readable(),
    readFile: async () => Buffer.from([0x50, 0x4b])
  })

  protocol.authorizeDocument('C:\\Books\\novel.epub')
  await expect(protocol.readEpubBuffer('C:\\Books\\novel.epub')).resolves.toEqual(new Uint8Array([0x50, 0x4b]).buffer)
  await expect(protocol.readEpubBuffer('C:\\Private\\secret.epub')).rejects.toThrow('文档未获授权')
  await expect(protocol.readEpubBuffer('C:\\Books\\guide.pdf')).rejects.toThrow('只支持 EPUB 文件')
})

test('preload 将 readBuffer 转发到固定白名单通道', async () => {
  const invoked: string[] = []
  const ipcRenderer: IpcRendererPort = {
    invoke: async (channel) => { invoked.push(channel); return new ArrayBuffer(2) },
    on: () => undefined,
    removeListener: () => undefined
  }
  const api = createPreloadApi('0.1.0', ipcRenderer)
  await expect(api.fileRead.readBuffer('C:\\Books\\novel.epub')).resolves.toBeInstanceOf(ArrayBuffer)
  expect(invoked).toEqual([FILE_READ_IPC_CHANNELS.readBuffer])
})
```

- [x] **Step 2: 运行测试，确认现有实现尚未提供读取能力**

Run: `corepack pnpm test:run electron/main/lec-file-protocol.test.ts electron/main/file-read-ipc.test.ts electron/preload/api.test.ts`

Expected: FAIL，提示 `authorizeDocument` / `readEpubBuffer` / `readBuffer` 的实际调用尚未实现。

- [x] **Step 3: 实现最小白名单读取链路**

```ts
// electron/main/lec-file-protocol.ts
authorizeDocument(path: string): void {
  const absolutePath = resolve(path)
  if (!['.pdf', '.epub'].includes(extname(absolutePath).toLowerCase())) {
    throw new Error('不支持的文档格式')
  }
  this.authorizedPaths.add(absolutePath)
}

async readEpubBuffer(path: string): Promise<ArrayBuffer> {
  const absolutePath = this.requireAuthorizedPath(path, '.epub')
  const bytes = await this.fileSystem.readFile(absolutePath)
  return Uint8Array.from(bytes).buffer
}
```

- 为 `ProtocolFileSystem` 补充 `readFile(path): Promise<Uint8Array>`，默认实现使用 `node:fs/promises` 的 `readFile`；通过 `Uint8Array.from` 生成精确副本，避免把 Node Buffer 的底层剩余容量一并暴露给渲染层。
- `registerPdf(path)` 先调用 `authorizeDocument(path)`，继续只为 PDF 生成 `lec-file://` URL；`electron/main/index.ts` 在路由系统打开文件前为每个已支持路径调用 `authorizeDocument(path)`。
- `file-read-ipc.ts` 增加 `readBuffer` handler，对非字符串路径抛出“EPUB 路径无效”，再调用 `readEpubBuffer`；handler 返回类型扩大为 `string | Promise<ArrayBuffer>`。
- `preload/api.ts` 的 `readBuffer` 只能调用 `FILE_READ_IPC_CHANNELS.readBuffer`，并验证返回值为 `ArrayBuffer`；主进程返回其他值时抛出固定错误。
- 为授权集合、扩展名限制、ArrayBuffer 切片和 preload 类型验证写中文注释，说明它们防止渲染层读取任意本地文件。

- [x] **Step 4: 运行 IPC 定向回归测试**

Run: `corepack pnpm test:run electron/main/lec-file-protocol.test.ts electron/main/file-read-ipc.test.ts electron/preload/api.test.ts`

Expected: PASS，已授权 EPUB 可读取，未授权路径/PDF/错误返回值均被拒绝，PDF URL 行为保持通过。

- [x] **Step 5: 运行全量质量门禁**

Run: `corepack pnpm test:run; corepack pnpm typecheck; corepack pnpm build; git diff --check`

Expected: 全部命令以退出码 0 结束。

- [x] **Step 6: 更新专项复选框并提交切片**

```bash
git add electron/shared/ipc.ts electron/main/lec-file-protocol.ts electron/main/lec-file-protocol.test.ts electron/main/file-read-ipc.ts electron/main/file-read-ipc.test.ts electron/main/index.ts electron/preload/api.ts electron/preload/api.test.ts docs/superpowers/plans/2026-08-31-reader-state-foundation.md
git commit -m "feat: 增加受限 EPUB 字节读取"
```

## Task 2：建立通用类型、纯格式路由与渲染层窗口声明

**Files:**

- Create: `src/types/document.ts`
- Create: `src/types/reader.ts`
- Create: `src/router/document-router.ts`
- Create: `src/router/document-router.test.ts`
- Move: `electron/types/window.d.ts` → `src/types/window.d.ts`
- Modify: `src/config/reader-formats.ts`
- Modify: `src/config/reader-formats.test.ts`
- Modify: `tsconfig.web.json`

**Interfaces:**

- Consumes: `detectReaderKind(path)` 的现有扩展名判断。
- Produces:

```ts
export type DocumentKind = 'pdf' | 'foliate'
export type DocumentOpenErrorCode = 'unsupported-document' | 'document-not-found' | 'permission-denied' | 'document-read-failed'
export type DocumentOpenError = { code: DocumentOpenErrorCode; message: string }
export type DocumentRoute =
  | { ok: true; kind: DocumentKind; title: string }
  | { ok: false; error: DocumentOpenError }

export type ReaderTab =
  | { id: 'home'; kind: 'home'; title: string; closable: false }
  | { id: string; kind: 'document'; title: string; path: string; closable: true }

export type DocumentSource =
  | { kind: 'pdf'; url: string }
  | { kind: 'foliate'; bytes: ArrayBuffer }

export type DocumentLoadResult =
  | { ok: true; source: DocumentSource }
  | { ok: false; error: DocumentOpenError }

export type ReaderSessionStatus = 'loading' | 'ready' | 'error'
export type ReaderLocation = { page: number | null; chapter: string | null; percent: number }
export type ReaderSession = {
  tabId: string
  path: string
  title: string
  kind: DocumentKind | null
  status: ReaderSessionStatus
  location: ReaderLocation
  error: DocumentOpenError | null
  requestId: number
}

export type ReaderEvent =
  | { type: 'location-changed'; location: ReaderLocation }
  | { type: 'load-failed'; error: DocumentOpenError }

export function resolveDocumentRoute(path: string): DocumentRoute
```

- `resolveDocumentRoute` 的失败结果不得包含绝对路径；展示标题只取路径末段文件名。

- [ ] **Step 1: 写失败的格式路由测试**

```ts
import { expect, test } from 'vitest'
import { resolveDocumentRoute } from './document-router'

test('将受支持格式转换为安全展示标题和内核类型', () => {
  expect(resolveDocumentRoute('C:\\Books\\Guide.PDF')).toEqual({
    ok: true,
    kind: 'pdf',
    title: 'Guide.PDF'
  })
  expect(resolveDocumentRoute('C:\\Books\\Novel.epub')).toMatchObject({
    ok: true,
    kind: 'foliate'
  })
})

test('未知格式不泄露本机绝对路径', () => {
  const route = resolveDocumentRoute('C:\\Private\\secret.txt')
  expect(route).toEqual({
    ok: false,
    error: { code: 'unsupported-document', message: '暂不支持此文件格式' }
  })
})
```

- [ ] **Step 2: 运行测试，确认新路由模块尚未实现**

Run: `corepack pnpm test:run src/router/document-router.test.ts`

Expected: FAIL，提示无法解析 `./document-router`。

- [ ] **Step 3: 实现最小类型、路由和声明迁移**

```ts
// src/router/document-router.ts
export function resolveDocumentRoute(path: string): DocumentRoute {
  const kind = detectReaderKind(path)
  if (kind === null) {
    return {
      ok: false,
      error: { code: 'unsupported-document', message: '暂不支持此文件格式' }
    }
  }

  return { ok: true, kind, title: getDocumentTitle(path) }
}
```

- 在 `src/types/document.ts` 声明 `DocumentKind`、错误码、`DocumentRoute` 和 `getDocumentTitle(path)`；`getDocumentTitle` 同时处理 `/` 与 `\\` 分隔符。
- 在 `src/types/reader.ts` 声明后续任务需要的 `ReaderSessionStatus`、`ReaderLocation`、`ReaderSession`、`DocumentSource` 与 `ReaderEvent`，但不导入阅读器实现。
- 让 `src/config/reader-formats.ts` 从 `src/types/document.ts` 导入 `DocumentKind`，以消除重复的 `'pdf' | 'foliate'` 声明。
- 将 `electron/types/window.d.ts` 原样迁至 `src/types/window.d.ts`，并将 `tsconfig.web.json` 的 include 从 `electron/types/**/*.d.ts` 改为 `src/types/**/*.d.ts`。
- 为每个新文件和导出项添加中文注释，特别说明未知格式错误不带路径的隐私原因。

- [ ] **Step 4: 运行路由与格式回归测试**

Run: `corepack pnpm test:run src/router/document-router.test.ts src/config/reader-formats.test.ts`

Expected: PASS，PDF 返回 `pdf`，EPUB 返回 `foliate`，未知格式没有路径。

- [ ] **Step 5: 运行类型与构建检查**

Run: `corepack pnpm typecheck; corepack pnpm build`

Expected: 两个命令均以退出码 0 结束。

- [ ] **Step 6: 更新清单并提交切片**

```bash
git add src/types src/router/document-router.ts src/router/document-router.test.ts src/config/reader-formats.ts src/config/reader-formats.test.ts tsconfig.web.json electron/types/window.d.ts docs/superpowers/plans/2026-08-31-reader-state-foundation.md
git commit -m "feat: 建立文档路由与通用类型"
```

## Task 3：建立受限文档来源访问边界

**Files:**

- Create: `src/db-api/document-api.ts`
- Create: `src/db-api/document-api.test.ts`

**Interfaces:**

- Consumes: `window.lec.fileRead.getPdfUrl(path)`、`window.lec.fileRead.readBuffer(path)` 与 Task 2 的 `DocumentKind`、错误类型和 `DocumentSource`。
- Produces:

```ts
export type DocumentApi = {
  loadSource(path: string, kind: DocumentKind): Promise<DocumentLoadResult>
}

export function createDocumentApi(port: Pick<LecApi, 'fileRead'>): DocumentApi
```

- PDF 成功时返回 `{ ok: true, source: { kind: 'pdf', url: string } }`；Foliate 成功时返回 `{ ok: true, source: { kind: 'foliate', bytes: ArrayBuffer } }`。

- [ ] **Step 1: 写失败的 `document-api` 测试**

```ts
test('PDF 仅请求受限的 PDF URL', async () => {
  const getPdfUrl = vi.fn().mockResolvedValue('lec-file://document.pdf')
  const readBuffer = vi.fn()
  const api = createDocumentApi({ fileRead: { getPdfUrl, readBuffer } } as Pick<LecApi, 'fileRead'>)

  await expect(api.loadSource('C:\\Books\\guide.pdf', 'pdf')).resolves.toEqual({
    ok: true,
    source: { kind: 'pdf', url: 'lec-file://document.pdf' }
  })
  expect(readBuffer).not.toHaveBeenCalled()
})

test('读取失败只返回标准错误码', async () => {
  const api = createDocumentApi({
    fileRead: { getPdfUrl: vi.fn().mockRejectedValue(new Error('ENOENT C:\\Private\\x.pdf')), readBuffer: vi.fn() }
  } as Pick<LecApi, 'fileRead'>)

  await expect(api.loadSource('C:\\Private\\x.pdf', 'pdf')).resolves.toEqual({
    ok: false,
    error: { code: 'document-not-found', message: '找不到该文件，请重新定位' }
  })
})
```

- [ ] **Step 2: 运行测试，确认模块不存在**

Run: `corepack pnpm test:run src/db-api/document-api.test.ts`

Expected: FAIL，提示无法解析 `./document-api`。

- [ ] **Step 3: 实现最小 `DocumentApi`**

```ts
export function createDocumentApi(port: Pick<LecApi, 'fileRead'>): DocumentApi {
  return {
    async loadSource(path, kind) {
      try {
        if (kind === 'pdf') {
          return { ok: true, source: { kind, url: await port.fileRead.getPdfUrl(path) } }
        }
        return { ok: true, source: { kind, bytes: await port.fileRead.readBuffer(path) } }
      } catch (error) {
        return { ok: false, error: toDocumentOpenError(error) }
      }
    }
  }
}
```

- 实现 `toDocumentOpenError(error)`：错误文本含 `ENOENT` 时返回 `document-not-found`；含 `EACCES` 或 `EPERM` 时返回 `permission-denied`；其他情况返回 `document-read-failed`。所有用户文案为固定中文字符串，不拼接原始错误或路径。
- 文件顶部及 `createDocumentApi`、错误转换函数均添加中文注释，说明这层是 `window.lec` 的唯一访问边界和脱敏原因。

- [ ] **Step 4: 运行数据边界测试**

Run: `corepack pnpm test:run src/db-api/document-api.test.ts`

Expected: PASS，PDF 不读取 buffer，Foliate 不请求 PDF URL，失败结果没有路径。

- [ ] **Step 5: 运行类型与构建检查**

Run: `corepack pnpm typecheck; corepack pnpm build`

Expected: 两个命令均以退出码 0 结束。

- [ ] **Step 6: 更新清单并提交切片**

```bash
git add src/db-api/document-api.ts src/db-api/document-api.test.ts docs/superpowers/plans/2026-08-31-reader-state-foundation.md
git commit -m "feat: 建立受限文档数据访问"
```

## Task 4：建立不入 Store 的会话资源注册表

**Files:**

- Create: `src/data/document-session.ts`
- Create: `src/data/document-session.test.ts`

**Interfaces:**

- Consumes: Task 3 的 `DocumentApi`、Task 2 的 `DocumentKind` 和 `DocumentSource`。
- Produces:

```ts
export type DocumentSessionRegistry = {
  open(tabId: string, path: string, kind: DocumentKind): Promise<DocumentLoadResult>
  getSource(tabId: string): DocumentSource | null
  close(tabId: string): void
  clear(): void
}

export function createDocumentSessionRegistry(api: DocumentApi): DocumentSessionRegistry
```

- [ ] **Step 1: 写失败的资源注册表测试**

```ts
test('来源资源不写入 Store，而是按标签由注册表持有并可释放', async () => {
  const source: DocumentSource = { kind: 'pdf', url: 'lec-file://guide.pdf' }
  const api: DocumentApi = { loadSource: vi.fn().mockResolvedValue({ ok: true, source }) }
  const registry = createDocumentSessionRegistry(api)

  await expect(registry.open('tab-1', 'C:\\Books\\guide.pdf', 'pdf')).resolves.toEqual({ ok: true, source })
  expect(registry.getSource('tab-1')).toBe(source)
  registry.close('tab-1')
  expect(registry.getSource('tab-1')).toBeNull()
})
```

- [ ] **Step 2: 运行测试，确认注册表尚未实现**

Run: `corepack pnpm test:run src/data/document-session.test.ts`

Expected: FAIL，提示无法解析 `./document-session`。

- [ ] **Step 3: 实现最小资源注册表**

```ts
export function createDocumentSessionRegistry(api: DocumentApi): DocumentSessionRegistry {
  const sources = new Map<string, DocumentSource>()

  return {
    async open(tabId, path, kind) {
      const result = await api.loadSource(path, kind)
      if (result.ok) sources.set(tabId, result.source)
      return result
    },
    getSource: (tabId) => sources.get(tabId) ?? null,
    close: (tabId) => { sources.delete(tabId) },
    clear: () => { sources.clear() }
  }
}
```

- 注册表只管理来源引用；EmbedPDF 和 foliate-js 的对象 URL、订阅与实例由各自适配器拥有，并通过后续接入时沿用 `close(tabId)` 的关闭边界释放。
- 添加中文注释，说明 `Map` 不属于 React 状态、不得由组件直接读取，以及关闭标签必须同步清理来源。

- [ ] **Step 4: 运行注册表测试**

Run: `corepack pnpm test:run src/data/document-session.test.ts`

Expected: PASS，成功来源可按标签取得，关闭和清空后均无法再取得。

- [ ] **Step 5: 运行类型与构建检查**

Run: `corepack pnpm typecheck; corepack pnpm build`

Expected: 两个命令均以退出码 0 结束。

- [ ] **Step 6: 更新清单并提交切片**

```bash
git add src/data/document-session.ts src/data/document-session.test.ts docs/superpowers/plans/2026-08-31-reader-state-foundation.md
git commit -m "feat: 管理阅读会话临时资源"
```

## Task 5：建立按标签隔离的阅读会话 Store

**Files:**

- Create: `src/stores/reader-store.ts`
- Create: `src/stores/reader-store.test.ts`

**Interfaces:**

- Consumes: Task 2 的 `DocumentRoute`、Task 4 的 `DocumentSessionRegistry`。
- Produces:

```ts
export type ReaderStore = {
  sessions: Record<string, ReaderSession>
  openSession(tabId: string, path: string): Promise<void>
  closeSession(tabId: string): void
  updateLocation(tabId: string, location: ReaderLocation): void
}

export type ReaderStoreDependencies = {
  resolveRoute: (path: string) => DocumentRoute
  registry: Pick<DocumentSessionRegistry, 'open' | 'close'>
}

export function createReaderStore(deps: ReaderStoreDependencies): StoreApi<ReaderStore>
```

- [ ] **Step 1: 写失败的 Store 状态与竞态测试**

```ts
function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => { resolve = next })
  return { promise, resolve }
}

test('晚到的旧打开结果不能覆盖同一标签的新请求', async () => {
  const first = createDeferred<DocumentLoadResult>()
  const registry = { open: vi.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce({ ok: true, source: pdfSource }), close: vi.fn() }
  const store = createReaderStore({ resolveRoute: vi.fn().mockReturnValue({ ok: true, kind: 'pdf', title: 'guide.pdf' }), registry })

  void store.getState().openSession('tab-1', 'C:\\Books\\old.pdf')
  await store.getState().openSession('tab-1', 'C:\\Books\\new.pdf')
  first.resolve({ ok: false, error: { code: 'document-read-failed', message: '无法读取该文件' } })
  await Promise.resolve()

  expect(store.getState().sessions['tab-1']).toMatchObject({ path: 'C:\\Books\\new.pdf', status: 'ready' })
})

test('关闭会话同时移除状态并释放注册表资源', () => {
  const store = createReaderStore({ resolveRoute, registry })
  store.getState().closeSession('tab-1')
  expect(registry.close).toHaveBeenCalledWith('tab-1')
  expect(store.getState().sessions['tab-1']).toBeUndefined()
})
```

- [ ] **Step 2: 运行测试，确认 Store 尚未实现**

Run: `corepack pnpm test:run src/stores/reader-store.test.ts`

Expected: FAIL，提示无法解析 `./reader-store`。

- [ ] **Step 3: 实现最小 Store 和请求编号守卫**

```ts
async openSession(tabId, path) {
  const route = deps.resolveRoute(path)
  const requestId = nextRequestId()
  set((state) => ({ sessions: { ...state.sessions, [tabId]: createLoadingSession(tabId, path, route, requestId) } }))
  if (!route.ok) return setRouteError(tabId, requestId, route.error)

  const result = await deps.registry.open(tabId, path, route.kind)
  set((state) => isCurrentRequest(state.sessions[tabId], requestId)
    ? applyLoadResult(state, tabId, requestId, result)
    : state)
}
```

- `ReaderSession` 只保存状态、路径、展示标题、类型、位置、错误和请求编号，不保存 `DocumentSource`。
- `updateLocation` 只更新已存在会话；未知 `tabId` 不创建隐式会话。
- 所有 Store Action、请求编号判断和关闭时调用 `registry.close` 的原因均写中文注释。

- [ ] **Step 4: 运行 Store 测试**

Run: `corepack pnpm test:run src/stores/reader-store.test.ts`

Expected: PASS，错误会重置、旧请求被忽略、关闭会释放资源、位置只更新目标标签。

- [ ] **Step 5: 运行全量质量门禁**

Run: `corepack pnpm test:run; corepack pnpm typecheck; corepack pnpm build`

Expected: 全部通过，且没有 TypeScript 错误。

- [ ] **Step 6: 更新清单并提交切片**

```bash
git add src/stores/reader-store.ts src/stores/reader-store.test.ts docs/superpowers/plans/2026-08-31-reader-state-foundation.md
git commit -m "feat: 建立按标签隔离的阅读会话状态"
```

## Task 6：建立标签协调与系统文件打开桥接

**Files:**

- Create: `src/stores/tab-store.ts`
- Create: `src/stores/tab-store.test.ts`
- Create: `src/router/index.ts`
- Create: `src/router/index.test.ts`

**Interfaces:**

- Consumes: Task 5 的 `ReaderStore` Action，以及 `LecApi['lifecycle']['onOpenFileRequest']`。
- Produces:

```ts
export type TabStore = {
  tabs: ReaderTab[]
  activeTabId: string
  openDocument(path: string): Promise<string | null>
  activateTab(tabId: string): void
  closeTab(tabId: string): void
}

export type TabStoreDependencies = {
  reader: Pick<ReaderStore, 'openSession' | 'closeSession'>
  createTabId: () => string
}

export function createTabStore(deps: TabStoreDependencies): StoreApi<TabStore>

export function bindOpenFileRequests(
  subscribe: LecApi['lifecycle']['onOpenFileRequest'],
  openDocument: (path: string) => Promise<string | null>
): Unsubscribe
```

- [ ] **Step 1: 写失败的标签与系统打开事件测试**

```ts
test('开始页常驻、文档标签最多二十个，并将新标签交给阅读 Store', async () => {
  const reader = { openSession: vi.fn().mockResolvedValue(undefined), closeSession: vi.fn() }
  const store = createTabStore({ reader, createTabId: () => 'tab-1' })

  await expect(store.getState().openDocument('C:\\Books\\guide.pdf')).resolves.toBe('tab-1')
  expect(reader.openSession).toHaveBeenCalledWith('tab-1', 'C:\\Books\\guide.pdf')
  expect(store.getState().tabs[0]).toMatchObject({ id: 'home', closable: false })
})

test('系统文件打开事件只转发到标签 Action，并返回取消订阅函数', async () => {
  let listener: ((path: string) => void) | undefined
  const unsubscribe = vi.fn()
  const openDocument = vi.fn().mockResolvedValue('tab-1')
  const stop = bindOpenFileRequests((next) => { listener = next; return unsubscribe }, openDocument)

  listener?.('C:\\Books\\guide.pdf')
  await Promise.resolve()
  expect(openDocument).toHaveBeenCalledWith('C:\\Books\\guide.pdf')
  stop()
  expect(unsubscribe).toHaveBeenCalledOnce()
})
```

- [ ] **Step 2: 运行测试，确认协调模块尚未实现**

Run: `corepack pnpm test:run src/stores/tab-store.test.ts src/router/index.test.ts`

Expected: FAIL，提示无法解析 `./tab-store` 或 `./index`。

- [ ] **Step 3: 实现最小标签 Store 与生命周期桥接**

```ts
export function bindOpenFileRequests(subscribe, openDocument) {
  return subscribe((path) => { void openDocument(path) })
}

async openDocument(path) {
  if (get().tabs.filter((tab) => tab.kind === 'document').length >= 20) return null
  const id = deps.createTabId()
  set((state) => ({ tabs: [...state.tabs, createLoadingTab(id, path)], activeTabId: id }))
  await deps.reader.openSession(id, path)
  return id
}
```

- `closeTab` 忽略 `home`，关闭文档标签时先调用 `reader.closeSession(tabId)` 再移除标签，并把激活标签回退到剩余最后一个标签。
- `src/router/index.ts` 只负责把生命周期回调转为 `openDocument` 调用；不导入 React、组件或阅读器适配器。
- 为标签上限、常驻开始页、异步 `void` 调用与取消订阅边界补充中文注释。

- [ ] **Step 4: 运行标签和路由桥接测试**

Run: `corepack pnpm test:run src/stores/tab-store.test.ts src/router/index.test.ts`

Expected: PASS，开始页不可关闭、超过 20 个文档标签返回 `null`、外部文件事件只触发一次打开动作。

- [ ] **Step 5: 运行全量质量门禁和架构依赖检查**

Run: `rg -n "window\\.lec|@embedpdf|foliate-js" src/components src/pages; corepack pnpm test:run; corepack pnpm typecheck; corepack pnpm build; git diff --check`

Expected: 第一条命令没有匹配结果；其余命令均以退出码 0 结束。

- [ ] **Step 6: 更新清单并提交切片**

```bash
git add src/stores/tab-store.ts src/stores/tab-store.test.ts src/router/index.ts src/router/index.test.ts docs/superpowers/plans/2026-08-31-reader-state-foundation.md
git commit -m "feat: 建立标签与系统打开文件协调"
```

## 计划自检记录

- [x] 本计划只覆盖“单向数据流基础层”，没有把 PDF UI 迁移、foliate-js 引擎接入和页面组合混入同一实现周期。
- [x] 每个 Task 都能独立被接受或拒绝，且生产代码目标不超过 300 行。
- [x] 每项异步操作都定义了请求编号或取消订阅边界；用户可见错误均不带绝对路径。
- [x] 类型由 Task 1 定义，并在后续 Task 中使用同名 `DocumentKind`、`DocumentSource`、`ReaderSession`、`DocumentLoadResult` 与 `ReaderStore`。
- [x] 搜索后未发现占位字样或未定义的延后实现项；PDF、Foliate 和页面迁移属于明确分离的下一阶段计划范围。
