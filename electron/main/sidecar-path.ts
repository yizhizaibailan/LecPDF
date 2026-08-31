/**
 * 把文档绝对路径稳定映射为 userData 下的 sidecar 文件名；通过截断 MD5 避免文件名泄露原路径。
 */
import { createHash } from 'node:crypto'

/** Stable sidecar location derived from the original document path. */
export function sidecarDataPath(documentPath: string): `data/${string}.json` {
  const hash = createHash('md5').update(documentPath).digest('hex').slice(0, 16)
  return `data/${hash}.json`
}
