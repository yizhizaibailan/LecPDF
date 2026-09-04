# Foliate 真实接入与阅读状态收口 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 以固定 Git 子模块接入真实 foliate-js，让 EPUB 打开、目录与位置事件进入 Zustand，并将 PDF 展示状态收口到 `ReaderSession`。

**Architecture:** `vendor/foliate-js` 固定在提交 `78914aef4466eb960965702401634c2cb348e9b1`。只有 `src/data/readers/foliate/` 可以导入其模块；运行时持有 Blob、`foliate-view` 和监听器，向上只发布 `ReaderEvent`。页面通过 `useStoreSelector` 取得 `ReaderSession`，控制器仅执行用户命令。

**Tech Stack:** Electron 44、React 18、TypeScript 5、Zustand 5、foliate-js `78914aef4466eb960965702401634c2cb348e9b1`、Vitest 4。

**Spec:** `docs/superpowers/specs/2026-09-04-foliate-integration-architecture-design.md`

## Global Constraints

- PDF 只使用 EmbedPDF，且 `@embedpdf/*` 只能由 `src/data/readers/pdf/` 导入。
- Foliate 子模块只能是 `vendor/foliate-js` 的固定提交 `78914aef4466eb960965702401634c2cb348e9b1`；只有 `src/data/readers/foliate/` 能导入它。
- Zustand 只保存可序列化会话状态，不保存文件字节、Blob、对象 URL、DOM、书籍实例或订阅函数。
- 组件、页面和 Store 不得直接导入 Foliate、EmbedPDF、Electron 或 `window.lec`。
- 任何 EPUB 失败事件不得包含本机绝对路径、书籍内容或原始异常堆栈。
- 每一任务预计新增或修改的非测试代码不超过 300 行，先写失败测试再实现，完成后使用中文提交并推送。

---

### Task 1: 固定 Foliate 子模块并建立 CSP/构建边界

**Files:**
- Create: `.gitmodules`
- Create: `vendor/foliate-js`（Git 子模块，提交 `78914aef4466eb960965702401634c2cb348e9b1`）
- Modify: `index.html`
- Modify: `scripts/check-architecture.mjs`
- Create: `scripts/check-foliate-integration.mjs`

**Interfaces:**
- Produces: `vendor/foliate-js/view.js` 的唯一可审计上游来源。
- Produces: 生产页面的 CSP，允许自身脚本与受控 `blob:` 阅读内容，不允许外部脚本来源。
- Produces: `pnpm foliate:check`，验证子模块路径、固定提交及 CSP。

- [ ] **Step 1: 写失败检查，声明所需的子模块与 CSP 令牌**

```js
const required = [
  'path = vendor/foliate-js',
  'url = https://github.com/johnfactotum/foliate-js.git',
  "script-src 'self'",
  'frame-src blob:',
  'worker-src blob:'
]
```

将检查写入 `scripts/check-foliate-integration.mjs`，对 `.gitmodules`、子模块 `HEAD` 与 `index.html` 逐项读取并在缺失时抛错。

- [ ] **Step 2: 运行检查，确认它因子模块/CSP 尚不存在而失败**

Run: `node scripts/check-foliate-integration.mjs`

Expected: FAIL，提示 `.gitmodules` 或 CSP 缺失。

- [ ] **Step 3: 添加固定子模块与 CSP，并限制渲染构建的来源**

```bash
git submodule add --name foliate-js https://github.com/johnfactotum/foliate-js.git vendor/foliate-js
git -C vendor/foliate-js checkout 78914aef4466eb960965702401634c2cb348e9b1
```

