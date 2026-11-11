import {execFileSync} from 'node:child_process';

export type ProcessRow = {pid: number; ppid: number};

export function parseProcessTable(text: string): ProcessRow[] {
  const rows: ProcessRow[] = [];
  for (const line of text.split('\n')) {
    const match = /^\s*(\d+)\s+(\d+)\s*$/.exec(line);
    if (match) {
      rows.push({pid: Number(match[1]), ppid: Number(match[2])});
    }
  }
  return rows;
}

export function readProcessTable(): ProcessRow[] {
  return parseProcessTable(execFileSync('ps', ['-ax', '-o', 'pid=,ppid='], {encoding: 'utf8'}));
}

function descendants(root: number, rows: ProcessRow[]): Set<number> {
  const children = new Map<number, number[]>();
  for (const row of rows) {
    const list = children.get(row.ppid);
    if (list) {
      list.push(row.pid);
    } else {
      children.set(row.ppid, [row.pid]);
    }
  }
  const found = new Set<number>();
  const stack = [...(children.get(root) ?? [])];
  while (stack.length > 0) {
    const pid = stack.pop();
    if (pid === undefined || pid === root || found.has(pid)) {
      continue;
    }
    found.add(pid);
    const next = children.get(pid);
    if (next) {
      stack.push(...next);
    }
  }
  return found;
}

/** Remembered processes that are still alive and have left the run's tree. */
export function orphans(root: number, rows: ProcessRow[], seen: Set<number>): number[] {
  const alive = new Set(rows.map(row => row.pid));
  const current = descendants(root, rows);
  for (const pid of current) {
    seen.add(pid);
  }
  const kill: number[] = [];
  for (const pid of [...seen]) {
    if (!alive.has(pid)) {
      seen.delete(pid);
      continue;
    }
    if (!current.has(pid)) {
      kill.push(pid);
    }
  }
  return kill;
}
