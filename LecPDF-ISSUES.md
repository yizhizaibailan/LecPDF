# LecPDF 开发 Issue 清单

> 版本：v2.0（风险门禁与可执行切片）· 日期：2026-08-28
> 上游依据：`LecPDF-FRD.md`、`LecPDF-ARCHITECTURE.md`（v2.1）、`LecPDF-DEV-TASKS.md`（含附录 A 设计规范）
> 拆分原则：垂直切片（每 issue 端到端穿过 schema/API/UI/测试，完成后可独立 demo）；AFK 优先，HITL 标注。R0 按需执行：M0/M1/M3 和基础 PDF 阅读不受其阻塞；开始某项风险能力前，必须先完成对应 R0 并取得 verdict。
> 状态图例：`AFK`=可无人值守实现；`HITL`=需人类决策/复核。

---

## R0 按需风险验证与测试基线

### R0-01 依赖锁定、离线基线与共享 fixtures · AFK
**What to build**：按 `docs/superpowers/plans/2026-08-27-lecpdf-risk-baseline.md` 建立 Electron 验证壳、固定依赖版本、离线门禁、PDF/EPUB fixtures 与结果目录约定。
**Acceptance criteria**
- [ ] 每个依赖记录官方来源、精确版本与许可证；无锁定范围版本
- [ ] 断网执行单元测试、构建和 Electron 冒烟均可复现
- [ ] 三类 PDF（文本/扫描/图文）及中英 EPUB fixtures 可被后续 R0 共享
**Blocked by**：None - can start immediately

### R0-02 PDF 七类批注、sidecar 与打印路线验证 · HITL（需独立查看器复核）
**What to build**：执行 `2026-08-27-lecpdf-pdf-annotations-print.md`，验证七类批注、旋转/缩放坐标、sidecar 往返和外部查看器中可见的打印输出。
**Acceptance criteria**
- [ ] `spikes/results/pdf-annotations-print.json` 记录版本、原始计数、截图/产物路径与 verdict
- [ ] 在 `saveAsCopy()` 不合格时，验证独立 PrintComposer；屏幕可见不算通过
- [ ] verdict 为 `原生支持`、`应用层扩展` 或 `需要 fork`；若为 `开源不可行`，明确阻塞 LEC-020/041
**Blocked by**：R0-01

### R0-03 PDF 智能反色路线验证 · HITL（需截图复核）
**What to build**：执行 `2026-08-27-lecpdf-pdf-night-mode.md`，以量化指标验证文字对比度、图片保真和批注可读性。
**Acceptance criteria**
- [ ] `spikes/results/pdf-night-mode.json` 包含三类样本的指标、截图和 verdict
- [ ] 不将整页 CSS 反色标为“智能反色”成功
- [ ] verdict 为 `原生支持`、`应用层扩展` 或 `需要 fork`；若为 `开源不可行`，明确阻塞 LEC-021
**Blocked by**：R0-01

### R0-04 EPUB 选区锚定验证 · HITL（需重排矩阵复核）
**What to build**：执行 `2026-08-27-lecpdf-epub-anchor.md`，验证 CFI 优先、文本回找、歧义和失效三态。
**Acceptance criteria**
- [ ] `spikes/results/epub-anchor.json` 覆盖中英文、跨行/内联标签、字体和布局变化
- [ ] 唯一匹配可恢复；多匹配/无匹配显式标记，禁止静默跳错
- [ ] verdict 决定 LEC-024 的实现路线；`开源不可行` 时阻塞该能力
**Blocked by**：R0-01

### R0-05 EPUB TTS 句级高亮验证 · HITL（需本机语音矩阵复核）
**What to build**：执行 `2026-08-27-lecpdf-epub-tts.md`，验证离线中英文朗读、暂停/继续/停止、跨章和句级 Range 高亮。
**Acceptance criteria**
- [ ] `spikes/results/epub-tts.json` 记录状态机转移、系统语音元数据与人工矩阵
- [ ] 网络关闭时完成中英文用例；无可用语音有明确产品提示
- [ ] verdict 决定 LEC-025 的实现路线；`开源不可行` 时阻塞该能力
**Blocked by**：R0-01

