import {execFileSync} from 'node:child_process';
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import path from 'node:path';

import {branchName} from '../machine/naming.ts';
import type {FileSource, Vcs} from '../machine/port.ts';

export type GitVcsConfig = {
  branchPrefix?: string;
};

function git(root: string, args: string[], allowFail = false): string {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch (error) {
    if (allowFail) {
      return '';
    }
    throw error;
  }
}

function issueRef(root: string, key: string, prefix: string): string | null {
  for (const ref of [branchName(key, prefix), `origin/${branchName(key, prefix)}`]) {
    const found = git(root, ['rev-parse', '--verify', '--quiet', ref], true).trim();
    if (found) {
      return ref;
    }
  }
  return null;
}

function walk(dir: string, root: string, into: Set<string>): void {
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(abs, root, into);
    } else {
      into.add(path.relative(root, abs));
    }
  }
}

export function gitFiles(root: string, key: string, prefix: string): FileSource {
  const ref = issueRef(root, key, prefix);
  return {
    exists(rel) {
      if (existsSync(path.join(root, rel))) {
        return true;
      }
      return ref !== null && existsOnRef(root, ref, rel);
    },
    read(rel) {
      const abs = path.join(root, rel);
      if (existsSync(abs)) {
        return readFileSync(abs, 'utf8');
      }
      if (!ref) {
        return '';
      }
      return git(root, ['show', `${ref}:${rel}`], true);
    },
    list(rel) {
      const found = new Set<string>();
      const abs = path.join(root, rel);
      if (existsSync(abs)) {
        walk(abs, root, found);
      }
      if (ref) {
        for (const line of git(root, ['ls-tree', '-r', '--name-only', ref, rel], true).split('\n')) {
          if (line) {
            found.add(line);
          }
        }
      }
      return [...found];
    },
  };
}

function existsOnRef(root: string, ref: string, rel: string): boolean {
  try {
    execFileSync('git', ['cat-file', '-e', `${ref}:${rel}`], {cwd: root, stdio: 'ignore'});
    return true;
  } catch {
    return false;
  }
}

/** Make `sdd/<key>` exist locally: fetch it, or cut it from `defaultBranch`. Does not check it out. */
export function ensureIssueBranch(root: string, key: string, config: {branchPrefix: string; defaultBranch: string}): void {
  const branch = branchName(key, config.branchPrefix);
  if (git(root, ['rev-parse', '--verify', '--quiet', branch], true).trim()) {
    return;
  }
  try {
    execFileSync('git', ['fetch', 'origin', `${branch}:${branch}`], {cwd: root, stdio: 'ignore'});
  } catch {
    execFileSync('git', ['branch', branch, config.defaultBranch], {cwd: root, stdio: 'inherit'});
  }
}

export function gitVcs(root: string, config: GitVcsConfig = {}): Vcs {
  const prefix = config.branchPrefix ?? 'sdd';
  return {
    filesAt: key => gitFiles(root, key, prefix),
    head() {
      return execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
    },
    push(key) {
      execFileSync('git', ['push', '-u', 'origin', branchName(key, prefix)], {cwd: root, stdio: 'inherit'});
    },
  };
}
