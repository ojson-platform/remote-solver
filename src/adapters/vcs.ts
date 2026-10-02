import type {FileSource, Link, Vcs} from '../machine/port.ts';

import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';

import {branchName} from '../machine/naming.ts';

export type GitVcsConfig = {
  branchPrefix?: string;
  defaultBranch?: string;
};

function shQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

/** Shell that links package files into `.sandcastle/` and the service `node_modules` into the checkout. */
export function linkCommand(links: Link[], serviceRoot: string): string {
  const steps = ['mkdir -p .sandcastle'];
  const excluded = ['/.sandcastle/'];
  for (const link of links) {
    steps.push(`ln -sfn ${shQuote(link.from)} .sandcastle/${link.to}`);
  }
  const modules = path.join(serviceRoot, 'node_modules');
  if (existsSync(modules)) {
    steps.push(`ln -sfn ${shQuote(modules)} node_modules`);
    excluded.push('/node_modules');
  }
  steps.push('exclude="$(git rev-parse --git-path info/exclude)"', 'mkdir -p "$(dirname "$exclude")"');
  for (const rule of excluded) {
    steps.push(`{ grep -qxF ${shQuote(rule)} "$exclude" 2>/dev/null || echo ${shQuote(rule)} >> "$exclude"; }`);
  }
  return steps.join(' && ');
}

/** `skills`, `prompts`, and `.env` from this package, when they exist. */
export function packageLinks(solverRoot: string): Link[] {
  return (['skills', 'prompts', '.env'] as const)
    .filter(name => existsSync(path.join(solverRoot, name)))
    .map(name => ({from: path.join(solverRoot, name), to: name}));
}

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

/** The issue branch only. A file that exists only in the checkout is not the change. */
export function gitFiles(root: string, key: string, prefix: string): FileSource {
  const ref = issueRef(root, key, prefix);
  return {
    exists(rel) {
      return ref !== null && existsOnRef(root, ref, rel);
    },
    read(rel) {
      if (!ref) {
        return '';
      }
      return git(root, ['show', `${ref}:${rel}`], true);
    },
    list(rel) {
      if (!ref) {
        return [];
      }
      return git(root, ['ls-tree', '-r', '--name-only', ref, rel], true)
        .split('\n')
        .filter(line => line.length > 0);
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

function isAncestor(root: string, commit: string, tip: string): boolean {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', commit, tip], {cwd: root, stdio: 'ignore'});
    return true;
  } catch {
    return false;
  }
}

function ignorePath(root: string, rule: string): void {
  const rel = git(root, ['rev-parse', '--git-path', 'info/exclude']).trim();
  const file = path.resolve(root, rel);
  mkdirSync(path.dirname(file), {recursive: true});
  const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  if (text.split('\n').includes(rule)) {
    return;
  }
  const body = text.length === 0 || text.endsWith('\n') ? text : `${text}\n`;
  writeFileSync(file, `${body}${rule}\n`);
}

/**
 * Check out `sdd/<key>` under `worktreesDir`, creating the worktree when it is
 * missing and reusing it when it exists. Runs `link` inside the checkout.
 * Does not fast-forward a dirty tree.
 */
export function prepareCheckout(
  root: string,
  key: string,
  config: {branchPrefix: string; defaultBranch: string; worktreesDir: string; link: string},
): string {
  ensureIssueBranch(root, key, config);
  const leaf = branchName(key, config.branchPrefix).replaceAll('/', '-');
  const dir = path.join(root, config.worktreesDir, leaf);
  if (!existsSync(dir)) {
    mkdirSync(path.dirname(dir), {recursive: true});
    execFileSync('git', ['worktree', 'add', '-q', dir, branchName(key, config.branchPrefix)], {
      cwd: root,
      stdio: 'ignore',
    });
  }
  ignorePath(root, `/${config.worktreesDir}/`);
  execFileSync('sh', ['-c', config.link], {cwd: dir, stdio: 'ignore'});
  return dir;
}

/** Make `sdd/<key>` exist locally: fetch it, or cut it from `defaultBranch`. Does not check it out. */
export function ensureIssueBranch(
  root: string,
  key: string,
  config: {branchPrefix: string; defaultBranch: string},
): void {
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
  const base = config.defaultBranch ?? 'origin/master';
  return {
    prepare(key, options) {
      return prepareCheckout(root, key, {
        branchPrefix: prefix,
        defaultBranch: base,
        worktreesDir: options.worktreesDir,
        link: linkCommand(options.links, root),
      });
    },
    tip(key) {
      const found = git(root, ['rev-parse', '--verify', '--quiet', branchName(key, prefix)], true).trim();
      if (!found) {
        throw new Error(`no branch ${branchName(key, prefix)}`);
      }
      return found;
    },
    filesAt: key => gitFiles(root, key, prefix),
    compare(base, head) {
      try {
        const commits = git(root, ['log', '--oneline', `${base}..${head}`]);
        const diff = git(root, ['diff', `${base}...${head}`]);
        return {commits, diff};
      } catch {
        return null;
      }
    },
    head() {
      return execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
    },
    push(key) {
      execFileSync('git', ['push', '-u', 'origin', branchName(key, prefix)], {
        cwd: root,
        stdio: 'inherit',
      });
    },
    published(key, commit) {
      const tip = git(root, ['ls-remote', 'origin', `refs/heads/${branchName(key, prefix)}`])
        .trim()
        .split(/\s+/)[0];
      if (!tip) {
        return false;
      }
      return tip === commit || isAncestor(root, commit, tip);
    },
    dirty() {
      const entries = git(root, ['status', '--porcelain', '-z']).split('\0');
      const paths: string[] = [];
      for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index];
        if (!entry) {
          continue;
        }
        paths.push(entry.slice(3));
        if (entry[0] === 'R' || entry[0] === 'C') {
          index += 1;
        }
      }
      return paths;
    },
  };
}