在 `index.html` 添加生产 CSP：

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' http://localhost:* ws://localhost:*; frame-src 'self' blob:; worker-src 'self' blob:">
```

在 `package.json` 添加：

```json
"foliate:check": "node scripts/check-foliate-integration.mjs"
```

架构检查须将相对导入 `vendor/foliate-js/` 视作 Foliate 内核导入，并只允许它出现于 `src/data/readers/foliate/`。

- [ ] **Step 4: 运行边界和构建检查，确认通过**

Run: `corepack pnpm foliate:check && corepack pnpm architecture:check && corepack pnpm build`

Expected: PASS；`git submodule status` 显示 `78914aef4466eb960965702401634c2cb348e9b1`。

- [ ] **Step 5: 提交固定版本与安全边界**

```bash
git add .gitmodules vendor/foliate-js index.html package.json scripts/check-architecture.mjs scripts/check-foliate-integration.mjs
git commit -m "build: 固定 Foliate 子模块与安全边界"
git push
```

### Task 2: 将 Foliate 自定义元素事件转换为标准 ReaderEvent

**Files:**
- Create: `src/data/readers/foliate/foliate-view-port.ts`
- Create: `src/data/readers/foliate/foliate-view-port.test.ts`
- Modify: `src/data/readers/foliate/foliate-reader-controller.ts`
- Modify: `src/data/readers/foliate/foliate-reader-controller.test.ts`

**Interfaces:**
- Produces: `FoliateViewPort`，实现 `FoliateReaderPort`。
- Produces: `createFoliateViewPort(view)`，其中 `view` 有 `open(source: Blob)`、`close()`、`book?.toc` 及事件目标能力。
- Produces: `relocate` → `location-changed`、书籍 `toc` → `outline-changed`、成功 → `ready`、失败 → `load-failed`。

- [ ] **Step 1: 写失败测试，锁定事件映射、错误脱敏和关闭后的停止回调**

```ts
const events: ReaderEvent[] = []
const port = createFoliateViewPort(view)
const unsubscribe = port.subscribe((event) => events.push(event))
await port.open(new ArrayBuffer(8))
view.dispatchEvent(new CustomEvent('relocate', { detail: { index: 2, fraction: 0.4 } }))
port.close()
view.dispatchEvent(new CustomEvent('relocate', { detail: { index: 3, fraction: 0.8 } }))

expect(events).toContainEqual({ type: 'location-changed', location: { page: null, chapter: '2', percent: 0.4 } })
expect(events.at(-1)).not.toMatchObject({ location: { chapter: '3' } })
unsubscribe()
```

另写断言：`book.toc` 的 `label`、`href` 与 `subitems` 被递归转换为 `ReaderOutlineItem`，且 `load-failed.error.message` 不含传入异常文本。

- [ ] **Step 2: 运行测试，确认模块尚不存在而失败**

Run: `corepack pnpm test:run -- src/data/readers/foliate/foliate-view-port.test.ts`

Expected: FAIL，提示无法解析 `foliate-view-port`。

- [ ] **Step 3: 实现最小事件端口与幂等资源释放**

```ts
export type FoliateViewElement = EventTarget & {
  open(source: Blob): Promise<void>
  close(): void
  book?: { toc?: FoliateTocItem[] }
}

