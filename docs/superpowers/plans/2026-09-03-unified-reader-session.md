# 统一阅读会话与 Foliate 适配 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 PDF 与 Foliate 会话通过统一 `ReaderEvent` 回写 Zustand，并建立不依赖未验证 Foliate 包的受控适配器骨架。

**Architecture:** `readerStore` 是所有可序列化阅读状态的唯一写入者。引擎适配器只发布 `ReaderEvent`；文件字节、对象 URL、内核实例和订阅函数继续由数据层注册表或引擎运行时拥有。PDF 运行时把内核事件转换为事件回调；Foliate 只定义端口、控制器和生命周期边界。

**Tech Stack:** Electron 44、React 18、TypeScript 5、Zustand 5、EmbedPDF 2、Vitest 4。

**Spec:** `docs/superpowers/specs/2026-09-03-unified-reader-session-design.md`

## Global Constraints

- PDF 只使用 EmbedPDF，且 `@embedpdf/*` 只能由 `src/data/readers/pdf/` 导入。
- EPUB 与后续非 PDF 电子书只允许使用 foliate-js；本计划不安装或伪造 Foliate 运行时。
- Zustand 只保存可序列化状态，不保存引擎实例、DOM 引用、对象 URL、文件字节或订阅函数。
- 组件、页面和 Store 不得直接导入 EmbedPDF、foliate-js、Electron 或 `window.lec`。
- 每个新增 TS/TSX 文件必须有中文职责与资源释放注释，并先写失败测试再实现。

---

### Task 1: 扩展统一阅读状态与事件归约

**Files:**
- Modify: `src/types/reader.ts`
- Modify: `src/stores/reader-store.ts`
- Modify: `src/stores/reader-store.test.ts`

**Interfaces:**
- Produces: `ReaderOutlineItem`、`ReaderSearchState`、`ReaderViewPreferences`、扩展后的 `ReaderEvent`。
- Produces: `ReaderStore.applyEvent(tabId: string, event: ReaderEvent): void`。
- Consumes: 现有 `ReaderSession`、`DocumentOpenError` 与请求编号保护规则。

- [ ] **Step 1: 写失败测试，说明事件只影响目标标签会话**

```ts
store.getState().applyEvent('tab-a', {
  type: 'location-changed',
  location: { page: 9, chapter: null, percent: 0.4 }
})

expect(store.getState().sessions['tab-a'].location.page).toBe(9)
expect(store.getState().sessions['tab-b'].location.page).toBeNull()
```

- [ ] **Step 2: 运行失败测试并确认原因是 `applyEvent` 尚未定义**

Run: `corepack pnpm test:run -- src/stores/reader-store.test.ts`

Expected: FAIL，提示 `applyEvent is not a function` 或 TypeScript 缺少该属性。

- [ ] **Step 3: 在 `src/types/reader.ts` 声明可序列化会话字段与事件**

```ts
export type ReaderOutlineItem = { id: string; title: string; location: ReaderLocation; children: ReaderOutlineItem[] }
export type ReaderSearchState = { query: string; total: number; activeIndex: number; searching: boolean }
export type ReaderViewPreferences = { layout: 'single' | 'continuous' | 'double' | null; zoom: number | null }

export type ReaderEvent =
  | { type: 'ready' }
  | { type: 'location-changed'; location: ReaderLocation }
  | { type: 'outline-changed'; outline: ReaderOutlineItem[] }
  | { type: 'search-changed'; search: ReaderSearchState }
  | { type: 'view-preferences-changed'; view: ReaderViewPreferences }
  | { type: 'load-failed'; error: DocumentOpenError }
```

- [ ] **Step 4: 在 `reader-store.ts` 实现 `applyEvent` 的不可变归约**

```ts
applyEvent(tabId, event) {
  set((state) => applyReaderEvent(state, tabId, event))
}

function applyReaderEvent(state: ReaderStore, tabId: string, event: ReaderEvent): ReaderStore {
  const session = state.sessions[tabId]
  if (session === undefined) return state
  // 对事件种类逐一写入 session；load-failed 同时将状态置为 error。
}
```

