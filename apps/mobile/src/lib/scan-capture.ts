let latestCapture: { uri: string; key: string } | null = null;

export function rememberScanCapture(uri: string): string {
  const key = `capture-${Date.now()}`;
  latestCapture = { uri, key };
  return key;
}

export function getScanCapture(key?: string): string | undefined {
  if (!latestCapture || (key && latestCapture.key !== key)) return undefined;
  return latestCapture.uri;
}
