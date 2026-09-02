# LecPDF 单向数据流架构设计

## 目标与适用范围

本设计将 LecPDF 的渲染层调整为以 Zustand 为唯一前端状态来源的单向数据流架构。它约束 PDF、EPUB、标签页、开始页与应用外壳之间的数据传递方式，避免组件各自保存重复状态或直接调用 Electron API。

本设计只处理渲染层架构边界，不改变 FRD 已确认的功能范围。PDF 的唯一阅读内核为 EmbedPDF；EPUB 与后续已验证的非 PDF 电子书统一使用 `foliate-js`。该引擎选择已同步写入 FRD，后续实现不得引入 `epub.js`。

## 核心原则

1. Zustand 是唯一前端状态来源。所有影响界面的可变数据只能由 Store Action 修改。
2. React 组件只读取 selector 并发起 Action；不得直接调用 `window.lec`、EmbedPDF 或 `foliate-js`。
3. Store 负责业务流程编排与状态变更；适配器、数据访问层只返回数据或标准化事件。
4. 依赖只能从上层流向下层。下层不得导入 React 组件或 Zustand Store。
5. 引擎实例、DOM 引用、文件字节和临时对象 URL 不放入 Store；Store 只保留界面需要订阅的可序列化状态与资源句柄标识。

## 目标目录与职责

```text
src/
  components/
    Reader/                         # 阅读器的纯展示组件与受控视图
    TabBar/                         # 标签页 UI，只派发标签操作
    TitleBar/                       # 标题栏与窗口控制 UI
  config/
    reader-formats.ts               # 扩展名到阅读器类型的纯映射
  data/
    document-session.ts             # 文档会话数据转换与资源生命周期辅助
    readers/
      pdf/                          # EmbedPDF 适配器及 PDF 专属转换
      foliate/                      # foliate-js 适配器及 EPUB 专属转换
  db-api/
    document-api.ts                 # window.lec 的唯一渲染层访问入口
  pages/
    home/                           # 开始页的页面组合
    reader-reserved/                # 阅读页的页面组合与受控视图选择
  router/
    document-router.ts              # 文件格式分流，不保存界面状态
  stores/
    appStore.ts                     # 应用外壳状态
    tabStore.ts                     # 标签页状态
    readerStore.ts                  # 按标签保存的阅读会话状态
  types/
    document.ts                     # 文档、标签和会话通用类型
    reader.ts                       # 引擎输入、输出与标准事件类型
    window.d.ts                     # window.lec 类型声明
```

该目录结构只使用参考项目现有的顶层分类。不会创建根目录 `engines/` 或 `reader/`：内核适配属于数据层，阅读界面属于组件层，阅读页属于 `pages/reader-reserved/`。

## Store 所有权

### appStore

`appStore` 只保存应用级壳状态，例如主题、侧栏展开状态、全局提示和启动恢复提示。它不保存文档内容、文件路径读取结果、页码或阅读器实例。

### tabStore

`tabStore` 只保存标签元数据：开始页常驻标签、文档标签、当前激活标签、排序及最多 20 个标签的限制。它负责创建、激活和关闭标签，但不直接操作 EmbedPDF 或 Foliate 实例。

### readerStore

`readerStore` 以 `tabId` 为键保存阅读会话。每个会话包含文档类型、加载阶段、显示用标题、页码或章节位置、缩放、目录、搜索状态、进度、统一错误码和请求编号。它是唯一可以触发阅读器打开、关闭、搜索、定位和视图偏好更新的 Store。

Store 可以调用下层服务，但各 Store 只修改自己拥有的状态。跨 Store 的协作必须通过公开 Action 完成，以免隐藏的共享对象造成双向依赖。

## 单向数据流

