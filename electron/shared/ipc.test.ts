/**
 * 职责：验证渲染进程可见的分组与固定通道契约。
 * 异步说明：共享常量测试不触发 IPC 或文件任务。
 * 安全说明：对话框能力必须使用命名白名单通道，不能暴露任意 invoke。
 * 资源说明：测试不创建 Electron 监听器或本机资源。
 */
import { expect, test } from 'vitest'
import * as ipcContract from './ipc'

const { IPC_API_GROUPS } = ipcContract

test('declares every renderer-to-main API group from the architecture boundary', () => {
  expect(IPC_API_GROUPS).toEqual([
    'window',
    'dialogs',
    'fs',
    'library',
    'fileRead',
    'data',
    'backup',
    'update',
    'lifecycle'
  ])
})

test('打开文档对话框使用唯一固定 IPC 通道', () => {
  expect((ipcContract as Record<string, unknown>).DIALOG_IPC_CHANNELS).toEqual({
    openDocuments: 'lec:dialogs:open-documents'
  })
})