### R0-06 风险结论汇总与文档一致性门禁 · AFK
**What to build**：执行 `2026-08-27-lecpdf-risk-docs-synthesis.md`，汇总 R0-02~05 结论，更新所有被 verdict 影响的实施约束。
**Acceptance criteria**
- [ ] `LecPDF-TECH-RISK-REPORT.md` 逐项包含证据、结论、降级边界和后续 Issue 映射
- [ ] FRD、架构、开发任务与 Issue 清单对四项能力不存在矛盾承诺
- [ ] 每个被阻塞的能力有显式产品决策入口，不悄然移除
**Blocked by**：R0-02、R0-03、R0-04、R0-05

---

## M0 基础骨架

### LEC-001 项目脚手架与安全 Electron 壳 · AFK
**What to build**：pnpm + electron-vite + React 18 + TS + antd5 + Zustand 骨架，安全基线（contextIsolation/sandbox/nodeIntegration:false，preload 单文件 CJS），`pnpm dev` 出空 frameless 窗口。
**Acceptance criteria**
- [ ] `pnpm dev` 启动 frameless 空窗口；`pnpm build` exit 0；tsc 干净
- [ ] 依赖全部精确版本并提交 lockfile
- [ ] preload 以 CJS 构建并能在 sandbox 下加载
**Blocked by**：None - can start immediately

### LEC-002 antd 主题 token 与设计规范落地 · AFK
**What to build**：ConfigProvider 主题 token（附录 A.6：`colorPrimary #1677ff`、`colorBgLayout #e8edf4`、`colorText #1e293b`、`colorBorder #e2e8f0`、`borderRadius 8`）；iconify `solar:` 图标集接入；设计规范附录 A 作为 UI 开发基准文档引用。
**Acceptance criteria**
- [x] 主题 token 全应用生效，与附录 A 色板一致
- [x] solar 图标可按名引用渲染
- [x] 提供一个空态页面验证背景/文字/边框三色
**Blocked by**：LEC-001

### LEC-003 shared 磁盘 schema 类型 · AFK
**What to build**：`shared/` 落地五个磁盘结构类型——`Config`（settings 5 组 + shortcuts + window）、`Library`（recent/starred/folders/files）、`Sidecar`（`UnifiedAnnotation` 七类判别联合 + bookmarks + progress + epubSettings + tts）、`RuntimeMark`、`BackupManifest`，全部带 `version` 字段。
**Acceptance criteria**
- [x] 类型与 ARCH §6.1–6.5 JSON 示例一一对应
- [x] 七类批注判别联合（文本标记 quad / note point / freeText rect / ink paths）
- [x] tsc 干净；导出被 T0.3/后续任务直接复用
**Blocked by**：LEC-001

### LEC-004 IPC 契约与 window.lec 声明 · AFK
**What to build**：`shared/ipc.ts` 定义 window/dialogs/fs/library/fileRead/data/backup/update/lifecycle 全量接口；渲染侧 `env.d.ts` 声明 `window.lec`；preload 骨架暴露占位实现。
**Acceptance criteria**
- [x] 接口面与 ARCH §3 IPC 表一致
- [x] 渲染层可经类型安全方式调用全部通道
- [x] tsc 干净
**Blocked by**：LEC-003

### LEC-005 DataStoreSvc 原子读写 · AFK
**What to build**：主进程 `dataStore.ts`：userData 路径解析、`readJson/writeJson`（临时文件+rename、读写互斥、失败清理）。
**Acceptance criteria**
- [x] 并发写不产生半截文件
- [x] 写失败后临时文件被清理
- [x] 损坏 JSON 读取返回明确错误而非崩溃
- [x] vitest 覆盖原子写/损坏/互斥用例
**Blocked by**：LEC-004

### LEC-006 schema 迁移框架 · AFK
**What to build**：逐版本迁移器（按 `version` 链式升级）；未知高版本进入只读保护（拒绝覆盖用户数据）。
**Acceptance criteria**
- [x] v0→v1 迁移链单测 PASS
- [x] 未知高版本（如 v99）打开时只读保护并提示
- [x] 迁移失败保留原文件
**Blocked by**：LEC-005

---

## M1 主进程系统面

### LEC-007 WindowManager frameless 窗口与三键 · AFK
**What to build**：frameless 窗口创建；`window.minimize/maximize/close` + `onMaximizedChange` IPC；标题栏拖拽区。
**Acceptance criteria**
- [x] 窗口三键可用且状态同步（最大化图标切换）
- [x] 拖拽标题栏可移动窗口
- [x] 双击标题栏切换最大化
**Blocked by**：LEC-004

