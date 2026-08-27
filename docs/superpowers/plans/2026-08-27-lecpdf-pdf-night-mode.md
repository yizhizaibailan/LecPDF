# LecPDF PDF 智能反色验证 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用文本、扫描和图文混排 PDF 证明 embedpdf 公开渲染层是否足以实现文字反色、图片保真和批注可读；若不足，明确应用层扩展与 fork 的边界。

**Architecture:** `NightModeRenderer` 将策略与 viewer 分离；同一 fixture 分别跑 `css-invert` 基线与 `content-aware` 策略。截图分析使用 fixture 元数据中的文字/图片区域计算对比度和颜色偏差，避免仅凭肉眼下结论。

**Tech Stack:** 基线 Electron/React/Vitest、embedpdf 2.15.0 render API、Electron `capturePage()`、纯 TypeScript WCAG 对比度与 RGB 差异计算。

**Spec:** `docs/superpowers/specs/2026-08-27-lecpdf-technical-risk-validation-design.md`

## Global Constraints

- 依赖基线计划完成并使用同一 PDF fixtures。
- 智能反色不是全页负片：扫描图和照片区域必须保持原色方向。
- 正文对比度目标不低于 4.5:1；批注必须保持可辨识。
- 优先使用公开 API；只有证据证明公开 API 无法区分内容层时才判定需要 fork。
- 禁止网络、遥测和商业 SDK。

---

### Task 1: 建立可量化的暗色模式指标

**Files:**
- Create: `spikes/labs/pdf-night-mode/metrics.ts`
- Test: `spikes/tests/pdf-night-metrics.test.ts`

**Interfaces:**
- Produces: `contrastRatio(foreground, background)`、`meanRgbDistance(before, after, region)`、`NightMetrics`。
- Consumes: fixture manifest 的文字与图片区域。

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { contrastRatio, meanRgbDistance } from '../labs/pdf-night-mode/metrics';

describe('night metrics', () => {
  it('uses WCAG relative luminance', () => {
    expect(contrastRatio([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 2);
  });
  it('reports zero distance for unchanged pixels', () => {
    const pixels = new Uint8ClampedArray([12, 34, 56, 255]);
    expect(meanRgbDistance(pixels, pixels)).toBe(0);
  });
});
```

- [ ] **Step 2: 运行失败测试**

Run: `corepack pnpm vitest run tests/pdf-night-metrics.test.ts`

Expected: FAIL，metrics 模块不存在。

- [ ] **Step 3: 实现指标**

Use WCAG sRGB linearization for contrast. `meanRgbDistance` computes the mean Euclidean RGB distance and ignores alpha. Define pass thresholds: sampled text/background contrast `>= 4.5`; synthetic photo/image region mean distance `<= 12`; annotation-to-background contrast `>= 3.0`.

- [ ] **Step 4: 运行测试**

Run: `corepack pnpm vitest run tests/pdf-night-metrics.test.ts`

Expected: PASS。

- [ ] **Step 5: 检查点**

Commit if Git exists; otherwise record Task 1 in `Execution Notes`.

### Task 2: 证明 CSS 全页反色的能力上限

**Files:**
- Create: `spikes/labs/pdf-night-mode/strategies/css-invert.ts`
- Create: `spikes/labs/pdf-night-mode/capture.ts`
- Test: `spikes/tests/pdf-night-css-baseline.test.ts`

**Interfaces:**
- Produces: `NightStrategy { id, enable(root), disable(root) }`；baseline screenshots and metrics。
- Consumes: Electron `capturePage()` 与三种 PDF fixture。

- [ ] **Step 1: 写预期失败的基线规格测试**

```ts
it.fails('full-page CSS inversion cannot preserve a flattened image region', async () => {
  const result = await runNightCapture('mixed.pdf', 'css-invert');
  expect(result.imageMeanDistance).toBeLessThanOrEqual(12);
});
```

- [ ] **Step 2: 实现 CSS 基线策略**

```ts
export const cssInvert: NightStrategy = {
  id: 'css-invert',
  enable(root) { root.style.filter = 'invert(1) hue-rotate(180deg)'; },
  disable(root) { root.style.filter = ''; },
};
```

- [ ] **Step 3: 捕获并记录基线**

Use main-process `webContents.capturePage()` after the page-render-complete signal. Save before/after PNGs and JSON metrics under `spikes/results/pdf-night-mode/css-invert/`.

Run: `corepack pnpm vitest run tests/pdf-night-css-baseline.test.ts`

Expected: suite PASS because the known limitation is encoded with `it.fails`; result shows image distance above threshold while text contrast passes.

- [ ] **Step 4: 检查点**

Commit if Git exists; otherwise record Task 2 in `Execution Notes`.

### Task 3: 验证内容感知渲染或确定 fork 边界

**Files:**
- Create: `spikes/labs/pdf-night-mode/strategies/content-aware.ts`
- Create: `spikes/labs/pdf-night-mode/engine-capability.ts`
- Create: `spikes/labs/pdf-night-mode/index.tsx`
- Test: `spikes/tests/pdf-night-content-aware.test.ts`

**Interfaces:**
- Produces: `inspectNightCapabilities(): { separateTextLayer, separateBitmapLayer, separateAnnotationLayer, source }`。
- Consumes: embedpdf render/selection/annotation layers and PDFium engine hooks exposed by 2.15.0。

- [ ] **Step 1: 写能力与验收失败测试**

```ts
it('meets text, image and annotation thresholds together', async () => {
  const result = await runNightCapture('mixed.pdf', 'content-aware');
  expect(result.textContrast).toBeGreaterThanOrEqual(4.5);
  expect(result.imageMeanDistance).toBeLessThanOrEqual(12);
  expect(result.annotationContrast).toBeGreaterThanOrEqual(3);
});
```

- [ ] **Step 2: 先实现公开层探测**

Inspect whether 2.15.0 exposes independently styleable text, bitmap/page render and annotation layers. Record concrete constructor/hook names and source file URLs in `engine-capability.ts`; do not infer separation merely from DOM element names.

- [ ] **Step 3: 实现可用的最小内容感知策略**

If bitmap and text layers are truly separate, darken page background and vector/text layer while leaving bitmap layer unchanged; apply contrast-preserving annotation palette. If the page is a single flattened canvas, implement no fake success path: return `supported: false` with reason `flattened-page-raster`.

- [ ] **Step 4: 运行 Electron lab**

Run: `corepack pnpm test; corepack pnpm dev`

Expected: three fixture reports and screenshots are produced. The lab UI shows each threshold, its measured value and the inspected layer capability.

- [ ] **Step 5: 决定结论**

- `原生支持`: public engine/render API passes all thresholds.
- `应用层扩展`: public layer hooks plus LecPDF strategy pass all thresholds.
- `需要 fork`: PDFium has the needed page-object information but embedpdf exposes only a flattened page raster.
- `开源不可行`: a targeted fork probe also cannot preserve bitmap color while recoloring text/vector content.

Save `spikes/results/pdf-night-mode.json`; include screenshots and metrics paths. Set `commercialDecision` to `not-needed` unless the verdict is `开源不可行`; in that case set `pending` and request user approval before any commercial download or trial.

- [ ] **Step 6: 全量验证和检查点**

Run: `corepack pnpm test; corepack pnpm build`

Expected: all normal tests PASS; known CSS limitation uses `it.fails`; build exits 0.

Commit if Git exists; otherwise record Task 3 in `Execution Notes`.

## Execution Notes

不得初始化 Git；记录三类 fixture 的最终阈值和 verdict。
