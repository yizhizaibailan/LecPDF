# LecPDF 风险结论与设计文档汇总 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将四项 PoC 的官方证据、运行结果和 verdict 汇总为技术风险报告，并据此修订 FRD 与架构文档，使 v1 范围、接口和数据模型一致。

**Architecture:** `LecPDF-TECH-RISK-REPORT.md` 是实证来源；FRD 描述产品承诺，ARCHITECTURE 描述实现契约。一个轻量文档一致性测试检查固定术语、四项 verdict 和关键 schema 字段，防止三份文档漂移。

**Tech Stack:** Markdown、TypeScript、Vitest、现有 `spikes/results/*.json`。

**Spec:** `docs/superpowers/specs/2026-08-27-lecpdf-technical-risk-validation-design.md`

## Global Constraints

- 依赖四项 PoC 全部产生结果；不得用推测替代缺失证据。
- 全部 v1 功能必须保留；开源不可行项必须引用用户已批准的商业 SDK 决策，否则整体状态为阻塞。
- 关键技术陈述仅引用官方文档、官方仓库源码、发布记录、维护者问题记录和本地 PoC 证据。
- 文档默认中文；接口名、schema 字段和依赖包名保持英文原名。
- 不初始化 Git；若执行时已有仓库则按任务提交。

---

### Task 1: 建立结果聚合与完整性门禁

**Files:**
- Create: `spikes/report/result-schema.ts`
- Create: `spikes/report/load-results.ts`
- Test: `spikes/tests/risk-results-complete.test.ts`

**Interfaces:**
- Consumes: `spikes/results/pdf-annotations-print.json`、`pdf-night-mode.json`、`epub-anchor.json`、`epub-tts.json`。
- Produces: `RiskResult[]` and `assertCompleteRiskSet()`。

- [ ] **Step 1: 写完整性失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { loadRiskResults } from '../report/load-results';

