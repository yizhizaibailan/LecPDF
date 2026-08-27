export interface EvidenceSource {
  id: string;
  product: string;
  version: string;
  url: string;
  kind: 'docs' | 'repository' | 'release' | 'issue' | 'license';
  checkedAt: string;
  license: string;
}

const KINDS = new Set<EvidenceSource['kind']>([
  'docs',
  'repository',
  'release',
  'issue',
  'license',
]);

// Semantic Versioning 2.0.0, with no range operators or surrounding text.
const EXACT_SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function validateSources(input: unknown): string[] {
  if (!Array.isArray(input)) return ['manifest must be an array'];

  return input.flatMap((value, index) => {
    const errors: string[] = [];
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return [`${index} must be an object`];
    }

    const source = value as Partial<EvidenceSource>;
    if (typeof source.id !== 'string' || source.id.trim() === '') errors.push(`${index}.id missing`);
    if (typeof source.product !== 'string' || source.product.trim() === '') errors.push(`${index}.product missing`);
    if (typeof source.version !== 'string' || !EXACT_SEMVER.test(source.version)) {
      errors.push(`${index}.version is not exact`);
    }

    if (typeof source.url !== 'string') {
      errors.push(`${index}.url must be https`);
    } else {
      try {
        const url = new URL(source.url);
        if (url.protocol !== 'https:') errors.push(`${index}.url must be https`);
      } catch {
        errors.push(`${index}.url must be https`);
      }
    }

    if (!KINDS.has(source.kind as EvidenceSource['kind'])) errors.push(`${index}.kind invalid`);
    if (!isValidDate(source.checkedAt)) errors.push(`${index}.checkedAt invalid`);
    if (typeof source.license !== 'string' || source.license.trim() === '') errors.push(`${index}.license missing`);
    return errors;
  });
}
