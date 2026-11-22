export function paintLine(which: 'first' | 'second', value: string, raw: string): string {
  if (which === 'first') {
    return value;
  }
  return raw;
}
