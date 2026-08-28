import { describe, expect, it } from 'vitest';
import { assertLabResult, resultFileName } from '../app/shared/lab-contract';

const validResult = {
  labId: 'epub-anchor',
  verdict: '应用层扩展',
  checks: [{ id: 'reload', passed: true, detail: '20/20 restored' }],
  evidence: ['epubjs@0.3.93'],
  commercialDecision: { status: 'not-needed' },
} as const;

describe('lab result contract', () => {
  it('accepts a complete result using an approved verdict', () => {
    expect(() => assertLabResult(validResult)).not.toThrow();
  });

  it.each(['maybe', '', '部分支持'])('rejects unapproved verdict %s', (verdict) => {
    expect(() => assertLabResult({ ...validResult, verdict })).toThrow('invalid LabResult');
  });

  it.each([
    { field: 'checks', value: [{ id: '', passed: true, detail: 'x' }] },
    { field: 'checks', value: [{ id: 'x', passed: 'yes', detail: 'x' }] },
    { field: 'evidence', value: [42] },
    { field: 'commercialDecision', value: { status: 'approved' } },
    { field: 'commercialDecision', value: { status: 'unknown' } },
  ])('rejects malformed $field', ({ field, value }) => {
    expect(() => assertLabResult({ ...validResult, [field]: value })).toThrow('invalid LabResult');
  });

  it.each(['../escape', 'a/b', 'a\\b', '.', ''])('rejects unsafe result file id %s', (labId) => {
    expect(() => resultFileName(labId)).toThrow('invalid labId');
  });

  it('derives a JSON filename from a safe lab id', () => {
    expect(resultFileName('pdf-night-mode')).toBe('pdf-night-mode.json');
  });
});
