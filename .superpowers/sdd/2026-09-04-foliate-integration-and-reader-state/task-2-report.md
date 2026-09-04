# Task 2：Foliate 自定义事件受控适配报告

## 实现

- 新增 `src/data/readers/foliate/foliate-view-port.ts`，以 `FoliateViewPort` 实现既有 `FoliateReaderPort`。
- `open` 将 `ArrayBuffer` 封装为 `application/epub+zip` Blob；成功后按 `label`、`href`、`subitems` 递归发布稳定索引路径目录与 `ready`。
- 将 `relocate` 的 `index` 与 `fraction` 转换为标准 `location-changed`，并将进度限制在 0 至 1。
- `close` 仅一次移除 DOM 事件、关闭视图、清空订阅；订阅取消同样幂等。
- 打开失败只发布一次安全的 `load-failed`，不重新抛出原始异常。

## TDD：RED

先创建 `foliate-view-port.test.ts`，覆盖递归目录和就绪、定位转换与范围限制、关闭/退订后的资源释放、打开失败的安全事件。

命令：

```text
corepack pnpm test:run -- src/data/readers/foliate/foliate-view-port.test.ts
```

输出（节选）：

```text
FAIL  src/data/readers/foliate/foliate-view-port.test.ts
Error: Cannot find module './foliate-view-port'
Test Files  1 failed | 58 passed (59)
Tests  156 passed (156)
Command failed with exit code 1.
```

失败原因为生产模块尚不存在，符合 RED 预期。

## TDD：GREEN

实现最小视图端口后执行：

```text
corepack pnpm test:run -- src/data/readers/foliate/foliate-view-port.test.ts
```

输出：

```text
Test Files  59 passed (59)
Tests  160 passed (160)
```

## 最终验证

```text
corepack pnpm test:run -- src/data/readers/foliate/foliate-view-port.test.ts src/data/readers/foliate/foliate-reader-controller.test.ts
Test Files  59 passed (59)
Tests  160 passed (160)

corepack pnpm typecheck
exit 0

corepack pnpm architecture:check
exit 0

corepack pnpm comments:check
exit 0
```

Vitest 运行器在该脚本的参数形式下执行了完整测试集，因此上述测试总数包含现有套件；新增的 4 项测试均被载入。

## 文件

- 新增 `src/data/readers/foliate/foliate-view-port.ts`
- 新增 `src/data/readers/foliate/foliate-view-port.test.ts`
- 新增 `.superpowers/sdd/2026-09-04-foliate-integration-and-reader-state/task-2-report.md`
- 已复核 `foliate-reader-controller.ts` 和对应测试：其取消订阅幂等契约已覆盖，无需为适配器重复改写。

## 自审

- 仅数据层 Foliate 目录接触受控视图；未修改页面、Store、子模块或 CSP。
- 新增生产 TS 文件包含中文职责、异步、资源释放说明，且远低于 300 行。
- 错误事件固定为安全文案，不传递路径、书籍内容或异常堆栈。

## 疑虑

无。Foliate 事件结构按任务简报限定为 `relocate.detail` 的 `index` 与 `fraction`；后续运行时接入应保持该受控边界。
