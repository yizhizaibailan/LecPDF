import { expect, test } from 'vitest'
import { sidecarDataPath } from './sidecar-path'

test('uses a stable, opaque path for a document sidecar', () => {
  expect(sidecarDataPath('C:\\books\\paper.pdf')).toBe('data/4d31b435e9a15a57.json')
  expect(sidecarDataPath('C:\\books\\paper.pdf')).not.toContain('paper.pdf')
})
/** 覆盖 sidecar 安全路径映射，避免任意路径写入。 */