export function createFoliateViewPort(view: FoliateViewElement): FoliateReaderPort {
  const listeners = new Set<(event: ReaderEvent) => void>()
  let closed = false
  const publish = (event: ReaderEvent): void => { if (!closed) listeners.forEach((listener) => listener(event)) }
  const onRelocate = (event: Event): void => publish(toLocationEvent((event as CustomEvent<FoliateRelocate>).detail))
  view.addEventListener('relocate', onRelocate)
  return {
    async open(bytes) { await view.open(new Blob([bytes], { type: 'application/epub+zip' })); publish({ type: 'outline-changed', outline: toReaderOutline(view.book?.toc ?? []) }); publish({ type: 'ready' }) },
    close() { if (closed) return; closed = true; view.removeEventListener('relocate', onRelocate); view.close(); listeners.clear() },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener) } }
  }
}
```

`toLoadFailure` 必须返回固定的中文消息“无法打开电子书”，只保留标准错误码。

- [ ] **Step 4: 运行 Foliate 端口与控制器测试，确认通过**

Run: `corepack pnpm test:run -- src/data/readers/foliate/foliate-view-port.test.ts src/data/readers/foliate/foliate-reader-controller.test.ts`

Expected: PASS；重复 `close()` 和重复取消订阅均不重复释放。

- [ ] **Step 5: 提交 Foliate 事件端口**

```bash
git add src/data/readers/foliate/foliate-view-port.ts src/data/readers/foliate/foliate-view-port.test.ts src/data/readers/foliate/foliate-reader-controller.ts src/data/readers/foliate/foliate-reader-controller.test.ts
git commit -m "feat: 转换 Foliate 阅读事件"
git push
```

### Task 3: 挂载真实 Foliate 运行时并替换 EPUB 占位页面

**Files:**
- Create: `src/data/readers/foliate/FoliateReaderRuntime.tsx`
- Create: `src/data/readers/foliate/FoliateReaderRuntime.test.tsx`
- Create: `src/pages/reader-reserved/FoliateReaderPage.tsx`
- Create: `src/pages/reader-reserved/FoliateReaderPage.test.tsx`
- Modify: `src/pages/reader-reserved/ReaderPage.tsx`
- Modify: `src/pages/reader-reserved/ReaderPage.test.tsx`

**Interfaces:**
- Consumes: `DocumentSource` 的 Foliate 字节、`FoliateViewPort` 与 `ReaderEvent`。
- Produces: `FoliateReaderRuntime({ bytes, onReaderEvent })`；只在数据层动态导入 `../../../../vendor/foliate-js/view.js`。
- Produces: 真实 `foliate-view` 容器，成功时替代“架构已就绪”占位文字。

- [ ] **Step 1: 写失败测试，声明运行时必须打开、订阅并在卸载时关闭**

```tsx
const close = vi.fn()
render(<FoliateReaderRuntime bytes={new ArrayBuffer(4)} onReaderEvent={onReaderEvent} createView={() => view} />)
await waitFor(() => expect(view.open).toHaveBeenCalledOnce())
unmount()
expect(close).toHaveBeenCalledOnce()
```

另写页面测试：当 `session.kind === 'foliate'` 且来源为 Foliate 字节时，输出 `aria-label="EPUB 阅读视图"`；源码不包含 `foliate-js` 或 `window.lec`。

- [ ] **Step 2: 运行测试，确认缺少运行时和页面而失败**

Run: `corepack pnpm test:run -- src/data/readers/foliate/FoliateReaderRuntime.test.tsx src/pages/reader-reserved/FoliateReaderPage.test.tsx`

Expected: FAIL，提示模块无法解析。

- [ ] **Step 3: 实现受控运行时、动态导入与卸载流程**

```tsx
useEffect(() => {
  let disposed = false
  let port: FoliateReaderPort | null = null
  void import('../../../../vendor/foliate-js/view.js').then(() => {
    if (disposed) return
    const view = createView()
    host.current?.replaceChildren(view)
    port = createFoliateViewPort(view)
    const unsubscribe = port.subscribe(onReaderEvent)
    void port.open(bytes).catch(() => onReaderEvent({ type: 'load-failed', error: { code: 'document-read-failed', message: '无法打开电子书' } }))
    cleanup = () => { unsubscribe(); port?.close(); view.remove() }
  })
  return () => { disposed = true; cleanup?.() }
}, [bytes, onReaderEvent])
```

运行时不把 `view`、`port` 或 Blob 保存进 Store。`ReaderPage` 改为渲染 `FoliateReaderPage`，并以 `session.tabId` 作为 key，确保切换标签时卸载旧视图。

- [ ] **Step 4: 运行 EPUB 页面与路由回归测试，确认通过**

Run: `corepack pnpm test:run -- src/data/readers/foliate/FoliateReaderRuntime.test.tsx src/pages/reader-reserved/FoliateReaderPage.test.tsx src/pages/reader-reserved/ReaderPage.test.tsx`

Expected: PASS；测试通过注入的假 view 验证生命周期，不加载真实 EPUB。

- [ ] **Step 5: 提交真实 EPUB 运行时**

```bash
git add src/data/readers/foliate/FoliateReaderRuntime.tsx src/data/readers/foliate/FoliateReaderRuntime.test.tsx src/pages/reader-reserved/FoliateReaderPage.tsx src/pages/reader-reserved/FoliateReaderPage.test.tsx src/pages/reader-reserved/ReaderPage.tsx src/pages/reader-reserved/ReaderPage.test.tsx
git commit -m "feat: 接入 Foliate EPUB 阅读运行时"
git push
```

### Task 4: 将 PDF 工具栏与目录展示状态改为 ReaderSession selector 来源

**Files:**
- Modify: `src/types/reader.ts`
- Modify: `src/stores/reader-store.ts`
- Modify: `src/stores/reader-store.test.ts`
- Modify: `src/data/readers/pdf/EmbedPdfReaderRuntime.tsx`
- Modify: `src/data/readers/pdf/EmbedPdfReaderRuntime.test.ts`
- Modify: `src/pages/reader-reserved/PdfReaderPage.tsx`
- Modify: `src/components/Reader/PdfToolbar.tsx`
- Modify: `src/components/Reader/PdfNavigationSidebar.tsx`
- Create: `src/components/Reader/PdfToolbar.test.tsx`
- Create: `src/components/Reader/PdfNavigationSidebar.test.tsx`

**Interfaces:**
- Produces: `ReaderSession.pageCount: number | null` 与 `page-state-changed` 事件，保证页码总数是 Store 状态。
- Produces: 工具栏和目录侧栏的展示 props：`location`、`pageCount`、`outline`。
- Consumes: 控制器仅作为 `goToPage`、`nextPage`、`previousPage`、缩放及目录跳转的命令执行器。

- [ ] **Step 1: 写失败测试，说明展示快照来自会话而不是控制器订阅**

```tsx
render(<PdfToolbar ready pageController={controller} location={{ page: 8, chapter: null, percent: 0.4 }} pageCount={20} />)
expect(screen.getByLabelText('跳转到页码')).toHaveValue(8)
expect(screen.getByText('/ 20')).toBeInTheDocument()