### LEC-008 窗口几何记忆 · AFK
**What to build**：关闭时保存 bounds/maximized 到 config；启动还原；越界（显示器拔出）回退主屏中央。
**Acceptance criteria**
- [x] 重启后位置/尺寸/最大化状态还原
- [x] 人为写入越界坐标后启动回退到可见区域
- [x] 单测覆盖越界回退
**Blocked by**：LEC-007、LEC-005

### LEC-009 SingleInstance 单实例与文件路由 · AFK
**What to build**：单实例锁；二次启动捕获命令行文件路径 → `lifecycle.onOpenFileRequest` 下发；首启时延迟到窗口就绪再下发。
**Acceptance criteria**
- [x] 双开时第二个实例退出且文件在首个窗口路由成功
- [x] 首启带文件参数打开正确
**Blocked by**：LEC-007

### LEC-010 ProtocolSvc lec-file:// 流式读取 · AFK
**What to build**：注册 `lec-file://` 协议，按 Range 流式读取本地 PDF；路径校验防止任意文件读取。
**Acceptance criteria**
- [x] 200MB 测试 PDF 流式读取正常，支持 Range 请求
- [x] 非法路径被拒绝
- [x] 渲染层可直接以 URL 打开
**Blocked by**：LEC-004

### LEC-011 LibrarySvc 目录扫描 · AFK
**What to build**：`scanFolders(paths[])` → `FileIndexEntry[]`（readdir+stat，仅 .pdf/.epub，不解析内容）。
**Acceptance criteria**
- [ ] 混合目录扫描返回正确元数据（名称/大小/mtime/kind）
- [ ] 子目录递归；大目录不阻塞主进程
**Blocked by**：LEC-004

### LEC-012 CrashMarker 崩溃标记 · AFK
**What to build**：启动写 runtime.json（cleanExit=false + lastTabPaths + startedAt）；正常退出置 true。
**Acceptance criteria**
- [ ] 强杀后重启检测 cleanExit=false
- [ ] 正常退出（窗口全关）置 true
- [ ] lastTabPaths 按打开顺序记录
**Blocked by**：LEC-005

### LEC-013 BackupSvc 自动备份 · AFK
**What to build**：定时备份（默认每周）→ `backups/backup-<ts>.zip`（ARCH §6.5 格式），轮转保留 3 份。
**Acceptance criteria**
- [ ] 定时触发产出合法 zip（manifest + library + 全部 sidecar）
- [ ] 轮转删除最旧，保留最近 3 份
- [ ] 设置可关/可改周期
**Blocked by**：LEC-005

### LEC-014 数据导出/导入 · AFK
**What to build**：手动导出到用户选择位置；导入解包按 path 重映射；缺失文件跳过并报告清单。
**Acceptance criteria**
- [ ] 导出的 zip 可在新目录导入还原
- [ ] path 不存在时跳过并在 UI 报告
- [ ] config 合并询问（覆盖/跳过）
**Blocked by**：LEC-013

### LEC-015 UpdateSvc 与 Logger · AFK
**What to build**：electron-updater 检查新版本（不静默安装）；electron-log 落盘 logs/；零遥测审计点（无外发数据）。
**Acceptance criteria**
- [ ] 检查更新返回版本信息
- [ ] 日志落盘含启动/错误记录
- [ ] 抓包验证无遥测外发
**Blocked by**：LEC-004

---

## M2 引擎适配层

### LEC-016 ReaderEngine 统一接口 · AFK
**What to build**：`engines/types.ts`——`ReaderEngine` 接口（open/close/layout/view/outline/thumbs/search/selection/annotations/tts/applySettings）+ 相关类型（LocationRef/LayoutMode/SearchHit/OutlineNode/UnifiedAnnotation 转换）。
**Acceptance criteria**
- [ ] 接口完整覆盖 ARCH §5
- [ ] PDF/EPUB 空实现骨架 tsc 通过
- [ ] 类型被业务层引用（不依赖具体引擎）
**Blocked by**：LEC-003

