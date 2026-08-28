export function shouldBlockRequest(rawUrl: string, isDevelopment: boolean): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  const isLocalDevelopmentAsset =
    isDevelopment && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  return !isLocalDevelopmentAsset;
}