render(<PdfNavigationSidebar outline={[{ id: 'a', title: '第一章', location, children: [] }]} onGoToLocation={goTo} />)
expect(screen.getByRole('button', { name: '第一章' })).toBeInTheDocument()
```

同时在 Store 测试中断言 `page-state-changed` 只更新目标会话的 `location` 与 `pageCount`。

- [ ] **Step 2: 运行目标测试，确认新 props 与事件尚不存在而失败**

Run: `corepack pnpm test:run -- src/stores/reader-store.test.ts src/components/Reader/PdfToolbar.test.tsx src/components/Reader/PdfNavigationSidebar.test.tsx`

Expected: FAIL，提示 `pageCount`、`outline` 或 `page-state-changed` 不存在。

- [ ] **Step 3: 扩展事件归约，并让 PDF 运行时发布完整页码状态**

```ts
type ReaderEvent =
  | { type: 'ready' }
  | { type: 'location-changed'; location: ReaderLocation }
  | { type: 'page-state-changed'; location: ReaderLocation; pageCount: number }
  | { type: 'outline-changed'; outline: ReaderOutlineItem[] }
  | { type: 'search-changed'; search: ReaderSearchState }
  | { type: 'view-preferences-changed'; view: ReaderViewPreferences }
  | { type: 'load-failed'; error: DocumentOpenError }

case 'page-state-changed':
  return { ...session, location: event.location, pageCount: event.pageCount }