### LEC-017 PDF 打开与渲染 · AFK
**What to build**：embedpdf v2 接入：`lec-file://` 打开、加密密码回调、渲染视口挂载。
**Acceptance criteria**
- [ ] fixtures/text.pdf 渲染正确（3 页可见）
- [ ] 加密 PDF 触发密码回调
- [ ] 密码错误可重试；正确后进入阅读
**Blocked by**：LEC-016、LEC-010

### LEC-018 PDF 布局/缩放/旋转/导航 · AFK
**What to build**：单页/连续/双页布局；缩放 10%–400%；视图旋转 0/90/180/270；页码跳转与 `getPosition` 进度。
**Acceptance criteria**
- [ ] 三布局切换正确（双页奇数补白）
- [ ] 缩放/旋转后页面渲染正确
- [ ] 跳页后 getPosition 返回正确页码/滚动
**Blocked by**：LEC-017

### LEC-019 PDF 缩略图与目录 · AFK
**What to build**：缩略图懒加载（进入视口才渲染 + LRU）；outline 树 + 当前位置高亮 + 点击跳转。
**Acceptance criteria**
- [ ] 100 页 PDF 缩略图滚动流畅（懒加载生效）
- [ ] 有 outline 的 PDF 目录树正确，翻页时高亮跟随
- [ ] 点击目录项跳页
**Blocked by**：LEC-017

### LEC-020 PDF 七类批注与 sidecar 序列化 · AFK
**What to build**：按 R0-02 verdict 实现高亮/下划线/删除线/波浪线/便签/自由文本/手绘：创建、修改、删除、从 sidecar 恢复；`serialize` 引擎批注 ↔ `UnifiedAnnotation`（归一化坐标，旋转感知）。只允许采用 R0-02 已验证的原生、应用层或 fork 路线。
**Acceptance criteria**
- [ ] 七类批注创建→导出→清空→导入后类型与几何完整恢复
- [ ] 0/90/180/270 旋转下几何对齐
- [ ] 实现路线与 R0-02 verdict 一致；`开源不可行` 时不启动本 Issue
**Blocked by**：LEC-018、R0-02

### LEC-021 PDF 夜间模式 · AFK
**What to build**：按 R0-03 verdict 实现 `setNightMode`；仅在已证实存在内容分层路径时承诺文字反色与图片保真，批注需保持对比度。
**Acceptance criteria**
- [ ] text/scanned/mixed 三类样本：正文对比度 ≥4.5:1
- [ ] 图片保真能力仅在 R0-03 判定可行的路线下验收
- [ ] 批注在暗底可辨（≥3:1）
**Blocked by**：LEC-018、R0-03

### LEC-022 EPUB 打开与渲染 · AFK
**What to build**：epub.js 接入：ArrayBuffer 打开、分页/滚动/双页布局、章节渲染。
**Acceptance criteria**
- [ ] reflow.epub（3 章中英混排）渲染正确
- [ ] 三布局切换正确
- [ ] 章节间导航正常
**Blocked by**：LEC-016

### LEC-023 EPUB 目录/搜索/阅读设置 · AFK
**What to build**：章节树 + 当前位置高亮 + 跳转；全书搜索；阅读设置（字号 14–23/行距 1.4–2.2/页边距 3–6/三主题）热应用，按书记忆。
**Acceptance criteria**
- [ ] 章节高亮跟随翻页
- [ ] 搜索命中跳转章节
- [ ] 设置热应用且重开后按书恢复
**Blocked by**：LEC-022

### LEC-024 EPUB 选区锚定批注 · AFK
**What to build**：按 R0-04 verdict 实现选中文本 → 批注；锚点存 `epubCfi + quote`；恢复 CFI 优先、文本回找降级（resolved/ambiguous/orphaned 三态，禁止静默跳错）。
**Acceptance criteria**
- [ ] 未改内容 EPUB 锚点恢复率 100%
- [ ] 改动后唯一匹配重定位；多匹配/无匹配标 orphaned
- [ ] 中英文、跨行、跨内联标签选区可用
**Blocked by**：LEC-022、R0-04

