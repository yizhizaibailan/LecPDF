# Foliate 真实接入与阅读数据流收口设计

## 目标

在保持 PDF 仅使用 EmbedPDF 的前提下，以固定上游提交的 Git 子模块接入 foliate-js，使 EPUB 能在 LecPDF 中真实打开、发布标准阅读事件并由 Zustand 会话状态驱动页面。同步补齐当前 PDF 阅读组件尚未完全 Store 驱动的展示边界。

本设计只覆盖阅读引擎、会话数据流和安全边界；不实现 EPUB 的搜索、批注、TTS、书签、阅读设置或非 EPUB 格式。

## 上游版本策略

- 添加 `vendor/foliate-js` Git 子模块，来源仅为官方 `johnfactotum/foliate-js` 仓库。
- 子模块固定到一个经过本轮验证的具体提交，不跟随上游分支自动更新。
- 版本升级必须单独提交，并重新执行 EPUB 打开、事件、资源释放及 CSP 验证。
- `foliate-js` 没有稳定发布版，因此不以浮动 npm 版本作为生产依赖来源。

## 模块边界

```text
src/data/readers/foliate/
  foliate-reader-controller.ts    公开的命令与事件端口
  foliate-reader-runtime.tsx      唯一允许导入 vendor/foliate-js 的 React 运行时
  foliate-view-port.ts            Foliate 自定义元素与标准事件之间的转换

src/pages/reader-reserved/
  FoliateReaderPage.tsx           只组合受控运行时与 Store 会话快照
  ReaderPage.tsx                  按会话种类分发 PDF / Foliate 页面
```

- `vendor/foliate-js` 只能由 `src/data/readers/foliate/` 导入；架构检查同时拦截静态、动态和 TypeScript import-equals 形式的越界引用。
- Store、页面和可复用组件不得持有 Foliate 的书籍对象、自定义元素、DOM 引用、Blob、事件监听器或对象 URL。
- `DocumentSessionRegistry` 仍按标签保存 EPUB 的临时字节；这些字节不会写入 Zustand。

## 单向数据流

```text
用户打开 EPUB
  → tabStore.openDocument
  → readerStore.openSession
  → DocumentSessionRegistry 保存临时字节
  → FoliateReaderRuntime 创建 Blob 与 foliate-view
  → Foliate 事件（ready / relocate / outline / failure）
  → ReaderEvent
  → readerStore.applyEvent(tabId, event)
  → useStoreSelector 取得 ReaderSession
  → ReaderPage / FoliateReaderPage 渲染状态与受控 UI
```

PDF 同样使用该回写路径。后续将工具栏、目录和搜索结果的展示数据切换到 `ReaderSession` selector；控制器只保留“用户意图 → 引擎命令”的职责，不再作为跨组件展示状态来源。

## Foliate 生命周期

1. `FoliateReaderRuntime` 从注册表获取当前标签的 EPUB 字节，并在运行时内部创建 `Blob`。
2. 运行时动态加载 Foliate 的视图模块、创建 `foliate-view`、挂载到自己的容器并调用 `open(blob)`。
3. `relocate` 映射为 `location-changed`；书籍目录映射为 `outline-changed`；成功打开发布 `ready`；异常发布 `load-failed`。
4. effect 清理时解除每个监听器、移除自定义元素、清空 Blob 与书籍引用。关闭标签的迟到事件由 Store 的会话存在性规则忽略。

## 安全与错误策略

- Electron 已启用 sandbox、contextIsolation 且关闭 nodeIntegration；新增严格 CSP，应用脚本只允许来自自身。
- Foliate 的书籍渲染仅允许受控 `blob:` 内容；EPUB 脚本不得执行或访问 `window.lec`。
- 适配器不得把文件绝对路径、原始异常堆栈或 EPUB 内容写入 `ReaderEvent`；页面展示标准化的 `DocumentOpenError`。
- 运行时仅接受 `DocumentSource` 中已授权的临时字节，不从页面读取任意本机路径。

## 验收标准

1. 子模块固定到明确提交，构建与测试环境可初始化该提交。
2. 一份 EPUB 能打开为真实 Foliate 视图；页面不再显示占位文本。
3. Foliate 的打开、位置和目录事件均转换为 `ReaderEvent`，且只更新当前标签会话。
4. 切换或关闭标签后，旧 Foliate 事件不再改写 Store；监听器和视图被释放。
5. PDF 与 EPUB 的工具栏/侧栏展示状态均从 `ReaderSession` selector 读取；控制器只执行命令。
6. 架构检查、类型检查、全部测试、注释检查、生产构建和实际 EPUB 冒烟验证通过。

## 非目标

- 不接入 foliate-js 支持的 MOBI、AZW3、FB2、CBZ、PDF 等其他格式。
- 不实现 EPUB 搜索、章节高亮、双页、设置、书签、批注和 TTS。
- 不更改 PDF 的 EmbedPDF 引擎选择，或将任何引擎实例放入 Zustand。
