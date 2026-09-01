# PDF 应用壳与标签页接入实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将开始页、标签栏和现有 EmbedPDF 阅读器接入已建立的 Zustand 单向数据流，并删除旧 App 中直接读取 Electron API 的 PDF 打开逻辑。

**Architecture:** `src/config/app-runtime.ts` 是唯一组合根，负责将 preload 白名单、文档 API、资源注册表与 Store 组合。页面只接收运行时公开的 Store、数据或回调；开始页、系统文件请求和选择器最终调用同一个 `tabStore.openDocument(path)`。

**Tech Stack:** Electron 44、React 18、TypeScript 5、Zustand 5、Ant Design 5、EmbedPDF 2、Vitest 4。

**Spec:** `LecPDF-FRD.md` §4.1、§4.2、§4.3；`docs/superpowers/specs/2026-08-31-lecpdf-unidirectional-data-flow-design.md`。

## Global Constraints

- PDF 只使用 EmbedPDF；本计划不引入 `foliate-js`、`epub.js` 或其它 PDF 内核。
- PDF URL、EPUB 字节、EmbedPDF registry、DOM 引用和对象 URL 不进入 Zustand。
- `components/` 与 `pages/` 不得直接调用 `window.lec`、`db-api` 或 `data/document-session`。
- `src/main.tsx` 与 `src/config/app-runtime.ts` 是仅有的 preload 组合边界。
- 开始页不可关闭，文档标签最多 20 个；全部打开入口都复用 `tabStore.openDocument`。
- 本阶段仅 PDF 进入真实阅读视图；EPUB 显示明确的“阅读器尚未接入”状态，Foliate 适配另立计划。
- 新增或迁移 TypeScript/TSX 要有中文文件、导出项、异步和资源释放注释；每任务生产代码约不超过 300 行。

## 目标文件

```text
src/components/Reader/{PdfToolbar,PdfSearchBar,PdfNavigationSidebar}.tsx
src/components/TabBar/DocumentTabs.tsx
src/config/app-runtime.ts
src/pages/{ApplicationPage,home/HomePage,reader-reserved/PdfReaderPage,reader-reserved/ReaderPage}.tsx
src/router/open-documents.ts
src/stores/use-store-selector.ts
```

旧 `src/renderer/src/App.tsx` 的职责按上述文件拆分，任务 4 删除旧模块；不创建根级 `reader` 或 `engines` 目录。

---

## Task 1：创建应用运行时组合根

**Files:** Create `src/config/app-runtime.ts`、`src/config/app-runtime.test.ts`。

**Interfaces:**

```ts
export type AppRuntime = {
  readonly sessions: DocumentSessionRegistry
  readonly readerStore: StoreApi<ReaderStore>
  readonly tabStore: StoreApi<TabStore>
  getSource(tabId: string): DocumentSource | null
}
export function createAppRuntime(port: Pick<LecApi, 'fileRead'>, createTabId?: () => string): AppRuntime
```

- [x] **Step 1: 写失败测试**

```ts
test('PDF 经 tabStore 打开后，来源只由运行时公开', async () => {
  const runtime = createAppRuntime({ fileRead: { getPdfUrl: vi.fn().mockResolvedValue('lec-file://token'), readBuffer: vi.fn() } }, () => 'tab-1')
  await runtime.tabStore.getState().openDocument('C:\\Books\\guide.pdf')
  expect(runtime.readerStore.getState().sessions['tab-1']).toMatchObject({ kind: 'pdf', status: 'ready' })
  expect(runtime.getSource('tab-1')).toEqual({ kind: 'pdf', url: 'lec-file://token' })
})
test('关闭标签后不再公开临时来源', async () => {
  const runtime = createAppRuntime({ fileRead: { getPdfUrl: vi.fn().mockResolvedValue('lec-file://token'), readBuffer: vi.fn() } }, () => 'tab-1')
  await runtime.tabStore.getState().openDocument('C:\\Books\\guide.pdf')
  runtime.tabStore.getState().closeTab('tab-1')
  expect(runtime.getSource('tab-1')).toBeNull()
})
```

- [x] **Step 2: 验证失败**

Run: `corepack pnpm test:run src/config/app-runtime.test.ts`

Expected: FAIL，无法解析 `./app-runtime`。

