import { expect, test, vi } from 'vitest'
import { openDocumentsFromDialog } from './open-documents'

/**
 * 验证多文件选择按选择顺序交给标签打开动作，避免并行加载打乱当前标签状态。
 */
test('选择器中的全部路径复用标签打开动作', async () => {
  const selectPaths = vi.fn().mockResolvedValue(['C:\\Books\\a.pdf', 'C:\\Books\\b.pdf'])
  const openDocument = vi.fn().mockResolvedValue('tab-1')

  await openDocumentsFromDialog(selectPaths, openDocument)

  expect(openDocument).toHaveBeenNthCalledWith(1, 'C:\\Books\\a.pdf')
  expect(openDocument).toHaveBeenNthCalledWith(2, 'C:\\Books\\b.pdf')
})
