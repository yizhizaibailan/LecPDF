# LecPDF 风险验证基线 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立锁定版本、离线可运行的 Windows Electron 验证壳、证据清单和自生成 PDF/EPUB 测试样本，供四项独立 PoC 复用。

**Architecture:** `spikes/app` 只负责 Electron 生命周期、实验注册和结果落盘；实验通过 `LabDefinition` 接口接入。测试样本由脚本生成并附带区域/文本元数据，避免版权和不可重复问题。

**Tech Stack:** Node.js 22.12+、pnpm 10、Electron 44.0.0、electron-vite 5.0.0、React 18.3.1、TypeScript 5.9.2、Vitest 4.1.10、pdf-lib 1.17.1、JSZip 3.10.1。

**Spec:** `docs/superpowers/specs/2026-08-27-lecpdf-technical-risk-validation-design.md`

## Global Constraints

- 运行平台：Windows 10/11 x64；PoC 必须在 Electron 中运行。
- 全部依赖写入精确版本并提交 `pnpm-lock.yaml`；禁止 `^`、`~` 和预发布版本。
- 全程离线、零遥测；网络请求在测试壳中默认拒绝。
- fixtures 必须由仓库脚本生成或带可再分发许可证。
- PoC 是非生产代码，不进入 LecPDF 正式打包。
- 当前目录不是 Git 仓库；不得初始化 Git。若执行时已有仓库，每个任务结束后提交，否则在计划底部 `Execution Notes` 记录已完成文件。

---

### Task 1: 建立官方来源清单与版本门禁

**Files:**
- Create: `spikes/evidence/sources.json`
- Create: `spikes/evidence/source-schema.ts`
- Test: `spikes/tests/source-schema.test.ts`

**Interfaces:**
- Produces: `EvidenceSource { id, product, version, url, kind, checkedAt, license }`
- Consumes: 无。

- [ ] **Step 1: 写失败测试，要求每个核心依赖具有官方来源和精确版本**

```ts
import { describe, expect, it } from 'vitest';
import sources from '../evidence/sources.json';
import { validateSources } from '../evidence/source-schema';

describe('official evidence manifest', () => {
  it('covers the locked runtime and both document engines', () => {
    expect(validateSources(sources)).toEqual([]);
    expect(sources.map((x) => `${x.product}@${x.version}`)).toEqual(
      expect.arrayContaining([
        'electron@44.0.0',
        'embedpdf@2.15.0',
        'epubjs@0.3.93',
      ]),
    );
  });
});
```

- [ ] **Step 2: 运行测试并确认因校验器和清单不存在而失败**

Run: `cd D:\workspace\LecPDF\spikes; corepack pnpm vitest run tests/source-schema.test.ts`

Expected: FAIL，模块 `../evidence/source-schema` 不存在。

- [ ] **Step 3: 实现严格校验器**

```ts
export interface EvidenceSource {
  id: string;
  product: string;
  version: string;
  url: string;
  kind: 'docs' | 'repository' | 'release' | 'issue' | 'license';
  checkedAt: string;
  license: string;
}

export function validateSources(input: unknown): string[] {
  if (!Array.isArray(input)) return ['manifest must be an array'];
  return input.flatMap((value, index) => {
    const x = value as Partial<EvidenceSource>;
    const errors: string[] = [];
    if (!x.id) errors.push(`${index}.id missing`);
    if (!x.product) errors.push(`${index}.product missing`);
    if (!/^\d+\.\d+\.\d+/.test(x.version ?? '')) errors.push(`${index}.version is not exact`);
    if (!/^https:\/\//.test(x.url ?? '')) errors.push(`${index}.url must be https`);
    if (!x.checkedAt || Number.isNaN(Date.parse(x.checkedAt))) errors.push(`${index}.checkedAt invalid`);
    if (!x.license) errors.push(`${index}.license missing`);
    return errors;
  });
}
```

Create `sources.json` with this initial official-source set; later labs may append issue/source entries but may not remove these baselines:

