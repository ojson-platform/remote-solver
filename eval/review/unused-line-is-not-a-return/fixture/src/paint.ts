export function paintLine(line: string, value: string): string {
  if (line.startsWith('  ')) {
    return line;
  }
  return value;
}
