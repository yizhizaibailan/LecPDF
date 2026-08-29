import { expect, test } from 'vitest'
import { IPC_API_GROUPS } from './ipc'

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