```json
[
  { "id": "electron-44-release", "product": "electron", "version": "44.0.0", "url": "https://releases.electronjs.org/release/v44.0.0", "kind": "release", "checkedAt": "2026-08-27", "license": "MIT" },
  { "id": "embedpdf-2-stable", "product": "embedpdf", "version": "2.15.0", "url": "https://github.com/embedpdf/embed-pdf-viewer/releases/tag/v2.15.0", "kind": "release", "checkedAt": "2026-08-27", "license": "Apache-2.0" },
  { "id": "embedpdf-3-prerelease", "product": "embedpdf-next", "version": "3.0.0-next.8", "url": "https://github.com/embedpdf/embed-pdf-viewer/releases/tag/v3.0.0-next.8", "kind": "release", "checkedAt": "2026-08-27", "license": "Apache-2.0" },
  { "id": "epubjs-package", "product": "epubjs", "version": "0.3.93", "url": "https://github.com/futurepress/epub.js/blob/master/package.json", "kind": "repository", "checkedAt": "2026-08-27", "license": "BSD-2-Clause" },
  { "id": "electron-vite-5", "product": "electron-vite", "version": "5.0.0", "url": "https://github.com/alex8088/electron-vite/releases/tag/v5.0.0", "kind": "release", "checkedAt": "2026-08-27", "license": "MIT" },
  { "id": "react-18", "product": "react", "version": "18.3.1", "url": "https://github.com/facebook/react/releases/tag/v18.3.1", "kind": "release", "checkedAt": "2026-08-27", "license": "MIT" }
]
```

- [ ] **Step 4: 运行清单测试**

Run: `corepack pnpm vitest run tests/source-schema.test.ts`

Expected: PASS。

- [ ] **Step 5: 记录检查点**

If Git exists: `git add spikes/evidence spikes/tests/source-schema.test.ts && git commit -m "docs: lock risk validation sources"`

Otherwise append `Task 1 complete: evidence manifest and validation test` to this plan's `Execution Notes`.

### Task 2: 建立 Electron 实验壳和稳定接口

**Files:**
- Create: `spikes/package.json`
- Create: `spikes/pnpm-workspace.yaml`
- Create: `spikes/electron.vite.config.ts`
- Create: `spikes/tsconfig.json`
- Create: `spikes/app/main/index.ts`
- Create: `spikes/app/preload/index.ts`
- Create: `spikes/app/renderer/index.html`
- Create: `spikes/app/renderer/src/main.tsx`
- Create: `spikes/app/shared/lab-contract.ts`
- Test: `spikes/tests/lab-contract.test.ts`

**Interfaces:**
- Produces: `LabDefinition`, `LabHandle`, `LabResult`, `window.lecSpike.saveResult()`。
- Consumes: Task 1 的精确版本来源清单。

- [ ] **Step 1: 写契约测试**

```ts
import { describe, expect, it } from 'vitest';
import { assertLabResult } from '../app/shared/lab-contract';

describe('lab result contract', () => {
  it('accepts only one of the four approved verdicts', () => {
    expect(() => assertLabResult({
      labId: 'epub-anchor',
      verdict: '应用层扩展',
      checks: [{ id: 'reload', passed: true, detail: '20/20 restored' }],
      evidence: ['epubjs@0.3.93'],
      commercialDecision: { status: 'not-needed' },
    })).not.toThrow();
    expect(() => assertLabResult({ labId: 'x', verdict: 'maybe', checks: [], evidence: [] })).toThrow();
  });
});
```

- [ ] **Step 2: 运行失败测试**

Run: `corepack pnpm vitest run tests/lab-contract.test.ts`

Expected: FAIL，`lab-contract.ts` 不存在。

- [ ] **Step 3: 实现实验契约**

```ts
export type Verdict = '原生支持' | '应用层扩展' | '需要 fork' | '开源不可行';
export interface LabCheck { id: string; passed: boolean; detail: string }
export interface LabResult {
  labId: string;
  verdict: Verdict;
  checks: LabCheck[];
  evidence: string[];
  commercialDecision:
    | { status: 'not-needed' }
    | { status: 'pending' }
    | { status: 'approved'; sdkId: string; approvedAt: string };
}
export interface LabHandle { run(): Promise<LabResult>; dispose(): Promise<void> }
export interface LabDefinition {
  id: string;
  title: string;
  mount(root: HTMLElement): Promise<LabHandle>;
}
export function assertLabResult(value: unknown): asserts value is LabResult {
  const x = value as LabResult;
  const verdicts: Verdict[] = ['原生支持', '应用层扩展', '需要 fork', '开源不可行'];
  if (!x?.labId || !verdicts.includes(x.verdict) || !Array.isArray(x.checks) || !Array.isArray(x.evidence) || !x.commercialDecision) {
    throw new Error('invalid LabResult');
  }
}
```

