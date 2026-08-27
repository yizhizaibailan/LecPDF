# LecPDF EPUB 锚点验证 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Electron + epub.js 0.3.93 中实现和验证 `CFI + exact/prefix/suffix` 双重锚点，保证未改 EPUB 100% 恢复，失效锚点不会静默跳错。

**Architecture:** `EpubAnchorResolver` 不依赖 UI；CFI 是首选定位，TextQuote 是可审计降级路径。解析结果为 `resolved | ambiguous | orphaned`，只有唯一文本匹配才自动重定位。

**Tech Stack:** Electron 基线、epubjs 0.3.93、JSZip 3.10.1、Vitest 4.1.10、DOM Range/TreeWalker。

**Spec:** `docs/superpowers/specs/2026-08-27-lecpdf-technical-risk-validation-design.md`

## Global Constraints

- 依赖基线计划和 `reflow.epub` fixture。
- 未改变内容时，全部测试锚点恢复率必须为 100%。
- 字号、行距、页边距、窗口尺寸和分页/滚动切换不得改变语义锚点。
- 多匹配或无匹配时返回显式状态，禁止选择“最接近”的位置并静默跳转。
- 禁止商业 SDK、网络和云端文本处理。

---

### Task 1: 定义持久化锚点和唯一文本匹配器

**Files:**
- Modify: `spikes/package.json`
- Create: `spikes/labs/epub-anchor/model.ts`
- Create: `spikes/labs/epub-anchor/text-quote.ts`
- Test: `spikes/tests/epub-text-quote.test.ts`

**Interfaces:**
- Produces: `EpubAnchor`、`AnchorResolution`、`findTextQuote(root, quote)`。
- Consumes: 标准 DOM Node/Range。

- [ ] **Step 1: 安装精确版本**

Run: `corepack pnpm add --save-exact epubjs@0.3.93`

Expected: package.json and lockfile contain exactly `0.3.93`.

- [ ] **Step 2: 写唯一、多匹配、无匹配失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { findTextQuote } from '../labs/epub-anchor/text-quote';

describe('TextQuote resolution', () => {
  it('uses prefix and suffix to select one repeated phrase', () => {
    document.body.innerHTML = '<p>Alpha shared phrase Omega.</p><p>Beta shared phrase Gamma.</p>';
    expect(findTextQuote(document.body, {
      exact: 'shared phrase', prefix: 'Alpha ', suffix: ' Omega.',
    }).status).toBe('resolved');
  });
  it('refuses an ambiguous quote', () => {
    document.body.innerHTML = '<p>x same y</p><p>x same y</p>';
    expect(findTextQuote(document.body, { exact: 'same', prefix: 'x ', suffix: ' y' }).status).toBe('ambiguous');
  });
});
```

- [ ] **Step 3: 运行并确认失败**

Run: `corepack pnpm vitest run tests/epub-text-quote.test.ts --environment jsdom`

Expected: FAIL，matcher 不存在。

- [ ] **Step 4: 实现模型和匹配器**

```ts
export interface EpubAnchor {
  cfi: string;
  quote: { exact: string; prefix: string; suffix: string };
  spineHref: string;
}
export type AnchorResolution =
  | { status: 'resolved'; range: Range; method: 'cfi' | 'textQuote' }
  | { status: 'ambiguous'; matches: number }
  | { status: 'orphaned'; reason: 'cfi-invalid' | 'quote-not-found' };
```

Flatten visible text with `TreeWalker`, preserve node/offset mapping, find all exact matches, then filter by normalized prefix and suffix. Return a Range only when exactly one candidate remains.

- [ ] **Step 5: 运行测试和检查点**

Run: `corepack pnpm vitest run tests/epub-text-quote.test.ts --environment jsdom`

Expected: PASS。

Commit if Git exists; otherwise record Task 1 in `Execution Notes`.

### Task 2: 从 epub.js 选区创建锚点并优先按 CFI 恢复

**Files:**
- Create: `spikes/labs/epub-anchor/epub-anchor-resolver.ts`
- Test: `spikes/tests/epub-anchor-resolver.test.ts`

**Interfaces:**
- Consumes: epub.js `rendition.on('selected')`、`book.getRange(cfi)`、`rendition.display(cfi)`。
- Produces: `createAnchor(cfi, range, spineHref)`、`resolveAnchor(book, anchor)`。

- [ ] **Step 1: 写 CFI 优先和文本降级测试**

```ts
it('uses CFI when epub.js returns the same exact text', async () => {
  const result = await resolver.resolveAnchor(book, anchor);
  expect(result).toMatchObject({ status: 'resolved', method: 'cfi' });
});

