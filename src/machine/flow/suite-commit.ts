import {mkdirSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';

function markPath(root: string, key: string): string {
  const name = key.replace(/[^A-Za-z0-9._-]/g, '-');
  return path.join(root, '.sandcastle', 'suite-commits', name);
}

/** The next publish of this repair follows a commit, so it stays on implementing. */
export function rememberRepairCommit(root: string, key: string): void {
  const file = markPath(root, key);
  mkdirSync(path.dirname(file), {recursive: true});
  writeFileSync(file, key);
}

/** True when a repair commit is waiting. The mark is spent either way. */
export function takeRepairCommit(root: string, key: string): boolean {
  try {
    rmSync(markPath(root, key));
    return true;
  } catch {
    return false;
  }
}