- [ ] **Step 4: 创建精确锁定的 package.json**

```json
{
  "name": "lecpdf-risk-spikes",
  "private": true,
  "version": "0.0.0",
  "packageManager": "pnpm@10.17.1",
  "type": "module",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "test": "vitest run",
    "fixtures": "node fixtures/generate.mjs"
  },
  "dependencies": {
    "react": "18.3.1",
    "react-dom": "18.3.1"
  },
  "devDependencies": {
    "@types/node": "24.3.0",
    "@types/react": "18.3.18",
    "@types/react-dom": "18.3.5",
    "electron": "44.0.0",
    "electron-vite": "5.0.0",
    "jszip": "3.10.1",
    "pdf-lib": "1.17.1",
    "typescript": "5.9.2",
    "vite": "7.2.4",
    "vitest": "4.1.10"
  }
}
```

- [ ] **Step 5: 实现安全 Electron 壳**

Main window must set `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`. Register `session.defaultSession.webRequest.onBeforeRequest` and cancel every `http:` or `https:` request except localhost development assets. Preload exposes only `saveResult(result: LabResult): Promise<void>`; validate with `assertLabResult` before IPC and write JSON under `spikes/results/<labId>.json` using temp-file + rename.

- [ ] **Step 6: 构建并运行测试**

Run: `corepack pnpm install --frozen-lockfile=false; corepack pnpm test; corepack pnpm build`

Expected: all tests PASS; electron-vite build exits 0; `pnpm-lock.yaml` is created with exact root versions.

- [ ] **Step 7: 记录检查点**

If Git exists: `git add spikes && git commit -m "feat: add Electron risk lab shell"`.

Otherwise append `Task 2 complete: Electron lab shell and contracts` to `Execution Notes`.

### Task 3: 生成可再现测试样本

**Files:**
- Create: `spikes/fixtures/generate.mjs`
- Create: `spikes/fixtures/manifest.json`
- Generated: `spikes/fixtures/text.pdf`
- Generated: `spikes/fixtures/scanned.pdf`
- Generated: `spikes/fixtures/mixed.pdf`
- Generated: `spikes/fixtures/reflow.epub`
- Test: `spikes/tests/fixtures.test.ts`

**Interfaces:**
- Produces: `FixtureManifest { files: FixtureEntry[] }`，每项含 SHA-256、页/章节元数据和许可说明。
- Consumes: `pdf-lib@1.17.1`、`jszip@3.10.1`。

- [ ] **Step 1: 写失败测试**

```ts
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import manifest from '../fixtures/manifest.json';

describe('generated fixtures', () => {
  for (const entry of manifest.files) {
    it(`${entry.path} matches its manifest digest`, async () => {
      const bytes = await readFile(new URL(`../fixtures/${entry.path}`, import.meta.url));
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);
      expect(entry.license).toBe('CC0-1.0');
    });
  }
});
```

- [ ] **Step 2: 运行并确认 fixtures 缺失**

Run: `corepack pnpm vitest run tests/fixtures.test.ts`

Expected: FAIL，`manifest.json` 或生成文件不存在。

- [ ] **Step 3: 实现生成器**

Generate three three-page PDFs: text-only; image-only with a synthetic RGB gradient and color chart; mixed text/vector/image with known bounding boxes. Generate one EPUB containing Chinese and English paragraphs, repeated phrases, inline `<em>/<strong>/<a>` boundaries and three chapters. Record known text selections, image rectangles and expected quotes in `manifest.json`; calculate SHA-256 after writing files.

- [ ] **Step 4: 生成并验证样本**

Run: `corepack pnpm fixtures; corepack pnpm vitest run tests/fixtures.test.ts`

Expected: generator exits 0 and all digest tests PASS on a second run without changing digests.

- [ ] **Step 5: 验证离线门禁**

Launch `corepack pnpm dev`, attempt a request to `https://example.com` from DevTools, and confirm it is canceled with `ERR_BLOCKED_BY_CLIENT`. Record the result in `spikes/results/baseline-manual.json`.

- [ ] **Step 6: 记录检查点**

If Git exists: `git add spikes/fixtures spikes/tests/fixtures.test.ts && git commit -m "test: add deterministic PDF and EPUB fixtures"`.

Otherwise append `Task 3 complete: deterministic fixtures and offline gate` to `Execution Notes`.

## Execution Notes

执行者仅在当前目录仍非 Git 仓库时向本节追加完成记录；不得初始化 Git。
