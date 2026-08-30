import { createHash } from 'node:crypto'

/** Stable sidecar location derived from the original document path. */
export function sidecarDataPath(documentPath: string): `data/${string}.json` {
  const hash = createHash('md5').update(documentPath).digest('hex').slice(0, 16)
  return `data/${hash}.json`
}
