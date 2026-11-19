import {execFileSync} from 'node:child_process';

import type {PathChange, Tree} from '../../machine/port.ts';

type NameEntry = {status: string; path: string; from?: string};

function gitResult(root: string, args: string[]): {status: number; stdout: string} {
  try {
    return {status: 0, stdout: execFileSync('git', args, {cwd: root, encoding: 'utf8'})};
  } catch (error) {
    const failed = error as {status?: number; stdout?: string | Buffer};
    const stdout = failed.stdout;
    return {
      status: failed.status ?? 1,
      stdout: typeof stdout === 'string' ? stdout : stdout?.toString('utf8') ?? '',
    };
  }
}

function gitOk(root: string, args: string[]): string {
  const result = gitResult(root, args);
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed`);
  }
  return result.stdout;
}

function parseNameStatus(raw: string): NameEntry[] {
  const parts = raw.split('\0').filter(part => part.length > 0);
  const entries: NameEntry[] = [];
  let index = 0;
  while (index < parts.length) {
    const status = parts[index] ?? '';
    index += 1;
    if (status.startsWith('R') || status.startsWith('C')) {
      const from = parts[index] ?? '';
      const file = parts[index + 1] ?? '';
      index += 2;
      entries.push({status, from, path: file});
      continue;
    }
    entries.push({status, path: parts[index] ?? ''});
    index += 1;
  }
  return entries;
}

function kindOf(status: string): PathChange['kind'] {
  if (status.startsWith('A')) {
    return 'added';
  }
  if (status.startsWith('D')) {
    return 'deleted';
  }
  if (status.startsWith('R') || status.startsWith('C')) {
    return 'renamed';
  }
  return 'modified';
}

function span(base: string, head: string): {from: string; to: string} {
  return {from: base === '' ? 'HEAD^' : base, to: head === '' ? 'HEAD' : head};
}

/** Git checkout as a Tree. The machine calls this instead of shelling git. */
export function gitTree(root: string): Tree {
  return {
    dirty() {
      return gitOk(root, ['status', '--porcelain']).trim() !== '';
    },
    hasParent() {
      return gitResult(root, ['rev-parse', '--verify', '--quiet', 'HEAD^']).status === 0;
    },
    headChanges() {
      return parseNameStatus(gitOk(root, ['diff', '--name-status', '-z', 'HEAD^', 'HEAD'])).map(entry => ({
        path: entry.path,
        kind: kindOf(entry.status),
        from: entry.from,
      }));
    },
    toParent(changes) {
      for (const change of changes) {
        if (change.kind === 'added') {
          gitOk(root, ['rm', '-f', '--ignore-unmatch', '--', change.path]);
          continue;
        }
        if (change.kind === 'renamed' && change.from) {
          gitOk(root, ['checkout', 'HEAD^', '--', change.from]);
          if (change.path !== change.from) {
            gitOk(root, ['rm', '-f', '--ignore-unmatch', '--', change.path]);
          }
          continue;
        }
        gitOk(root, ['checkout', 'HEAD^', '--', change.path]);
      }
    },
    restoreHead(changes) {
      const paths = new Set<string>();
      for (const change of changes) {
        paths.add(change.path);
        if (change.from) {
          paths.add(change.from);
        }
      }
      for (const file of paths) {
        if (gitResult(root, ['cat-file', '-e', `HEAD:${file}`]).status === 0) {
          gitOk(root, ['checkout', 'HEAD', '--', file]);
        } else {
          gitOk(root, ['rm', '-f', '--ignore-unmatch', '--', file]);
        }
      }
    },
    tracked(prefix) {
      return gitOk(root, ['ls-files', '--', prefix])
        .split('\n')
        .filter(file => file !== '');
    },
    differs(base, head, file) {
      if (head === '') {
        return false;
      }
      const {from, to} = span(base, head);
      try {
        return gitOk(root, ['diff', '--name-only', `${from}...${to}`, '--', file]).trim() !== '';
      } catch {
        return false;
      }
    },
    unified(base, head, file) {
      const {from, to} = span(base, head);
      try {
        return gitOk(root, ['diff', '-U0', `${from}...${to}`, '--', file]);
      } catch {
        return '';
      }
    },
    discard(prefix) {
      gitOk(root, ['reset', '--hard', 'HEAD']);
      gitOk(root, ['clean', '-fd', '--', prefix]);
    },
    commitAll(subject, body) {
      gitOk(root, ['add', '-A']);
      const args = ['commit', '-m', subject];
      if (body !== undefined) {
        args.push('-m', body);
      }
      gitOk(root, args);
    },
    headMessage() {
      return gitOk(root, ['log', '-1', '--format=%B']);
    },
    revertHead(subject) {
      gitOk(root, ['revert', '--no-commit', 'HEAD']);
      gitOk(root, ['commit', '-m', subject]);
    },
  };
}