```

PDF 的 `subscribePageState` 改为发布：

```ts
onReaderEvent({
  type: 'page-state-changed',
  location: { page: currentPage, chapter: null, percent: totalPages === 0 ? 0 : currentPage / totalPages },
  pageCount: totalPages
})
```

工具栏的输入值和 `/ N` 从 props 渲染；目录树从 `outline` prop 渲染。点击仍调用传入的命令回调，因此组件不接触 EmbedPDF。

- [ ] **Step 4: 运行 Store、PDF 适配器与组件回归测试，确认通过**

Run: `corepack pnpm test:run -- src/stores/reader-store.test.ts src/data/readers/pdf/EmbedPdfReaderRuntime.test.ts src/components/Reader/PdfToolbar.test.tsx src/components/Reader/PdfNavigationSidebar.test.tsx src/pages/reader-reserved/PdfReaderPage.test.tsx`

Expected: PASS；源码检查表明两个组件没有 Store、Foliate、EmbedPDF、Electron 或 `window.lec` 导入。

- [ ] **Step 5: 提交 PDF selector 状态收口**

```bash
git add src/types/reader.ts src/stores/reader-store.ts src/stores/reader-store.test.ts src/data/readers/pdf/EmbedPdfReaderRuntime.tsx src/data/readers/pdf/EmbedPdfReaderRuntime.test.ts src/pages/reader-reserved/PdfReaderPage.tsx src/components/Reader/PdfToolbar.tsx src/components/Reader/PdfToolbar.test.tsx src/components/Reader/PdfNavigationSidebar.tsx src/components/Reader/PdfNavigationSidebar.test.tsx
git commit -m "refactor: 收口 PDF 阅读展示状态"
git push
```

### Task 5: 将 PDF 搜索展示状态改为 ReaderSession selector 来源

**Files:**
- Modify: `src/data/readers/pdf/pdf-search-controller.ts`
- Modify: `src/data/readers/pdf/pdf-search-controller.test.ts`
- Modify: `src/data/readers/pdf/embedpdf-search-port.ts`
- Modify: `src/data/readers/pdf/EmbedPdfReaderRuntime.tsx`
- Modify: `src/data/readers/pdf/EmbedPdfReaderRuntime.test.ts`
- Modify: `src/components/Reader/PdfSearchBar.tsx`
- Create: `src/components/Reader/PdfSearchBar.test.tsx`
- Modify: `src/pages/reader-reserved/PdfReaderPage.tsx`

**Interfaces:**
- Produces: 含 `query` 的 `PdfSearchState`，可完整转换为 `ReaderSearchState`。
- Produces: `subscribePdfReaderEvents` 对搜索控制器的订阅及 `search-changed` 事件。
- Produces: `PdfSearchBar` 的 `search: ReaderSearchState` 展示 props；控制器仅执行搜索、上一项、下一项和停止命令。

- [ ] **Step 1: 写失败测试，说明搜索结果快照来自 ReaderSession**

```tsx
render(<PdfSearchBar controller={controller} search={{ query: 'LecPDF', total: 3, activeIndex: 1, searching: false }} onClose={onClose} />)
expect(screen.getByDisplayValue('LecPDF')).toBeInTheDocument()
expect(screen.getByText('2 / 3')).toBeInTheDocument()
```

另写适配器测试：搜索控制器发布 `{ query: 'LecPDF', total: 3, activeIndex: 1, searching: false }` 时，运行时发布同值的 `search-changed` 事件。

- [ ] **Step 2: 运行目标测试，确认 search props 与 query 字段尚不存在而失败**

Run: `corepack pnpm test:run -- src/data/readers/pdf/pdf-search-controller.test.ts src/data/readers/pdf/EmbedPdfReaderRuntime.test.ts src/components/Reader/PdfSearchBar.test.tsx`

Expected: FAIL，提示 `PdfSearchState.query` 或 `PdfSearchBar.search` 不存在。

- [ ] **Step 3: 让搜索端口保存查询词，运行时回写 ReaderEvent，组件只读会话快照**

```ts
export type PdfSearchState = { query: string; total: number; activeIndex: number; searching: boolean }

