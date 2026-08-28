import { randomUUID } from 'node:crypto';
import { mkdir, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { assertLabResult, resultFileName, type LabResult } from '../shared/lab-contract';

export async function saveLabResult(resultsDirectory: string, value: unknown): Promise<void> {
  assertLabResult(value);
  const result: LabResult = value;
  const fileName = resultFileName(result.labId);
  const targetPath = join(resultsDirectory, fileName);
  const temporaryPath = join(resultsDirectory, `.${fileName}.${randomUUID()}.tmp`);

  await mkdir(resultsDirectory, { recursive: true });
  try {
    await writeFile(temporaryPath, `${JSON.stringify(result, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
    await rename(temporaryPath, targetPath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}