- [x] **Step 3: 实现最小组合根**

```ts
export function createAppRuntime(port: Pick<LecApi, 'fileRead'>, createTabId = () => crypto.randomUUID()): AppRuntime {
  const sessions = createDocumentSessionRegistry(createDocumentApi(port))
  const readerStore = createReaderStore({ resolveRoute: resolveDocumentRoute, registry: sessions })
  const tabStore = createTabStore({ reader: readerStore.getState(), createTabId })
  return { sessions, readerStore, tabStore, getSource: (tabId) => sessions.getSource(tabId) }
}
```

- 注释说明该模块是唯一组合 preload 的位置；不能创建 React 状态、事件监听器或 EmbedPDF 实例。

- [x] **Step 4: 验证、审阅并提交**

Run: `corepack pnpm test:run src/config/app-runtime.test.ts; corepack pnpm typecheck; git diff --check`

```bash
git add src/config/app-runtime.ts src/config/app-runtime.test.ts docs/superpowers/plans/2026-09-01-pdf-shell-integration.md
git commit -m "feat: 组合应用阅读运行时"
```

## Task 2：迁移受控 PDF 阅读组件

**Files:** Create `src/components/Reader/PdfToolbar.tsx`、`PdfSearchBar.tsx`、`PdfNavigationSidebar.tsx` 及各自测试；Create `src/pages/reader-reserved/PdfReaderPage.tsx`、测试。

**Interfaces:**

```ts
export function PdfToolbar({ registry }: { registry: PluginRegistry | null }): JSX.Element
export function PdfSearchBar({ registry, onClose }: { registry: PluginRegistry | null; onClose(): void }): JSX.Element
export function PdfNavigationSidebar({ registry }: { registry: PluginRegistry | null }): JSX.Element
export function PdfReaderPage({ url }: { url: string }): JSX.Element
```

- [x] **Step 1: 写失败测试**

```tsx
test('PDF 页面组合阅读视图、工具栏和侧栏', () => {
  const html = renderToStaticMarkup(<PdfReaderPage url="lec-file://document/token" />)
  expect(html).toContain('aria-label="PDF 阅读视图"')
  expect(html).toContain('aria-label="连续阅读"')
  expect(html).toContain('aria-label="打开 PDF 缩略图"')
})
test('缺少 registry 时工具按钮禁用', () => {
  expect(renderToStaticMarkup(<PdfToolbar registry={null} />)).toContain('disabled=""')
})
```

- [x] **Step 2: 验证失败**

Run: `corepack pnpm test:run src/components/Reader/PdfToolbar.test.tsx src/components/Reader/PdfSearchBar.test.tsx src/components/Reader/PdfNavigationSidebar.test.tsx src/pages/reader-reserved/PdfReaderPage.test.tsx`

Expected: FAIL，无法解析新增组件和页面。

- [x] **Step 3: 分职责迁移旧 App 的 PDF 控件**

```tsx
export function PdfReaderPage({ url }: { url: string }): JSX.Element {
  const [registry, setRegistry] = useState<PluginRegistry | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  return <main className="reader-shell"><PdfToolbar registry={registry} /><PdfNavigationSidebar registry={registry} />{searchOpen && <PdfSearchBar registry={registry} onClose={() => setSearchOpen(false)} />}<PDFViewer config={{ src: url }} onReady={setRegistry} /></main>
}
```

- 保留单页/连续/双页、翻页、缩放、旋转、大小写搜索、目录高亮和缩略图懒加载。
- 缩略图对象 URL、EmbedPDF 订阅和 `Ctrl+F` 监听必须由 effect cleanup 释放；registry 只为页面局部状态。
- 页面只接收 URL；组件不得导入 Store、`window.lec`、`db-api` 或 `document-session`。

- [x] **Step 4: 验证、审阅并提交**

Run: `corepack pnpm test:run src/components/Reader/PdfToolbar.test.tsx src/components/Reader/PdfSearchBar.test.tsx src/components/Reader/PdfNavigationSidebar.test.tsx src/pages/reader-reserved/PdfReaderPage.test.tsx; rg -n "window\\.lec|db-api|document-session" src/components/Reader src/pages/reader-reserved; corepack pnpm typecheck`

Expected: 测试、类型检查 PASS，扫描无匹配。

