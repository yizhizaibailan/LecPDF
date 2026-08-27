# LecPDF PDF 批注与打印验证 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Electron 中验证 embedpdf v2.15.0 的七类批注、sidecar 往返、旋转/缩放对齐及含批注打印，并复现或排除导入批注缺少 `/AP` appearance stream 的已知风险。

**Architecture:** lab 通过 `EmbedPdfAnnotationAdapter` 隔离 embedpdf API；批注持久化保持 sidecar，不修改源 PDF。打印路径同时测试 embedpdf `saveAsCopy()` 与 Electron `printToPDF()`，用结构检查和标准查看器人工复核区分“屏幕可见”与“打印可见”。

**Tech Stack:** 基线计划的 Electron 44.0.0/React 18/Vitest；`@embedpdf/*` 全部固定 2.15.0；`pdf-lib` 1.17.1 用于输出结构检查。

**Spec:** `docs/superpowers/specs/2026-08-27-lecpdf-technical-risk-validation-design.md`

## Global Constraints

- 依赖计划：`2026-08-27-lecpdf-risk-baseline.md` 已完成。
- 必测七类：highlight、underline、strikeout、squiggly、text note、free text、ink。
- 原 PDF 只读；批注数据写入实验结果目录。
- 导入后批注必须具有可打印 appearance；仅在 embedpdf 画布可见不算通过。
- 禁止商业 SDK；若开源结论为 `开源不可行`，停止该路线并请求用户批准。

---

### Task 1: 定义统一 PDF 批注模型与坐标测试

**Files:**
- Create: `spikes/labs/pdf-annotations-print/model.ts`
- Create: `spikes/labs/pdf-annotations-print/coordinates.ts`
- Test: `spikes/tests/pdf-annotation-model.test.ts`

**Interfaces:**
- Produces: `PdfAnnotationRecord` discriminated union；`pageToNormalized()`、`normalizedToPage()`。
- Consumes: fixture manifest 中的页面尺寸和已知区域。

- [ ] **Step 1: 写四边形、点、矩形和墨迹往返失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { normalizedToPage, pageToNormalized } from '../labs/pdf-annotations-print/coordinates';

describe('PDF coordinate round trip', () => {
  it.each([0, 90, 180, 270] as const)('preserves a quad at %i degrees', (rotation) => {
    const page = { width: 612, height: 792, rotation };
    const quad = [72, 700, 240, 700, 72, 680, 240, 680] as const;
    const restored = normalizedToPage(pageToNormalized(quad, page), page);
    restored.forEach((value, i) => expect(value).toBeCloseTo(quad[i], 5));
  });
});
```

- [ ] **Step 2: 运行并确认失败**

Run: `corepack pnpm vitest run tests/pdf-annotation-model.test.ts`

Expected: FAIL，坐标模块不存在。

- [ ] **Step 3: 实现明确的 discriminated union**

```ts
type Base = { id: string; pageIndex: number; color: string; opacity: number; createdAt: string; updatedAt: string };
export type PdfAnnotationRecord =
  | (Base & { type: 'highlight' | 'underline' | 'strikeout' | 'squiggly'; quads: number[][]; quote: string })
  | (Base & { type: 'note'; point: { x: number; y: number }; body: string })
  | (Base & { type: 'freeText'; rect: { x: number; y: number; width: number; height: number }; body: string; fontSize: number })
  | (Base & { type: 'ink'; paths: Array<Array<{ x: number; y: number }>>; strokeWidth: number });
