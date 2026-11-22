/** Exit codes of one command, in trace order. `arg` is the second word (`sdd test`, `sdd publish`). */
export function commandExits(trace: string[], bin: string, arg?: string): number[] {
  const found: number[] = [];
  for (const line of trace) {
    const body = line.replace(/ exit=(\d+)$/, '');
    const code = / exit=(\d+)$/.exec(line);
    const words = body.split(/\s+/);
    if (words[0] !== bin) {
      continue;
    }
    if (arg !== undefined && words[1] !== arg) {
      continue;
    }
    if (code) {
      found.push(Number(code[1]));
    }
  }
  return found;
}

export function traceHas(trace: string[], needle: string): boolean {
  return trace.some(line => line.includes(needle));
}