describe('risk result set', () => {
  it('contains all four labs with evidence and a valid verdict', async () => {
    const results = await loadRiskResults();
    expect(results.map((x) => x.labId).sort()).toEqual([
      'epub-anchor', 'epub-tts', 'pdf-annotations-print', 'pdf-night-mode',
    ]);
    for (const result of results) {
      expect(result.evidence.length).toBeGreaterThan(0);
      expect(result.checks.length).toBeGreaterThan(0);
      expect(result.checks.every((x) => typeof x.passed === 'boolean')).toBe(true);
    }
  });
});
```

- [ ] **Step 2: 运行并确认缺少 loader 时失败**

Run: `corepack pnpm vitest run tests/risk-results-complete.test.ts`

Expected: FAIL，loader 不存在。

- [ ] **Step 3: 实现严格 loader**

Reuse `LabResult` and `assertLabResult` from the baseline contract. Reject duplicate lab ids, missing files, empty evidence and unknown verdicts. If a result is `开源不可行`, additionally require `commercialDecision.status === 'approved'` and a non-empty approved SDK id; otherwise throw `commercial approval required for <labId>`.

- [ ] **Step 4: 运行门禁**

Run: `corepack pnpm vitest run tests/risk-results-complete.test.ts`

Expected: PASS only when all four result files are complete and every commercial requirement has explicit approval.

- [ ] **Step 5: 检查点**

Commit if Git exists; otherwise record Task 1 in `Execution Notes`.

### Task 2: 编写实证风险报告

**Files:**
- Create: `LecPDF-TECH-RISK-REPORT.md`
- Test: `spikes/tests/risk-report.test.ts`

**Interfaces:**
- Consumes: `RiskResult[]`、`spikes/evidence/sources.json`、截图/PDF/人工复核记录。
- Produces: 每项固定章节：结论、版本、官方证据、PoC 步骤、自动结果、人工结果、限制、架构影响。

- [ ] **Step 1: 写报告结构失败测试**

```ts
const report = await readFile('../LecPDF-TECH-RISK-REPORT.md', 'utf8');
for (const heading of [
  'PDF 七类批注与打印', 'PDF 智能反色', 'EPUB 锚点', 'EPUB TTS',
  '版本与许可证', '商业 SDK 审批记录', '架构修订结论',
]) expect(report).toContain(`## ${heading}`);
for (const result of await loadRiskResults()) {
  expect(report).toContain(`结论：${result.verdict}`);
}
```

- [ ] **Step 2: 运行并确认报告不存在**

Run: `corepack pnpm vitest run tests/risk-report.test.ts`

Expected: FAIL，报告不存在。

- [ ] **Step 3: 依据实际结果写报告**

For every check, include measured value and threshold rather than “效果良好”. Link each official source directly and each local artifact by relative path. State whether the implementation is native, application extension, fork, or approved commercial SDK and explain why the previous level was insufficient.

- [ ] **Step 4: 运行报告测试和链接检查**

Run: `corepack pnpm vitest run tests/risk-report.test.ts`

Expected: PASS; every local artifact link resolves and each verdict matches its JSON result.

- [ ] **Step 5: 检查点**

Commit if Git exists; otherwise record Task 2.

### Task 3: 修订 FRD 的可验收产品承诺

**Files:**
- Modify: `LecPDF-FRD.md`
- Test: `spikes/tests/docs-consistency.test.ts`

**Interfaces:**
- Consumes: 风险报告中的产品结论。
- Produces: 无“待验证”措辞的 v1 验收标准和明确的商业/开源路线说明。

- [ ] **Step 1: 写 FRD 一致性失败测试**

```ts
it('contains no unresolved pre-development risk markers after validation', async () => {
  const frd = await readFile('../LecPDF-FRD.md', 'utf8');
  expect(frd).not.toMatch(/引擎能力待验证|开发前必须做的事/);
  expect(frd).toContain('未改变内容的 EPUB 锚点恢复率为 100%');
  expect(frd).toContain('文本对比度不低于 4.5:1');
});
```

- [ ] **Step 2: 运行并确认旧文档失败**

Run: `corepack pnpm vitest run tests/docs-consistency.test.ts`

Expected: FAIL，旧 FRD 仍包含待验证标记。

- [ ] **Step 3: 修改 FRD**

Replace risk placeholders with evidence-backed implementation decisions. Keep all v1 features. Resolve the prior contradiction by defining “zero data loss” as operation-log durability plus atomic snapshots, not debounce-only persistence. Move annotation printing out of P2 wording because it remains a v1 commitment; P2 may retain PDF source-file writeback only.

- [ ] **Step 4: 运行 FRD 测试和检查点**

Run: `corepack pnpm vitest run tests/docs-consistency.test.ts`

Expected: FRD-specific assertions PASS.

Commit if Git exists; otherwise record Task 3.

### Task 4: 修订架构、接口与 schema

**Files:**
- Modify: `LecPDF-ARCHITECTURE.md`
- Modify: `spikes/tests/docs-consistency.test.ts`

**Interfaces:**
- Consumes: 风险报告和已批准设计规格。
- Produces: `DocumentEngine`、`AnnotationEngine`、`PrintComposer`、`NightModeRenderer`、`AnchorResolver`、`TtsSession`、`EngineCapabilities` 的最终契约；`documentId` 与操作日志 schema。

- [ ] **Step 1: 扩展文档一致性测试**

```ts
it('uses the approved capability boundaries and stable identity', async () => {
  const arch = await readFile('../LecPDF-ARCHITECTURE.md', 'utf8');
  for (const name of ['DocumentEngine', 'AnnotationEngine', 'PrintComposer', 'NightModeRenderer', 'AnchorResolver', 'TtsSession', 'EngineCapabilities']) {
    expect(arch).toContain(name);
  }
  expect(arch).toContain('documentId');
  expect(arch).not.toContain('文件身份主键 = 规范化绝对路径');
  expect(arch).not.toContain('sidecar 文件名 = `md5(path)');
});
```

- [ ] **Step 2: 运行并确认旧架构失败**

Run: `corepack pnpm vitest run tests/docs-consistency.test.ts`

Expected: FAIL，旧接口和路径哈希仍存在。

- [ ] **Step 3: 修改架构文档**

Update module diagram, responsibility tables, data flows, TypeScript interfaces, sidecar schema, crash recovery flow, directory tree, risk table and confirmed decisions. Define PDF text markup quads; note point; free-text rect/font; ink paths/stroke width; EPUB CFI plus exact/prefix/suffix; `orphaned` status; operation log replay; unknown-high-version read-only protection.

- [ ] **Step 4: 运行全量一致性测试**

Run: `corepack pnpm test`

Expected: all PoC, report and document tests PASS.

- [ ] **Step 5: 人工一致性审阅**

Read FRD, ARCHITECTURE and TECH-RISK-REPORT in order. Confirm each v1 promise has one implementation route, each route has a named module, and each persisted field has one schema definition. Correct duplicated or conflicting terms immediately.

- [ ] **Step 6: 最终构建和检查点**

Run: `corepack pnpm build`

Expected: build exits 0. Verify `rg -n -i "TBD|TODO|待验证|稍后实现" LecPDF-*.md docs/superpowers/specs` returns no unresolved design placeholders (historical evidence quotations may be exempt only when clearly labeled as quotations).

Commit if Git exists: `git add LecPDF-FRD.md LecPDF-ARCHITECTURE.md LecPDF-TECH-RISK-REPORT.md spikes/report spikes/tests && git commit -m "docs: finalize LecPDF risk-backed architecture"`.

Otherwise record Task 4 completion in `Execution Notes`.

## Execution Notes

不得初始化 Git。最终记录四项 verdict、测试命令结果和修改的三份文档。