```text
系统文件打开 / 用户点击 / 键盘快捷键
  -> React 页面或组件：派发 Action
  -> Zustand Store：校验意图、标记加载或错误状态
  -> router / data / db-api：分流、编排、读取与转换
  -> preload 安全 API / EmbedPDF / foliate-js
  -> DocumentResult 或 ReaderEvent
  -> Zustand Store：写入新状态
  -> React selector：订阅并重新渲染
```

只有“数据或标准事件”可以从下层返回。阅读器适配器上报页码、目录、搜索结果或错误时，必须先转换为 `ReaderEvent`，再由 `readerStore` Action 写入会话；适配器不能直接更改 UI 或 Store 内部对象。

## 打开文档流程

1. 打开按钮、拖放、系统文件关联或菜单调用 `tabStore.openDocument(path)`。
2. `tabStore` 创建加载中的标签，并交给 `readerStore` 为该 `tabId` 创建会话。
3. `readerStore` 请求 `document-router` 根据 `reader-formats` 判定 `pdf` 或 `foliate`；未知格式返回可展示的错误码。
4. `readerStore` 经由 `document-api` 获取受限文件来源。`document-api` 是唯一允许访问 `window.lec` 的渲染层模块。
5. `readerStore` 选择 `data/readers/pdf` 的 EmbedPDF 适配器或 `data/readers/foliate` 的 foliate-js 适配器。
6. 适配器返回初始 `DocumentResult`，并把后续页码、章节、目录、搜索等变化标准化为 `ReaderEvent`。
7. `readerStore` 更新该标签对应的会话；`components/Reader`、`components/TabBar` 和侧栏通过 selector 自动刷新。

## 异步、错误与资源释放

每次打开、重试或切换源文件都生成递增请求编号。Store 只接受与当前会话请求编号一致的结果；晚到的旧结果直接忽略，从而避免快速切换标签后发生状态回退。

不支持格式、文件不存在、权限拒绝、密码错误和引擎加载失败统一转换为错误码及不含绝对路径的用户文案。原始错误只记录在本地日志，界面不得泄露用户本机路径或文件内容。

关闭标签、切换文档或新请求替代旧请求时，`readerStore` 通过适配器关闭阅读器、撤销事件订阅并回收临时对象 URL。资源释放完成后才移除会话显示状态，确保不会留下后台阅读器或失效 URL。

## 依赖规则

```text
pages / components
  -> stores
  -> router / data / db-api
  -> electron preload API
  -> electron main
```

- `components` 和 `pages` 不得导入 `db-api` 或 `data/readers`。
- `data/readers`、`data` 和 `db-api` 不得导入 React、页面或 Store。
- `router` 只依赖格式配置与通用类型，不依赖 UI。
- 进程边界仍由 preload 白名单保证；渲染进程不读取任意本地路径。

## 验收与测试

1. 格式路由测试：PDF 只路由到 EmbedPDF，EPUB 只路由到 `foliate-js`，未知格式产生标准错误。
2. Store 测试：打开、激活、关闭、取消旧请求、错误重试和状态复位均可独立验证。
3. 数据边界测试：`document-api` 只调用白名单 API，错误转换不暴露绝对路径。
4. 适配器测试：EmbedPDF 与 foliate-js 都将其各自事件转换为统一 `ReaderEvent`，并在关闭时释放资源。
5. 页面集成测试：从打开文件到显示相应阅读视图的链路只通过 Store Action 驱动。
6. 架构检查：禁止组件直接访问 IPC 或阅读器内核，禁止下层反向导入 UI/Store。

## 迁移顺序

1. 建立通用类型、格式路由、`document-api` 与三个 Store 的最小可测试版本。
2. 将现有 PDF 流程迁入 EmbedPDF 适配器和 `components/Reader`，保持已具备的 PDF 能力。
3. 接入 foliate-js，并只为已验证的 EPUB 打开链路开放入口。
4. 将开始页、标签栏和阅读页接入 Store selector，移除单体 `App.tsx` 的业务状态。
5. 补齐架构检查与全项目中文注释，验证后再清理旧路径。
