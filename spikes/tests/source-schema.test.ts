import { describe, expect, it } from 'vitest';
import sources from '../evidence/sources.json';
import { validateSources } from '../evidence/source-schema';

describe('official evidence manifest', () => {
  it('covers the locked runtime and both document engines', () => {
    expect(validateSources(sources)).toEqual([]);
    expect(sources.map((x) => `${x.product}@${x.version}`)).toEqual(
      expect.arrayContaining([
        'electron@44.0.0',
        'embedpdf@2.15.0',
        'epubjs@0.3.93',
      ]),
    );
  });

  it.each([
    ['not an array', null],
    ['missing required fields', [{ id: 'x' }]],
    ['range version', [{ version: '^44.0.0' }]],
    ['trailing version garbage', [{ version: '44.0.0 unexpected' }]],
    ['unsupported kind', [{ kind: 'homepage' }]],
    ['non-HTTPS URL', [{ url: 'http://example.com' }]],
    ['invalid URL', [{ url: 'https://' }]],
    ['invalid date', [{ checkedAt: '2026-02-30' }]],
    ['missing license', [{ license: '' }]],
  ])('rejects %s', (_label, value) => {
    expect(validateSources(value)).not.toEqual([]);
  });
});
