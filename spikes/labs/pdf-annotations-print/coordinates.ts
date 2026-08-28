export type PdfRotation = 0 | 90 | 180 | 270;

export interface PdfPageSpace {
  width: number;
  height: number;
  rotation: PdfRotation;
}

function assertInputs(coordinates: readonly number[], page: PdfPageSpace): void {
  if (coordinates.length === 0 || coordinates.length % 2 !== 0) {
    throw new Error('coordinates must contain x/y pairs');
  }
  if (!coordinates.every(Number.isFinite)) throw new Error('coordinates must be finite');
  if (!Number.isFinite(page.width) || !Number.isFinite(page.height) || page.width <= 0 || page.height <= 0) {
    throw new Error('page dimensions must be positive');
  }
  if (![0, 90, 180, 270].includes(page.rotation)) throw new Error('unsupported page rotation');
}

function toUnrotated(x: number, y: number, page: PdfPageSpace): [number, number] {
  switch (page.rotation) {
    case 0:
      return [x, y];
    case 90:
      return [y, page.height - x];
    case 180:
      return [page.width - x, page.height - y];
    case 270:
      return [page.width - y, x];
  }
}

function fromUnrotated(x: number, y: number, page: PdfPageSpace): [number, number] {
  switch (page.rotation) {
    case 0:
      return [x, y];
    case 90:
      return [page.height - y, x];
    case 180:
      return [page.width - x, page.height - y];
    case 270:
      return [y, page.width - x];
  }
}

export function pageToNormalized(coordinates: readonly number[], page: PdfPageSpace): number[] {
  assertInputs(coordinates, page);
  const normalized: number[] = [];
  for (let index = 0; index < coordinates.length; index += 2) {
    const [x, y] = toUnrotated(coordinates[index], coordinates[index + 1], page);
    normalized.push(x / page.width, y / page.height);
  }
  return normalized;
}

export function normalizedToPage(coordinates: readonly number[], page: PdfPageSpace): number[] {
  assertInputs(coordinates, page);
  const displayed: number[] = [];
  for (let index = 0; index < coordinates.length; index += 2) {
    const x = coordinates[index] * page.width;
    const y = coordinates[index + 1] * page.height;
    displayed.push(...fromUnrotated(x, y, page));
  }
  return displayed;
}
