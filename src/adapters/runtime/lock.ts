import {closeSync, mkdirSync, openSync, readFileSync, unlinkSync, writeSync} from 'node:fs';
import path from 'node:path';

export type IssueHold = {release(): void};

/** One holder per issue, across processes. A dead pid does not keep the issue. */
export function tryHoldIssue(root: string, key: string): IssueHold | undefined {
  const file = lockFile(root, key);
  mkdirSync(path.dirname(file), {recursive: true});
  const taken = claim(file) ?? claimAfterStale(file);
  if (!taken) {
    return undefined;
  }
  return {
    release() {
      closeSync(taken);
      try {
        if (readFileSync(file, 'utf8').trim() === String(process.pid)) {
          unlinkSync(file);
        }
      } catch {
        // The next holder already replaced the file.
      }
    },
  };
}

function lockFile(root: string, key: string): string {
  const name = key.replace(/[^A-Za-z0-9._-]/g, '-');
  return path.join(root, '.sandcastle', 'locks', name);
}

function claim(file: string): number | undefined {
  try {
    const fd = openSync(file, 'wx');
    writeSync(fd, `${process.pid}\n`);
    return fd;
  } catch (error) {
    if (isAlreadyHeld(error)) {
      return undefined;
    }
    throw error;
  }
}

function claimAfterStale(file: string): number | undefined {
  let pid = 0;
  try {
    pid = Number(readFileSync(file, 'utf8').trim());
  } catch {
    return claim(file);
  }
  if (pid > 0 && alive(pid)) {
    return undefined;
  }
  try {
    unlinkSync(file);
  } catch {
    // Another process took the stale file.
  }
  return claim(file);
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function isAlreadyHeld(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST';
}
