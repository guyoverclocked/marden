/** Compare dotted release versions while ignoring a leading v and suffixes. */
export function compareVersions(a: string, b: string): number {
  const numericParts = (version: string) => version
    .replace(/^v/i, '')
    .split(/[+-]/, 1)[0]
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
  const ap = numericParts(a);
  const bp = numericParts(b);
  for (let index = 0; index < Math.max(ap.length, bp.length); index += 1) {
    const difference = (ap[index] || 0) - (bp[index] || 0);
    if (difference !== 0) return difference;
  }
  return 0;
}
