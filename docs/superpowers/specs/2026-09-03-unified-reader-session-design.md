# LecPDF 统一阅读会话与 Foliate 适配架构设计

## 目标与范围

本设计补齐 PDF 与 EPUB 的共同阅读会话边界，使 `readerStore` 成为所有跨组件、可序列化阅读状态的唯一前端来源。PDF 保持 EmbedPDF 唯一内核；EPUB 与后续经验证的非 PDF 电子书只允许通过 foliate-js 适配器进入系统。

本次只建立 Foliate 的受控适配器骨架、统一事件契约及 PDF 事件回写 Store 的通路。不会安装未经验证的 foliate-js 包，不会伪造 EPUB 渲染、批注、TTS 或阅读设置功能。

## 当前问题

当前 `readerStore` 已保存标签级加载、错误和位置，但 PDF 页码、目录、搜索等事件只在阅读组件局部流动；`ReaderPage` 对 Foliate 只能显示占位文字。因此标签页、页面与阅读器之间尚未形成完整的单向状态闭环。

## 决策

### 1. 会话状态与临时资源分离

`ReaderSession` 只保存可序列化、可被 UI 订阅的数据：文档类型、加载状态、位置、视图偏好、目录、搜索状态、错误和请求编号。Store 不保存 EmbedPDF/Foliate 实例、DOM 引用、文件字节、对象 URL、订阅函数或观察器。

`DocumentSessionRegistry` 继续按 `tabId` 保存短生命周期来源：PDF 的 `lec-file://` URL 与 Foliate 的 `ArrayBuffer`。各引擎适配器在自身卸载或 `close(tabId)` 时清除订阅和对象 URL；关闭标签先释放临时资源，再移除 Store 会话。

### 2. 统一事件契约

适配器只向上层发布 `ReaderEvent`，不能直接写 Zustand。初始契约如下：

```ts
type ReaderEvent =
  | { type: 'ready' }
  | { type: 'location-changed'; location: ReaderLocation }
  | { type: 'outline-changed'; outline: ReaderOutlineItem[] }
  | { type: 'search-changed'; search: ReaderSearchState }
  | { type: 'view-preferences-changed'; view: ReaderViewPreferences }
  | { type: 'load-failed'; error: DocumentOpenError }
```

`readerStore.applyEvent(tabId, event)` 是事件写入会话的唯一入口。它先验证会话存在与当前请求，再以不可变方式更新对应状态；未知标签、过期请求或无效事件不得创建新会话。

### 3. PDF 接线

EmbedPDF 仍只由 `src/data/readers/pdf` 导入。`EmbedPdfReaderRuntime` 将页码和目录插件事件转为标准 `ReaderEvent`，通过回调交给页面组合层；`ApplicationPage` 只从运行时取得 `readerStore.applyEvent` 并传递，不理解 EmbedPDF 类型。

工具栏、搜索栏与目录侧栏可以保留用于瞬时输入的局部 React 状态，但它们展示的跨组件结果必须来自 `ReaderSession` 或经适配器回写的标准事件。这样用户动作始终形成“组件意图 → 适配器命令 → ReaderEvent → Store → selector UI”的单向链路。

### 4. Foliate 适配器骨架

新增 `src/data/readers/foliate/`，其中仅定义不依赖具体包类型的端口和控制器：

```ts
type FoliateReaderPort = {
  open(bytes: ArrayBuffer): Promise<void>
  close(): void
  subscribe(listener: (event: ReaderEvent) => void): () => void
}

type FoliateReaderController = {
  open(bytes: ArrayBuffer): Promise<void>
  close(): void
  subscribe(listener: (event: ReaderEvent) => void): () => void
}
```

将来安装并完成 Foliate 技术验证后，只新增实现 `FoliateReaderPort` 的桥接文件；不得让组件、页面或 Store 直接导入 foliate-js。`ReaderPage` 在 Foliate 会话处显示明确的“适配器骨架已就绪，渲染内核待验证接入”状态，不能把 EPUB 字节交给 PDF 阅读器。

## 数据流

```text
文件打开意图
  → tabStore.openDocument(path)
  → readerStore.openSession(tabId, path)
  → document-router + document-session
  → PDF EmbedPDF 适配器 / Foliate 适配器端口
  → ReaderEvent
  → readerStore.applyEvent(tabId, event)
  → ApplicationPage selector
  → ReaderPage 与受控阅读组件
```

关闭流程反向执行资源释放，但状态写入方向不变：`tabStore.closeTab` → `readerStore.closeSession` → 注册表和适配器释放资源 → Store 移除会话 → UI 刷新。

## 错误与异步规则

- 打开会话沿用递增 `requestId`；异步结果只能更新匹配当前请求的会话。
- 适配器将内核失败转换为不含绝对路径的 `DocumentOpenError`，再发布 `load-failed`。
- Foliate 的 `open` 失败必须在关闭或重试时调用 `close`，确保订阅和临时对象不会残留。
- PDF 插件回调在运行时卸载时解除；适配器不会保存对 Store 的引用。

## 验收标准

1. 统一类型测试：每种 `ReaderEvent` 都能准确更新指定标签会话，未知标签不变。
2. Store 测试：过期请求和已关闭标签的事件不能污染新会话。
3. Foliate 控制器测试：打开委托端口、订阅能解除、关闭能委托资源释放。
4. PDF 页面测试：页码事件能够经回调写入 `readerStore`，并由 `ReaderPage` 消费会话位置。
5. 架构检查：`components`、`pages`、`stores` 不能直接导入 `@embedpdf` 或 `foliate-js`；后续 Foliate 包只能出现在 `src/data/readers/foliate`。
6. 保持 `test:run`、`typecheck`、`architecture:check`、`comments:check` 和 `build` 全部通过。

## 非目标

- 本次不接入真实 foliate-js 包或 EPUB 渲染视图。
- 本次不实现 EPUB 目录、搜索、批注、TTS、主题和版式。
- 本次不改变 EmbedPDF 已有工具栏命令或新增快捷键。