### LEC-025 EPUB TTS 句级高亮 · AFK
**What to build**：按 R0-05 verdict 实现 `TtsSession` 状态机（idle/playing/paused/stopping/error）；`Intl.Segmenter` 中英分句；逐句 utterance 队列；当前句高亮；暂停/继续/停止；跨章推进；音色=系统已装语音。
**Acceptance criteria**
- [ ] 中英文朗读/暂停/继续/停止/跨章可用
- [ ] 高亮对应当前句（非整段）
- [ ] 断网可用；无系统语音时给出安装提示
**Blocked by**：LEC-022、R0-05

---

## M3 渲染层核心

### LEC-026 Stores 状态层 · AFK
**What to build**：五个 zustand store（tabs≤20/library/settings/fileData/ui）+ 关键 reducer 单测。
**Acceptance criteria**
- [ ] 标签上限 20 强制
- [ ] fileData 按文件隔离
- [ ] 单测覆盖关键分支
**Blocked by**：LEC-003

### LEC-027 Data 访问层 · AFK
**What to build**：500ms 防抖写编排；undo/redo 栈（会话级 ≤50 步，批注增/改/删闭包）；锚点失效重定位（quote 回找 → orphaned）；损坏 sidecar 隔离。
**Acceptance criteria**
- [ ] 连续变更合并为一次写盘
- [ ] Ctrl+Z/Y 撤销重做（仅批注）
- [ ] 损坏 sidecar 打开不崩、数据可诊断
**Blocked by**：LEC-026、LEC-006

### LEC-028 Shell 外壳：标题栏/标签页/菜单/快捷键 · AFK
**What to build**：frameless 标题栏（Logo 回开始页 + 应用菜单 + 三键，附录 A.4 样式）；标签页（开始页常驻、中键关闭、Ctrl+W、溢出滚动、上限 20）；全局快捷键注册分发（FRD §4.7 默认表）。
**Acceptance criteria**
- [ ] 标题栏视觉与附录 A 一致（56px、半透明模糊、渐变 Logo）
- [ ] 标签页全交互可用（增删切换/中键/关闭钮/上限）
- [ ] 默认快捷键全表生效
**Blocked by**：LEC-026、LEC-007

### LEC-029 i18n 中英双语 · AFK
**What to build**：i18next 接入；zh-CN/en-US 全量资源；语言热切换。
**Acceptance criteria**
- [ ] 语言切换全界面即时生效
- [ ] 无硬编码文案遗漏（lint 检查）
- [ ] 语言选择持久化
**Blocked by**：LEC-026

### LEC-030 三主题（浅/深/跟随系统） · AFK
**What to build**：antd 主题算法切换（light/dark/system）；系统变化监听。
**Acceptance criteria**
- [ ] 三模式切换即时生效
- [ ] 跟随系统模式下监听 OS 主题变化
- [ ] 深色下侧栏/标题栏/弹窗配色正确（附录 A 扩展深色板）
**Blocked by**：LEC-002

---

## M4 页面与功能

### LEC-031 StartPage 骨架与文件打开三入口 · AFK
**What to build**：开始页布局（左侧导航 + 右侧列表 + 顶栏，附录 A 渐变底）；打开按钮文件选择器、窗口拖放、文件关联路由；路径失效重定位流程（F4）。
**Acceptance criteria**
- [ ] 三入口均能打开文件并建标签
- [ ] 拖放到窗口任意位置生效
- [ ] 路径失效文件标灰 + 重定位对话框
**Blocked by**：LEC-028、LEC-011

### LEC-032 最近列表与阅读进度 · AFK
**What to build**：最近列表（≤100 LRU、进度显示页/章+百分比、星标置顶组、条目操作）。
**Acceptance criteria**
- [ ] 打开文件即入最近，进度随阅读更新
- [ ] LRU 淘汰超 100 条
- [ ] 条目操作：打开/定位/移出/星标切换
**Blocked by**：LEC-031、LEC-027

### LEC-033 星标与我的文档 · AFK
**What to build**：星标分区；我的文档（添加文件夹、扫描、刷新、移出库、删除走回收站）。
**Acceptance criteria**
- [ ] 星标全局同步显示
- [ ] 扫描/刷新/移出库/删除（确认+回收站）全流程
- [ ] 删除后索引与磁盘状态一致
**Blocked by**：LEC-031、LEC-011