```bash
git add src/components/Reader src/pages/reader-reserved/PdfReaderPage.tsx src/pages/reader-reserved/PdfReaderPage.test.tsx docs/superpowers/plans/2026-09-01-pdf-shell-integration.md
git commit -m "refactor: 建立受控 PDF 阅读页面"
```

## Task 3：建立开始页、标签栏与文件选择桥接

**Files:** Create `src/components/TabBar/DocumentTabs.tsx`、测试；Create `src/pages/home/HomePage.tsx`、测试；Create `src/router/open-documents.ts`、测试；Modify `src/layouts/AppLayout.tsx`、`AppLayout.test.tsx`、`src/styles/index.css`。

**Interfaces:**

```ts
export function DocumentTabs(props: { tabs: ReaderTab[]; activeTabId: string; onActivate(tabId: string): void; onClose(tabId: string): void }): JSX.Element
export function HomePage({ onOpenDocuments }: { onOpenDocuments(): Promise<void> }): JSX.Element
export async function openDocumentsFromDialog(selectPaths: LecApi['dialogs']['openDocuments'], openDocument: (path: string) => Promise<string | null>): Promise<void>
```

- [x] **Step 1: 写失败测试**

```tsx
test('开始页不可关闭，文档标签可关闭', () => {
  const html = renderToStaticMarkup(<DocumentTabs tabs={[{ id: 'home', kind: 'home', title: '开始页', closable: false }, { id: 'tab-1', kind: 'document', title: 'guide.pdf', path: 'C:\\Books\\guide.pdf', closable: true }]} activeTabId="home" onActivate={() => undefined} onClose={() => undefined} />)
  expect(html).toContain('开始页')
  expect(html).toContain('aria-label="关闭 guide.pdf"')
})
test('选择器中的全部路径复用标签打开动作', async () => {
  const openDocument = vi.fn().mockResolvedValue('tab-1')
  await openDocumentsFromDialog(vi.fn().mockResolvedValue(['C:\\Books\\a.pdf', 'C:\\Books\\b.pdf']), openDocument)
  expect(openDocument).toHaveBeenNthCalledWith(2, 'C:\\Books\\b.pdf')
})
```

- [x] **Step 2: 验证失败**

Run: `corepack pnpm test:run src/components/TabBar/DocumentTabs.test.tsx src/pages/home/HomePage.test.tsx src/router/open-documents.test.ts`

Expected: FAIL，无法解析模块。

- [x] **Step 3: 实现纯展示 UI 和无 UI 桥接**

```ts
export async function openDocumentsFromDialog(selectPaths, openDocument): Promise<void> {
  for (const path of await selectPaths()) await openDocument(path)
}
```

- 标签只派发激活/关闭意图，开始页不显示关闭按钮；`HomePage` 的按钮执行 `void onOpenDocuments()`，不读 Electron。
- `AppLayout` 加可选标签插槽，标签溢出横向滚动，保持原型的浅色 slate/blue 标题栏。

- [x] **Step 4: 验证、审阅并提交**

Run: `corepack pnpm test:run src/components/TabBar/DocumentTabs.test.tsx src/pages/home/HomePage.test.tsx src/router/open-documents.test.ts; corepack pnpm typecheck; git diff --check`

```bash
git add src/components/TabBar src/pages/home src/router/open-documents.ts src/router/open-documents.test.ts src/layouts/AppLayout.tsx src/layouts/AppLayout.test.tsx src/styles/index.css docs/superpowers/plans/2026-09-01-pdf-shell-integration.md
git commit -m "feat: 建立开始页与文档标签界面"
```

## Task 4：组合页面、订阅系统请求并删除旧单体 App

**Files:** Create `src/stores/use-store-selector.ts`、测试；Create `src/pages/reader-reserved/ReaderPage.tsx`、测试；Create `src/pages/ApplicationPage.tsx`、测试；Modify `src/main.tsx`、`LecPDF-总开发清单.md`；Delete `src/renderer/src/App.tsx`、`App.test.tsx`。

**Interfaces:**

```ts
export function useStoreSelector<TState, TSlice>(store: StoreApi<TState>, selector: (state: TState) => TSlice): TSlice
export function ReaderPage({ session, source }: { session: ReaderSession | undefined; source: DocumentSource | null }): JSX.Element
export function ApplicationPage(props: { runtime: AppRuntime; lifecycle: LecApi['lifecycle']; dialogs: LecApi['dialogs'] }): JSX.Element
```