```

Coordinates are normalized in unrotated PDF page space. Conversion must undo page rotation before normalization and reapply it only at render boundaries.

- [ ] **Step 4: 运行坐标测试**

Run: `corepack pnpm vitest run tests/pdf-annotation-model.test.ts`

Expected: PASS for all four rotations.

- [ ] **Step 5: 检查点**

Commit if Git exists: `git add spikes/labs/pdf-annotations-print/model.ts spikes/labs/pdf-annotations-print/coordinates.ts spikes/tests/pdf-annotation-model.test.ts && git commit -m "test: define PDF annotation geometry"`.

Otherwise append Task 1 completion to this plan's `Execution Notes`.

### Task 2: 接入 embedpdf 七类工具并验证 sidecar 往返

**Files:**
- Modify: `spikes/package.json`
- Create: `spikes/labs/pdf-annotations-print/embedpdf-adapter.ts`
- Create: `spikes/labs/pdf-annotations-print/index.tsx`
- Test: `spikes/tests/pdf-annotation-roundtrip.test.ts`

**Interfaces:**
- Consumes: `PdfAnnotationRecord`、`LabDefinition`、embedpdf `exportAnnotations()`/`importAnnotations()`。
- Produces: `EmbedPdfAnnotationAdapter.exportSidecar(): Promise<PdfAnnotationRecord[]>`、`importSidecar(records): Promise<void>`。

- [ ] **Step 1: 精确安装 embedpdf v2 稳定包**

Run:

```powershell
corepack pnpm add --save-exact @embedpdf/react-pdf-viewer@2.15.0 @embedpdf/engines@2.15.0 @embedpdf/models@2.15.0 @embedpdf/plugin-annotation@2.15.0 @embedpdf/plugin-export@2.15.0 @embedpdf/plugin-history@2.15.0 @embedpdf/plugin-interaction-manager@2.15.0 @embedpdf/plugin-selection@2.15.0
```

Expected: package.json and lockfile contain `2.15.0` without ranges.

- [ ] **Step 2: 写适配器契约失败测试**

```ts
it('round-trips all seven LecPDF annotation types through sidecar', async () => {
  const records = makeSevenFixtureAnnotations();
  await adapter.importSidecar(records);
  expect(await adapter.exportSidecar()).toEqual(records);
});
```

Use a fake embedpdf API in the unit test; the fake must expose `createAnnotation`, `updateAnnotation`, `deleteAnnotation`, `exportAnnotations`, `importAnnotations`, and `commit`.

- [ ] **Step 3: 运行并确认失败**

Run: `corepack pnpm vitest run tests/pdf-annotation-roundtrip.test.ts`

Expected: FAIL，`EmbedPdfAnnotationAdapter` 不存在。

- [ ] **Step 4: 实现映射和 Task 包装器**

Map LecPDF types to embedpdf tool ids exactly: `highlight`, `underline`, `strikeout`, `squiggly`, `ink`, `freeText`; create sticky note through `PdfAnnotationSubtype.TEXT`. Wrap embedpdf task objects with:

```ts
export function taskToPromise<T>(task: { wait(ok: (value: T) => void, fail?: (error: unknown) => void): void }): Promise<T> {
  return new Promise((resolve, reject) => task.wait(resolve, reject));
}
```

Keep engine transfer items private to the adapter; only `PdfAnnotationRecord[]` crosses the lab boundary.

- [ ] **Step 5: 建立 Electron lab UI**

Render the PDF fixture and buttons for seven tools, Export sidecar, Clear, Import sidecar, Rotate, Zoom and Run checks. `run()` creates one annotation of each type at fixture-defined positions, exports, clears, imports and returns one check per type.

- [ ] **Step 6: 运行单元与 Electron 人工往返检查**

Run: `corepack pnpm test; corepack pnpm dev`

Expected: unit tests PASS; after Export → Clear → Import, all seven annotations reappear and remain aligned at 50%, 100%, 200% zoom and 0/90/180/270 rotation.

- [ ] **Step 7: 检查点**

Commit if Git exists: `git add spikes/package.json spikes/pnpm-lock.yaml spikes/labs/pdf-annotations-print spikes/tests/pdf-annotation-roundtrip.test.ts && git commit -m "feat: validate seven PDF annotation types"`.

Otherwise record Task 2 completion in `Execution Notes`.

### Task 3: 验证导入批注的 appearance stream 与打印输出

**Files:**
- Create: `spikes/labs/pdf-annotations-print/print-composer.ts`
- Create: `spikes/labs/pdf-annotations-print/pdf-inspector.ts`
- Test: `spikes/tests/pdf-annotation-print.test.ts`
- Generated: `spikes/results/pdf-annotations-print-viewer-copy.pdf`
- Generated: `spikes/results/pdf-annotations-print-electron.pdf`

**Interfaces:**
- Consumes: adapter imported annotation state；embedpdf export plugin `saveAsCopy()`；Electron preload print IPC。
- Produces: `inspectAnnotationAppearances(bytes): { annotationCount, appearanceCount, subtypes }`。

- [ ] **Step 1: 写 appearance 完整性失败测试**

```ts
it('requires every printable imported annotation to have an appearance stream', async () => {
  const bytes = await readFile('results/pdf-annotations-print-viewer-copy.pdf');
  const report = inspectAnnotationAppearances(bytes);
  expect(report.annotationCount).toBe(7);
  expect(report.appearanceCount).toBe(7);
  expect(report.subtypes).toEqual(expect.arrayContaining([
    'Highlight', 'Underline', 'StrikeOut', 'Squiggly', 'Text', 'FreeText', 'Ink',
  ]));
});
```

- [ ] **Step 2: 先复现官方 issue #667 所述路径**

Create seven annotations → export sidecar → reload viewer → import sidecar → call `saveAsCopy()`. Save bytes without applying a workaround.

Run: `corepack pnpm vitest run tests/pdf-annotation-print.test.ts`

Expected: test either fails with `appearanceCount < annotationCount` (risk reproduced) or passes on 2.15.0 (upstream fixed). Record the raw counts either way.

- [ ] **Step 3: 实现独立 PrintComposer 路线**

`PrintComposer.compose(records, sourcePdf)` must render each page and its sidecar overlay into print-only HTML with exact CSS page size, then call Electron `webContents.printToPDF({ printBackground: true, preferCSSPageSize: true, margins: { top: 0, bottom: 0, left: 0, right: 0 } })`. This path must not depend on live viewer DOM.

- [ ] **Step 4: 验证两条输出路径**

Run the lab to generate both PDFs. Use `pdf-lib` to assert page count and MediaBox equality with the source. Render or open outputs in Chromium PDF viewer and one independent installed viewer; visually confirm all seven annotations on all pages.

- [ ] **Step 5: 写结论**

Return verdict:

- `原生支持` only if imported `saveAsCopy()` output contains all appearances and independent viewers show all seven types.
- `应用层扩展` if the independent `PrintComposer` passes while `saveAsCopy()` fails.
- `需要 fork` if correct output requires changing embedpdf/PDFium appearance generation.
- `开源不可行` only after both open-source routes have reproducible failures against the acceptance criteria.

Save result to `spikes/results/pdf-annotations-print.json` with evidence URLs and raw counts. Set `commercialDecision` to `{ "status": "not-needed" }` for the first three verdicts. For `开源不可行`, set it to `{ "status": "pending" }`, stop commercial work and request user approval.

- [ ] **Step 6: 全量验证**

Run: `corepack pnpm test; corepack pnpm build`

Expected: all suites exit PASS. If issue #667 reproduces, encode that one expectation with Vitest `it.fails(...)` and pair it with a normal passing PrintComposer test; build exits 0.

- [ ] **Step 7: 检查点**

Commit if Git exists: `git add spikes/labs/pdf-annotations-print spikes/tests/pdf-annotation-print.test.ts spikes/results && git commit -m "test: verify annotation printing paths"`.

Otherwise record Task 3 completion in `Execution Notes`.

## Execution Notes

执行时记录每个任务的结果和未使用 Git 的原因；不得初始化 Git。