- [ ] **Step 5: 运行 Store 测试并确认通过**

Run: `corepack pnpm test:run -- src/stores/reader-store.test.ts`

Expected: PASS，包含未知标签不创建会话与加载失败事件写入错误的覆盖。

- [ ] **Step 6: 提交**

```bash
git add src/types/reader.ts src/stores/reader-store.ts src/stores/reader-store.test.ts
git commit -m "feat: 统一阅读会话事件状态"
```

### Task 2: 建立 Foliate 受控适配器骨架

**Files:**
- Create: `src/data/readers/foliate/foliate-reader-controller.ts`
- Create: `src/data/readers/foliate/foliate-reader-controller.test.ts`
- Modify: `src/pages/reader-reserved/ReaderPage.tsx`
- Modify: `src/pages/reader-reserved/ReaderPage.test.tsx`

**Interfaces:**
- Consumes: Task 1 的 `ReaderEvent`。
- Produces: `FoliateReaderPort` 与 `FoliateReaderController`。
- Produces: Foliate 会话的明确架构就绪占位状态，不创建假阅读器。

- [ ] **Step 1: 写失败测试，说明控制器必须委托打开、订阅和关闭**

```ts
const events: ReaderEvent[] = []
const controller = createFoliateReaderController(port)
const unsubscribe = controller.subscribe((event) => events.push(event))
await controller.open(new ArrayBuffer(4))
controller.close()
unsubscribe()

expect(port.opened).toBe(true)
expect(port.closed).toBe(true)
expect(port.unsubscribeCount).toBe(1)
```

- [ ] **Step 2: 运行失败测试并确认模块不存在**

Run: `corepack pnpm test:run -- src/data/readers/foliate/foliate-reader-controller.test.ts`

Expected: FAIL，提示无法解析 `foliate-reader-controller`。

- [ ] **Step 3: 实现不依赖 foliate-js 的端口与控制器**

```ts
export type FoliateReaderPort = {
  open(bytes: ArrayBuffer): Promise<void>
  close(): void
  subscribe(listener: (event: ReaderEvent) => void): () => void
}

export function createFoliateReaderController(port: FoliateReaderPort): FoliateReaderController {
  return { open: (bytes) => port.open(bytes), close: () => port.close(), subscribe: (listener) => port.subscribe(listener) }
}
```

- [ ] **Step 4: 将 `ReaderPage` 的 Foliate 占位改为受控架构状态**

```tsx
if (session.kind === 'foliate' && source?.kind === 'foliate') {
  return <main className="reader-page reader-page--foliate" aria-live="polite">电子书阅读器架构已就绪，等待 Foliate 内核验证接入</main>
}
```

- [ ] **Step 5: 运行 Foliate 与阅读页测试并确认通过**

Run: `corepack pnpm test:run -- src/data/readers/foliate/foliate-reader-controller.test.ts src/pages/reader-reserved/ReaderPage.test.tsx`

Expected: PASS，且测试不导入 foliate-js。

- [ ] **Step 6: 提交**

```bash
git add src/data/readers/foliate src/pages/reader-reserved/ReaderPage.tsx src/pages/reader-reserved/ReaderPage.test.tsx
git commit -m "feat: 建立 Foliate 阅读适配骨架"
```

### Task 3: 将 PDF 阅读事件回写统一会话

**Files:**
- Modify: `src/data/readers/pdf/EmbedPdfReaderRuntime.tsx`
- Modify: `src/pages/reader-reserved/PdfReaderPage.tsx`
- Modify: `src/pages/reader-reserved/ReaderPage.tsx`
- Modify: `src/pages/ApplicationPage.tsx`
- Create: `src/pages/reader-reserved/PdfReaderPage.test.tsx`（补充事件断言）

**Interfaces:**
- Consumes: Task 1 的 `ReaderEvent` 与 `ReaderStore.applyEvent`。
- Consumes: 现有 `PdfReaderController.subscribePageState`、`PdfNavigationController.subscribe`。
- Produces: `onReaderEvent(event: ReaderEvent): void` 受控回调，不泄露 EmbedPDF 类型。

