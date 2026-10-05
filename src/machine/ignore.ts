export function authorIgnored(login: string, patterns: readonly RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(login));
}
