import {existsSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';

function markPath(root: string, key: string, kind: 'suite-commits' | 'suite-due'): string {
  const name = key.replace(/[^A-Za-z0-9._-]/g, '-');
  return path.join(root, '.sandcastle', kind, name);
}

/** The next publish of this repair follows a commit, so it stays on implementing. */
export function rememberRepairCommit(root: string, key: string): void {
  writeMark(markPath(root, key, 'suite-commits'), key);
}

/** True when a repair commit is waiting. Does not spend the mark. */
export function repairCommitWaiting(root: string, key: string): boolean {
  return existsSync(markPath(root, key, 'suite-commits'));
}

/** True when a repair commit is waiting. The mark is spent either way. */
export function takeRepairCommit(root: string, key: string): boolean {
  return dropMark(markPath(root, key, 'suite-commits'));
}

/** This step already named the suite. The next clean step can leave it. */
export function rememberSuiteDue(root: string, key: string): void {
  writeMark(markPath(root, key, 'suite-due'), key);
}

/** True when an earlier step already named the suite. */
export function suiteDue(root: string, key: string): boolean {
  return existsSync(markPath(root, key, 'suite-due'));
}

/** The suite was committed or the phase moved, so the next step names it again. */
export function clearSuiteDue(root: string, key: string): void {
  dropMark(markPath(root, key, 'suite-due'));
}

function writeMark(file: string, key: string): void {
  mkdirSync(path.dirname(file), {recursive: true});
  writeFileSync(file, key);
}

function dropMark(file: string): boolean {
  try {
    rmSync(file);
    return true;
  } catch {
    return false;
  }
}
