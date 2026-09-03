# PDF 适配器边界收口实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 EmbedPDF 内核依赖集中到 `src/data/readers/pdf`，使页面与通用阅读组件只消费标准化状态和动作。

**Architecture:** PDF 适配层拥有 `PluginRegistry`、PDFViewer 配置、订阅和资源释放；Store 只保存序列化会话状态。组件通过受控的 PDF 阅读模型渲染，并将用户意图回传给适配层动作。

**Tech Stack:** Electron 44、React 18、TypeScript 5、Zustand 5、EmbedPDF 2、Vitest 4。

**Spec:** `docs/superpowers/specs/2026-08-31-lecpdf-unidirectional-data-flow-design.md`

## Global Constraints

- PDF 只能使用 EmbedPDF；不得引入其他 PDF 内核。
- EPUB 与后续非 PDF 电子书只能使用 foliate-js；本计划不接入 EPUB。
- Zustand 不保存内核实例、DOM 引用、文件字节或对象 URL。
- 所有 TypeScript/TSX 模块使用中文职责与关键资源释放注释。

---

### Task 1: 建立 PDF 阅读适配器契约

**Files:**
- Create: `src/data/readers/pdf/pdf-reader-controller.ts`
- Create: `src/data/readers/pdf/pdf-reader-controller.test.ts`
- Modify: `scripts/check-architecture.mjs`

- [x] 写失败测试：适配器向视图提供页码、目录、搜索与缩放动作；关闭时解除订阅。
- [x] 实现最小控制器，唯一导入 `@embedpdf` 的 PluginRegistry 类型并封装 PDF 命令。
- [x] 运行测试，确认控制器可独立验证。
- [x] 扩展架构检查：仅允许 `src/data/readers/pdf` 导入 `@embedpdf`。
- [ ] 提交：`refactor: 建立 PDF 阅读适配器边界`。

### Task 2: 迁移 PDF 阅读视图

**Files:**
- Modify: `src/components/Reader/PdfToolbar.tsx`
- Modify: `src/components/Reader/PdfSearchBar.tsx`
- Modify: `src/components/Reader/PdfNavigationSidebar.tsx`
- Modify: `src/pages/reader-reserved/PdfReaderPage.tsx`
- Test: 对应现有与新增组件测试。

- [x] 为每个组件先写失败测试，断言其只接收适配器模型与回调。
- [x] 将工具栏、搜索栏和导航侧栏改为无 EmbedPDF 导入的受控视图。
- [x] 将 PDFViewer 与快捷键监听迁入适配层入口，页面只组合模型。
- [x] 运行 PDF 回归测试、架构检查、类型检查和构建。
- [ ] 提交：`refactor: 迁移 PDF 视图至适配器边界`。

### Task 3: 架构回归与文档收口

**Files:**
- Modify: `LecPDF-ARCHITECTURE.md`
- Modify: `LecPDF-总开发清单.md`
- Test: `scripts/check-architecture.mjs`

- [ ] 验证组件与页面无 `@embedpdf`、`foliate-js`、Electron 或 `window.lec` 直接依赖。
- [ ] 更新最终目录职责、资源归属和单向数据流说明。
- [ ] 运行全量测试、类型检查、构建与架构检查。
- [ ] 提交：`docs: 完成 PDF 架构边界收口记录`。