### LEC-034 书签与批注聚合视图 · AFK
**What to build**：跨文件书签列表 + 批注列表（按文件/类型筛选、搜索、点击打开并定位）。
**Acceptance criteria**
- [ ] 点击聚合条目打开对应文件并定位到页/章节
- [ ] 筛选/搜索正确
- [ ] orphaned 批注有显式标记
**Blocked by**：LEC-033、LEC-027、LEC-038；批注聚合分区还依赖 LEC-020（PDF）或 LEC-024（EPUB）的至少一个已完成数据源

### LEC-035 Reader 阅读器容器（PDF） · AFK
**What to build**：阅读页容器：工具栏（缩放/布局/旋转/页码/适页适宽/全屏，附录 A.4 样式）、侧栏骨架、状态栏、渲染视口；Ctrl+滚轮缩放；F11 全屏。
**Acceptance criteria**
- [ ] 工具栏视觉/交互与原型一致（48px、32px 图标钮、激活态蓝底）
- [ ] 页码输入跳转、适页/适宽、全屏
- [ ] 状态栏反馈文案
**Blocked by**：LEC-028、LEC-018

### LEC-036 PDF 批注 UI 与批注侧栏 · AFK
**What to build**：七工具按钮 + 每类 5 色预设；批注侧栏（按页分组、图标/颜色/摘录/时间、点击定位、编辑改色改文、删除）；撤销/重做接入。
**Acceptance criteria**
- [ ] 七类批注全交互（划选/落点/浮层）
- [ ] 侧栏编辑/删除/定位
- [ ] Ctrl+Z/Y 生效（≤50 步）
**Blocked by**：LEC-035、LEC-020、LEC-027

### LEC-037 文档内搜索 · AFK
**What to build**：共享 Ctrl+F 搜索栏（关键词、命中计数、上一个/下一个、大小写敏感）和两条独立后端接入：PDF 页码跳转/高亮、EPUB 章节跳转/高亮。两条路径分别提交回归证据，PDF 路径不等待 EPUB 路径。
**Acceptance criteria**
- [ ] PDF 搜索导航正确（可在 EPUB 尚未完成时独立验收）
- [ ] EPUB 搜索导航正确（可在 PDF 尚未完成时独立验收）
- [ ] 命中计数实时更新
- [ ] 大小写敏感开关生效
**Blocked by**：PDF 子路径：LEC-035；EPUB 子路径：LEC-023；共享 UI：LEC-028

### LEC-038 书签功能 · AFK
**What to build**：共享书签模型和两条独立接入：PDF 收藏页/选区、EPUB 收藏章节；命名/排序/删除/跳转；侧栏书签列表。PDF 路径不依赖 EPUB 批注锚点。
**Acceptance criteria**
- [ ] PDF 页码/选区书签可跳转恢复
- [ ] EPUB 章节书签可跳转恢复
- [ ] 命名/排序/删除
- [ ] 与文件自带目录并存
**Blocked by**：共享模型：LEC-027；PDF 子路径：LEC-035；EPUB 子路径：LEC-023

### LEC-039 EPUB 阅读器页面 · AFK
**What to build**：EPUB 工具栏（章节跳转/布局/搜索）；侧栏（目录/书签/批注）；阅读设置浮层（字号/行距/页边距/三主题，附录 A.4 滑杆样式）；选中文本工具条（高亮/下划线/删除线/波浪线/便签/复制）；TTS 控制条。
**Acceptance criteria**
- [ ] FRD §4.4 全部交互可用
- [ ] 设置浮层样式与原型一致（420px 面板）
- [ ] TTS 控制条（语速/音色/暂停继续停止/进度）
**Blocked by**：LEC-028、LEC-023、LEC-024、LEC-025（不依赖 LEC-035；仅复用共享 Shell/ReaderChrome）

### LEC-040 Settings 设置页 · AFK
**What to build**：5 组设置（通用/阅读/外观/批注/快捷键）；快捷键改键 + 冲突检测 + 恢复默认；存储占用展示 + 清缓存；导出/导入入口；自动备份开关。
**Acceptance criteria**
- [ ] 各组设置持久化并即时生效
- [ ] 改键冲突拦截提示
- [ ] 缓存占用统计与清空
**Blocked by**：LEC-029、LEC-030、LEC-013、LEC-014

