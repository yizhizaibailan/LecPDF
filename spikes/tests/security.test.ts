import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { shouldBlockRequest } from '../app/main/network-policy';
import { saveLabResult } from '../app/main/result-store';

const createdDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('offline network policy', () => {
  it.each(['https://example.com/a', 'http://example.com/a'])('blocks remote request %s', (url) => {
    expect(shouldBlockRequest(url, true)).toBe(true);
    expect(shouldBlockRequest(url, false)).toBe(true);
  });

  it.each(['http://localhost:5173/index.html', 'http://127.0.0.1:5173/@vite/client'])('allows local dev asset %s only in development', (url) => {
    expect(shouldBlockRequest(url, true)).toBe(false);
    expect(shouldBlockRequest(url, false)).toBe(true);
  });

  it.each(['file:///D:/book.pdf', 'data:text/plain,ok', 'devtools://devtools/bundled/'])('leaves non-network URL %s alone', (url) => {
    expect(shouldBlockRequest(url, false)).toBe(false);
  });
});

describe('result store', () => {
  it('writes validated JSON and leaves no temporary file', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'lecpdf-result-'));
    createdDirectories.push(directory);
    const result = {
      labId: 'pdf-night-mode',
      verdict: '应用层扩展',
      checks: [{ id: 'contrast', passed: true, detail: '4.7:1' }],
      evidence: ['electron@44.0.0'],
      commercialDecision: { status: 'not-needed' },
    } as const;

    await saveLabResult(directory, result);

    expect(JSON.parse(await readFile(join(directory, 'pdf-night-mode.json'), 'utf8'))).toEqual(result);
    expect(await readdir(directory)).toEqual(['pdf-night-mode.json']);
  });

  it('rejects path traversal without writing a file', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'lecpdf-result-'));
    createdDirectories.push(directory);

    await expect(saveLabResult(directory, {
      labId: '../escape',
      verdict: '原生支持',
      checks: [],
      evidence: [],
      commercialDecision: { status: 'not-needed' },
    })).rejects.toThrow('invalid LabResult');
    expect(await readdir(directory)).toEqual([]);
  });
});
