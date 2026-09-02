/**
 * 职责：验证主进程打开文档对话框的格式过滤、取消结果与授权转交。
 * 异步说明：使用受控异步对话框结果，不启动真实 Electron 窗口。
 * 安全说明：只有对话框返回且扩展名为 PDF/EPUB 的路径可以进入共享授权流程。
 * 资源说明：测试用端口不注册真实 IPC handler，结束后没有监听器或文件句柄。
 */
import { expect, test, vi } from 'vitest'
import { DIALOG_IPC_CHANNELS } from '../shared/ipc'
import { registerDialogsIpcHandlers } from './dialogs-ipc'

type IpcHandler = (event: unknown) => Promise<string[]>

test('只返回对话框选择的 PDF/EPUB 并复用文档授权流程', async () => {
  const handlers = new Map<string, IpcHandler>()
  const showOpenDialog = vi.fn().mockResolvedValue({
    canceled: false,
    filePaths: ['C:\\books\\a.pdf', 'C:\\books\\b.EPUB', 'C:\\books\\notes.txt', 'C:\\books\\a.pdf']
  })
  const authorizeDocuments = vi.fn()

  registerDialogsIpcHandlers(
    { handle: (channel, handler) => handlers.set(channel, handler) },
    { showOpenDialog },
    authorizeDocuments
  )

  const paths = await handlers.get(DIALOG_IPC_CHANNELS.openDocuments)?.({})

  expect(showOpenDialog).toHaveBeenCalledWith({
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'PDF 与 EPUB 文档', extensions: ['pdf', 'epub'] }]
  })
  expect(paths).toEqual(['C:\\books\\a.pdf', 'C:\\books\\b.EPUB'])
  expect(authorizeDocuments).toHaveBeenCalledOnce()
  expect(authorizeDocuments).toHaveBeenCalledWith(['C:\\books\\a.pdf', 'C:\\books\\b.EPUB'])
})

test('取消打开文档对话框返回空数组且不授权路径', async () => {
  const handlers = new Map<string, IpcHandler>()
  const authorizeDocuments = vi.fn()
  registerDialogsIpcHandlers(
    { handle: (channel, handler) => handlers.set(channel, handler) },
    { showOpenDialog: async () => ({ canceled: true, filePaths: ['C:\\books\\ignored.pdf'] }) },
    authorizeDocuments
  )

  await expect(handlers.get(DIALOG_IPC_CHANNELS.openDocuments)?.({})).resolves.toEqual([])
  expect(authorizeDocuments).not.toHaveBeenCalled()
})