### LEC-041 打印（原文 + 含批注） · AFK
**What to build**：按 R0-02 verdict 接入系统打印：仅原文 / 原文+批注（可选层）、页码范围、缩放；若原生导出缺 appearance，只能采用 R0-02 验证通过的独立 PrintComposer 路线。
**Acceptance criteria**
- [ ] 两种模式打印输出页数/尺寸与原文一致
- [ ] 含批注输出在独立查看器中可见七类批注
- [ ] 合成失败时保留仅原文选项并记录错误
**Blocked by**：LEC-036、R0-02

### LEC-042 加密 PDF 密码框与崩溃恢复提示 · AFK
**What to build**：加密 PDF 密码弹窗（会话内记住、不落盘）；启动 cleanExit=false 弹"恢复上次打开的文档？"按 lastTabPaths 重开标签。
**Acceptance criteria**
- [ ] 密码验证后可阅读、批注走 sidecar
- [ ] 强杀重启后恢复提示正常；确认后标签恢复
- [ ] 密码不写入任何磁盘文件
**Blocked by**：LEC-035、LEC-012

---

## M5 集成与交付

### LEC-043 文件关联与安装包 · AFK
**What to build**：electron-builder NSIS；fileAssociations（.pdf/.epub 可选默认）；单实例路由联调；安装/升级流程。
**Acceptance criteria**
- [ ] 安装后双击 PDF 打开 LecPDF；二次双击路由新标签
- [ ] 升级安装保留用户数据（userData 不清理）
- [ ] 卸载流程正常
**Blocked by**：M4 全部

### LEC-044 帮助/关于与开源合规 · AFK
**What to build**：帮助菜单（快捷键总览/使用文档/检查更新/关于）；关于页协议声明（embedpdf Apache-2.0、epub.js BSD-2-Clause、Electron MIT 等）。
**Acceptance criteria**
- [ ] 关于页版本/引擎/协议信息完整
- [ ] 协议清单覆盖全部直接依赖
**Blocked by**：LEC-040

### LEC-045 性能达标与内存策略 · HITL（需人工实测）
**What to build**：≤200MB/≤2000 页打开 ≤3s、翻页 ≤300ms、滚动 60fps；>200MB 轻量模式（警告+关预渲染+缩略图懒加载）；非活动标签释放位图；2GB 缓存 LRU。
**Acceptance criteria**
- [ ] FRD §5 指标逐项实测记录达标
- [ ] 轻量模式开关有效
- [ ] 标签后台化内存回落
**Blocked by**：M4 全部

### LEC-046 稳定性压测与交付审计 · HITL（需人工复核）
**What to build**：强杀/断电模拟数据零丢失验证；schema 高版本只读保护验证；零遥测审计；安装/卸载/升级冒烟。
**Acceptance criteria**
- [ ] 崩溃后最多丢 500ms 内操作
- [ ] 审计无外发网络请求
- [ ] 全流程冒烟通过
**Blocked by**：LEC-043、LEC-045

---

## 统计

| 里程碑 | Issue 数 | HITL |
|---|---|---|
| R0 | 6 | 4 |
| M0 | 6 | 0 |
| M1 | 9 | 0 |
| M2 | 10 | 0 |
| M3 | 5 | 0 |
| M4 | 12 | 0 |
| M5 | 4 | 2 |
| **合计** | **52** | **6** |

## 依赖链提示

- 当前关键路径：LEC-001→003→004→005→(007→028) 与 (016→017→018)；对应风险功能在开始前插入其 R0 verdict。
- 可并行组 A（风险）：R0-02/03/04/05 均依赖 R0-01，彼此独立；只在对应风险能力开工前领取。
- 可并行组 B（主进程）：007/009/010/011/012/013/015 互不阻塞。
- 可并行组 C（引擎）：PDF 017~021 与 EPUB 022~025 分两条线推进，但 020/021/024/025 分别受 R0 verdict 门禁。
- 可并行组 D（页面）：031/040、PDF 035/036、EPUB 039 可并行；037/038 以格式子路径分别验收，034 在数据源成熟后再聚合。

## 发布到 issue tracker 时的建议

- 本清单按依赖顺序排列，发布时 blockers 先行
- 建议 triage 标签：`R0`~`M5` 里程碑标签 + `hazard`（R0 全部及 LEC-020/021/024/025/041）+ `afk`/`hitl`；R0 后续 Issue 未有 verdict 时额外加 `blocked`
- 每个 issue 的 What to build 与验收标准可直接作为 tracker body