- [ ] **Step 1: 写失败测试，说明 PDF 页码事件通过回调离开适配层**

```ts
const events: ReaderEvent[] = []
renderToStaticMarkup(<PdfReaderPage url="lec-file://document/token" onReaderEvent={(event) => events.push(event)} />)

expect(readFileSync(new URL('./PdfReaderPage.tsx', import.meta.url), 'utf8')).toContain('onReaderEvent')
```

- [ ] **Step 2: 运行失败测试并确认公开属性尚不存在**

Run: `corepack pnpm test:run -- src/pages/reader-reserved/PdfReaderPage.test.tsx`

Expected: FAIL，提示 `PdfReaderPage` 不接受 `onReaderEvent`。

- [ ] **Step 3: 在 PDF 运行时订阅控制器并发出标准事件**

```tsx
useEffect(() => {
  if (pageController === null) return
  return pageController.subscribePageState(({ currentPage, totalPages }) => {
    onReaderEvent?.({ type: 'location-changed', location: { page: currentPage, chapter: null, percent: totalPages === 0 ? 0 : currentPage / totalPages } })
  })
}, [onReaderEvent, pageController])
```

- [ ] **Step 4: 沿 `ReaderPage` 与 `ApplicationPage` 传递 Store action**

```tsx
<ReaderPage
  session={activeSession}
  source={activeSource}
  onReaderEvent={(event) => runtime.readerStore.getState().applyEvent(activeTabId, event)}
/>
```

- [ ] **Step 5: 运行 PDF 页面及 Store 回归测试并确认通过**

Run: `corepack pnpm test:run -- src/pages/reader-reserved/PdfReaderPage.test.tsx src/pages/reader-reserved/ReaderPage.test.tsx src/stores/reader-store.test.ts`

Expected: PASS，源码检查表明组件不直接导入 EmbedPDF、Foliate、Electron 或 `window.lec`。

- [ ] **Step 6: 提交**

```bash
git add src/data/readers/pdf/EmbedPdfReaderRuntime.tsx src/pages/reader-reserved/PdfReaderPage.tsx src/pages/reader-reserved/ReaderPage.tsx src/pages/ApplicationPage.tsx src/pages/reader-reserved/PdfReaderPage.test.tsx
git commit -m "feat: 回写 PDF 阅读事件至会话状态"
```

### Task 4: 强化架构检查、文档与全量验证

**Files:**
- Modify: `scripts/check-architecture.mjs`
- Modify: `LecPDF-ARCHITECTURE.md`
- Modify: `LecPDF-总开发清单.md`
- Modify: `docs/superpowers/plans/2026-09-03-unified-reader-session.md`

**Interfaces:**
- Consumes: Task 1 至 3 完成后的目录和公开接口。
- Produces: 对 Foliate 导入位置和阅读事件流的持续验证记录。

- [ ] **Step 1: 写失败检查用例，声明 Foliate 只能在数据适配层出现**

```ts
const forbidden = [/window\.lec/, /from ['"]electron['"]/, /@embedpdf/, /foliate-js/]
const allowedEngineRoots = ['src/data/readers/pdf', 'src/data/readers/foliate']
```

- [ ] **Step 2: 运行架构检查并确认错误导入会被报告**

Run: `corepack pnpm architecture:check`

Expected: 在临时违反规则的测试夹具上 FAIL；正常源代码通过。

- [ ] **Step 3: 更新架构文档与总清单**

```markdown
- [x] 建立统一阅读会话、ReaderEvent 与 Foliate 适配器骨架。
- [x] PDF 适配器事件经 readerStore 回写，不直接改变跨组件状态。
```

- [ ] **Step 4: 执行完整质量门禁**

Run: `corepack pnpm quality:check`

Expected: 测试、类型、架构、注释和生产构建全部通过。

- [ ] **Step 5: 提交并推送**

```bash
git add scripts/check-architecture.mjs LecPDF-ARCHITECTURE.md LecPDF-总开发清单.md docs/superpowers/plans/2026-09-03-unified-reader-session.md
git commit -m "docs: 完成统一阅读会话架构记录"
git push
```