it('falls back to TextQuote when getRange rejects', async () => {
  book.getRange.mockRejectedValue(new Error('invalid CFI'));
  const result = await resolver.resolveAnchor(book, anchor);
  expect(result).toMatchObject({ status: 'resolved', method: 'textQuote' });
});
```

- [ ] **Step 2: 运行失败测试**

Run: `corepack pnpm vitest run tests/epub-anchor-resolver.test.ts --environment jsdom`

Expected: FAIL，resolver 不存在。

- [ ] **Step 3: 实现解析顺序**

Call `book.getRange(anchor.cfi)`. Accept it only when normalized `range.toString()` equals `anchor.quote.exact`; otherwise treat it as drift and run TextQuote within the recorded spine document. Persist 32 visible characters before and after the selection as prefix/suffix.

- [ ] **Step 4: 运行测试和检查点**

Run: `corepack pnpm vitest run tests/epub-anchor-resolver.test.ts --environment jsdom`

Expected: PASS，包括 CFI 指向错误文本时拒绝静默跳转。

Commit if Git exists; otherwise record Task 2.

### Task 3: Electron 重排矩阵与失效演练

**Files:**
- Create: `spikes/labs/epub-anchor/index.tsx`
- Create: `spikes/labs/epub-anchor/reflow-matrix.ts`
- Test: `spikes/tests/epub-anchor-matrix.test.ts`

**Interfaces:**
- Produces: `runAnchorMatrix(): Promise<LabResult>`。
- Consumes: 基线 `LabDefinition`、`reflow.epub`、resolver。

- [ ] **Step 1: 定义固定矩阵测试**

```ts
const matrix = [
  { flow: 'paginated', width: 800, fontSize: 14, lineHeight: 1.4, margin: 3 },
  { flow: 'paginated', width: 1200, fontSize: 23, lineHeight: 2.2, margin: 6 },
  { flow: 'scrolled-doc', width: 800, fontSize: 17, lineHeight: 1.8, margin: 5 },
] as const;

it('restores every unchanged-book anchor in every layout', async () => {
  const result = await runMatrixAgainstFixture(matrix);
  expect(result.total).toBeGreaterThanOrEqual(20);
  expect(result.restored).toBe(result.total);
  expect(result.wrongText).toBe(0);
});
```

- [ ] **Step 2: 实现 lab UI 与矩阵执行器**

Create at least 20 anchors covering Chinese, English, cross-line, inline `<em>`, `<strong>`, link boundaries and repeated phrases. For each matrix row: destroy rendition, recreate it, apply settings, resolve anchors and compare exact text.

- [ ] **Step 3: 添加修改版 EPUB 失效演练**

Generate a derivative fixture that inserts a paragraph before selections and another that duplicates one quoted sentence. Assert unique quotes resolve by TextQuote; duplicated quote returns `ambiguous`; deleted quote returns `orphaned`.

- [ ] **Step 4: 运行验证并保存证据**

Run: `corepack pnpm test; corepack pnpm dev`

Expected: unchanged book reports 100%; drifted unique anchors recover; ambiguous/deleted anchors never auto-jump. Save `spikes/results/epub-anchor.json`. Set `commercialDecision` to `not-needed` unless the verdict is `开源不可行`; in that case set `pending` and request user approval before any commercial download or trial.

- [ ] **Step 5: 判定与检查点**

- `原生支持` only if CFI alone passes every unchanged and drift case.
- `应用层扩展` when CFI + TextQuote passes all approved criteria.
- `需要 fork` only if epub.js CFI generation or iframe access blocks reliable implementation and a source patch fixes it.
- `开源不可行` only after source-level probe fails.

Run: `corepack pnpm test; corepack pnpm build`. Expected: PASS and build exit 0.

Commit if Git exists; otherwise record Task 3 in `Execution Notes`.

## Execution Notes

不得初始化 Git；记录每个 matrix row 的恢复计数和错误状态计数。