const unsubscribeSearch = searchController.subscribe((state) => {
  onReaderEvent({ type: 'search-changed', search: state })
})
```

`PdfSearchBar` 保留输入中的未提交草稿和大小写开关这两项局部交互状态；计数、活动索引和已执行查询词从 `search` prop 显示。调用 `controller.search`、`previous`、`next` 和 `stop` 后，等待 Store 回写新快照，而不手工写入结果计数。

- [ ] **Step 4: 运行搜索、页面与 Store 回归测试，确认通过**

Run: `corepack pnpm test:run -- src/data/readers/pdf/pdf-search-controller.test.ts src/data/readers/pdf/EmbedPdfReaderRuntime.test.ts src/components/Reader/PdfSearchBar.test.tsx src/pages/reader-reserved/PdfReaderPage.test.tsx src/stores/reader-store.test.ts`

Expected: PASS；关闭搜索栏后控制器订阅已释放，旧搜索事件不会改写已关闭标签。

- [ ] **Step 5: 提交 PDF 搜索 selector 状态收口**

```bash
git add src/data/readers/pdf/pdf-search-controller.ts src/data/readers/pdf/pdf-search-controller.test.ts src/data/readers/pdf/embedpdf-search-port.ts src/data/readers/pdf/EmbedPdfReaderRuntime.tsx src/data/readers/pdf/EmbedPdfReaderRuntime.test.ts src/components/Reader/PdfSearchBar.tsx src/components/Reader/PdfSearchBar.test.tsx src/pages/reader-reserved/PdfReaderPage.tsx
git commit -m "refactor: 收口 PDF 搜索展示状态"
git push
```

### Task 6: 验收真实 EPUB、更新架构记录并执行完整质量门禁

**Files:**
- Modify: `LecPDF-ARCHITECTURE.md`
- Modify: `LecPDF-总开发清单.md`
- Modify: `docs/superpowers/plans/2026-09-04-foliate-integration-and-reader-state.md`
- Create: `docs/verification/2026-09-04-epub-smoke-test.md`

**Interfaces:**
- Produces: 可复查的子模块版本、CSP、EPUB 生命周期、事件流与人工冒烟记录。
- Produces: 总开发清单中“安装并封装 foliate-js”与“统一 PDF 与 EPUB 会话/加载/错误/分发”的完成状态；只有验证、提交、推送后才能勾选。

- [ ] **Step 1: 写验收清单，覆盖真实打开、位置事件、目录和关闭释放**

```markdown
- [ ] 在开发模式打开一份 `.epub`，看到 EPUB 阅读视图而非占位文字。
- [ ] 翻页后检查该标签的 ReaderSession 章节与百分比发生变化。
- [ ] 切换到 PDF 再返回，EPUB 视图仍可用且未重复挂载。
- [ ] 关闭 EPUB 标签后，旧视图不再写入 Store，控制台无未处理异常。
- [ ] 验证 EPUB 内嵌脚本无法访问 window.lec。
```

- [ ] **Step 2: 执行人工 EPUB 冒烟与子模块检查，并记录实际结果**

Run: `git submodule status && corepack pnpm foliate:check && corepack pnpm dev`

Expected: 记录固定提交、测试 EPUB 文件名（不记录路径）、每一条冒烟结论及失败现象；若任一步失败，停止勾选并先修复。

- [ ] **Step 3: 更新架构文档与总开发清单**

在 `LecPDF-ARCHITECTURE.md` 写明：Foliate 真实视图和临时资源由数据层运行时持有；`ReaderEvent` 是跨引擎进入 Store 的唯一状态入口；PDF 工具栏和目录展示快照来自 `ReaderSession`。

将总清单下列两项改为 `[x]`：

```markdown
- [x] 安装并封装 foliate-js，建立与通用 ReaderEngine 对接的适配层。
- [x] 统一 PDF 与 EPUB 的阅读会话、错误态、加载态和文档类型分发。
```

- [ ] **Step 4: 执行全量质量门禁**

Run: `corepack pnpm quality:check && git diff --check && git status --short --branch`

Expected: 测试、类型、架构、Foliate 固定版本/CSP、注释与生产构建全部 PASS，且仅预期的文档变更待提交。

- [ ] **Step 5: 提交验证记录与进度勾选**

```bash
git add LecPDF-ARCHITECTURE.md LecPDF-总开发清单.md docs/superpowers/plans/2026-09-04-foliate-integration-and-reader-state.md docs/verification/2026-09-04-epub-smoke-test.md
git commit -m "docs: 验收 Foliate 阅读架构"
git push
```