- [ ] **Step 1: 写失败的页面组合测试**

```tsx
test('已打开 PDF 的应用页面组合标签栏和阅读页', async () => {
  const runtime = createAppRuntime({ fileRead: { getPdfUrl: vi.fn().mockResolvedValue('lec-file://token'), readBuffer: vi.fn() } }, () => 'tab-1')
  await runtime.tabStore.getState().openDocument('C:\\Books\\guide.pdf')
  const lifecycle = { onOpenFileRequest: () => () => undefined, openLogsFolder: async () => undefined }
  const dialogs = { openDocuments: async () => [], openFolder: async () => null, locateMissingFile: async () => null }
  const html = renderToStaticMarkup(<ApplicationPage runtime={runtime} lifecycle={lifecycle} dialogs={dialogs} />)
  expect(html).toContain('guide.pdf')
  expect(html).toContain('aria-label="PDF 阅读视图"')
})
test('ready PDF 会话有 URL 时渲染 EmbedPDF 页面', () => {
  const session: ReaderSession = { tabId: 'tab-1', path: 'C:\\Books\\guide.pdf', title: 'guide.pdf', kind: 'pdf', status: 'ready', location: { page: null, chapter: null, percent: 0 }, error: null, requestId: 1 }
  expect(renderToStaticMarkup(<ReaderPage session={session} source={{ kind: 'pdf', url: 'lec-file://token' }} />)).toContain('aria-label="PDF 阅读视图"')
})
```

- [ ] **Step 2: 验证失败**

Run: `corepack pnpm test:run src/stores/use-store-selector.test.tsx src/pages/reader-reserved/ReaderPage.test.tsx src/pages/ApplicationPage.test.tsx`

Expected: FAIL，无法解析新增模块。

- [ ] **Step 3: 实现 selector、页面选择与根入口注入**

```tsx
const tabs = useStoreSelector(runtime.tabStore, (state) => state.tabs)
const activeTabId = useStoreSelector(runtime.tabStore, (state) => state.activeTabId)
const sessions = useStoreSelector(runtime.readerStore, (state) => state.sessions)
useEffect(() => bindOpenFileRequests(lifecycle.onOpenFileRequest, runtime.tabStore.getState().openDocument), [lifecycle, runtime])
```

- `ReaderPage` 分别处理 loading、error、PDF ready + URL、Foliate ready；只有 PDF 分支渲染 `PdfReaderPage`。
- 订阅 effect 返回取消订阅函数；开始页调用 `openDocumentsFromDialog(dialogs.openDocuments, tabStore.openDocument)`。
- `main.tsx` 创建一次运行时并注入 props；只有 `main.tsx` 有 `window.lec`。删除旧单体模块，将有效断言迁至新测试，并在总清单勾选已交付的 App 拆分、标签能力和开始页打开按钮。

- [ ] **Step 4: 完整验证、审阅并提交**

Run: `rg -n "window\\.lec" src/components src/pages; corepack pnpm test:run; corepack pnpm typecheck; corepack pnpm build; git diff --check`

Expected: `window.lec` 无匹配；全部质量门禁 PASS。

```bash
git add src/config src/components src/pages src/router src/stores src/layouts/AppLayout.tsx src/layouts/AppLayout.test.tsx src/styles/index.css src/main.tsx LecPDF-总开发清单.md docs/superpowers/plans/2026-09-01-pdf-shell-integration.md
git commit -m "feat: 接入应用壳与 PDF 标签阅读"
```

## 计划自检记录

- [x] 开始页打开入口、不可关闭开始页、20 标签限制和 EmbedPDF 阅读分别由 Task 3、既有 tabStore、Task 2/4 覆盖。
- [x] EPUB、批注、打印、夜间模式、TTS 和库索引不混入本计划；Foliate 适配为独立后续计划。
- [x] 临时资源仍在会话注册表，组件/页面不反向依赖 Electron 或数据层。
- [x] 每任务都有失败测试、最小实现、验证和中文提交；接口名称均在对应生产任务定义。
- [x] 已检查无 “TBD”、“TODO”、“implement later” 或 “fill in details” 占位语。
