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

/** One command line: the words after the command name, and the exit when the line has one. */
export function traceCommands(
  trace: string[],
  bin: string,
): {args: string[]; exit: number | null; line: string}[] {
  const found: {args: string[]; exit: number | null; line: string}[] = [];
  for (const line of trace) {
    const code = / exit=(\d+)$/.exec(line);
    const body = line.replace(/ exit=(\d+)$/, '');
    const words = body.split(/\s+/);
    if (words[0] !== bin) {
      continue;
    }
    found.push({
      args: words.slice(1),
      exit: code ? Number(code[1]) : null,
      line,
    });
  }
  return found;
}

/** The marker counts only on a command that exited 0. */
export function lineCarries(trace: string[], marker: string): boolean {
  return trace.some(line => line.includes(marker) && / exit=0$/.test(line));
}
