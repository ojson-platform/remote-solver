import type {FileSource, Link, Vcs} from '../machine/port.ts';

import {execFile, execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {promisify} from 'node:util';

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
  const skills = links.find(link => link.to === 'skills');
  const verb = skills ? path.join(skills.from, 'sdd-flow', 'scripts', 'sdd.mjs') : '';
  if (verb !== '' && existsSync(verb)) {
    steps.push(
      'if [ ! -e scripts/sdd.mjs ] || [ -L scripts/sdd.mjs ]; then mkdir -p scripts && ln -sfn ../.sandcastle/skills/sdd-flow/scripts/sdd.mjs scripts/sdd.mjs; fi',
    );
    excluded.push('/scripts/sdd.mjs');
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

const run = promisify(execFile);

async function gitAsync(root: string, args: string[], allowFail = false): Promise<string> {
  try {
    const {stdout} = await run('git', args, {cwd: root, encoding: 'utf8'});
    return stdout;
  } catch (error) {
    if (allowFail) {
      return '';
    }
    throw error;
  }
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

function errorText(error: unknown): string {
  if (typeof error !== 'object' || error === null) {
    return '';
  }
  let body = '';
  if ('stderr' in error && typeof error.stderr === 'string') {
    body = error.stderr;
  } else if ('stderr' in error && error.stderr instanceof Uint8Array) {
    body = Buffer.from(error.stderr).toString('utf8');
  }
  const message = error instanceof Error ? error.message : '';
  return `${body}\n${message}`;
}

/** `git show ref:path` failed because that path is not on the ref. */
function absentOnRef(error: unknown): boolean {
  const text = errorText(error);
  if (!text.includes("fatal: path '")) {
    return false;
  }
  return (
    text.includes('does not exist in ') ||
    text.includes('exists on disk, but not in ') ||
    text.includes('exists, but not ') ||
    text.includes('is in the index, but not ') ||
    text.includes('does not exist (neither on disk nor in the index)')
  );
}

function showFile(root: string, ref: string, rel: string): string {
  try {
    return execFileSync('git', ['show', `${ref}:${rel}`], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    if (absentOnRef(error)) {
      return '';
    }
    throw error;
  }
}

/** Files on one ref. A path that is not on that ref is empty. Any other git failure throws. */
function filesOfRef(root: string, ref: string | null): FileSource {
  return {
    exists(rel) {
      return ref !== null && existsOnRef(root, ref, rel);
    },
    read(rel) {
      if (!ref) {
        return '';
      }
      return showFile(root, ref, rel);
    },
    list(rel) {
      if (!ref) {
        return [];
      }
      return git(root, ['ls-tree', '-r', '--name-only', ref, rel])
        .split('\n')
        .filter(line => line.length > 0);
    },
  };
}

/** The issue branch only. A file that exists only in the checkout is not the change. */
export function gitFiles(root: string, key: string, prefix: string): FileSource {
  return filesOfRef(root, issueRef(root, key, prefix));
}

/** The issue branch when it exists. Null when neither `<prefix>/<key>` nor `origin/<prefix>/<key>` is present. */
export function branchFiles(root: string, key: string, prefix: string): FileSource | null {
  const ref = issueRef(root, key, prefix);
  if (ref === null) {
    return null;
  }
  return filesOfRef(root, ref);
}

function existsOnRef(root: string, ref: string, rel: string): boolean {
  try {
    execFileSync('git', ['cat-file', '-e', `${ref}:${rel}`], {cwd: root, stdio: 'ignore'});
    return true;
  } catch {
    return false;
  }
}

async function isAncestor(root: string, commit: string, tip: string): Promise<boolean> {
  try {
    await run('git', ['merge-base', '--is-ancestor', commit, tip], {cwd: root, encoding: 'utf8'});
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
export async function prepareCheckout(
  root: string,
  key: string,
  config: {branchPrefix: string; defaultBranch: string; worktreesDir: string; link: string},
): Promise<string> {
  await ensureIssueBranch(root, key, config);
  const leaf = branchName(key, config.branchPrefix).replaceAll('/', '-');
  const dir = path.join(root, config.worktreesDir, leaf);
  if (!existsSync(dir)) {
    mkdirSync(path.dirname(dir), {recursive: true});
    await run('git', ['worktree', 'add', '-q', dir, branchName(key, config.branchPrefix)], {
      cwd: root,
      encoding: 'utf8',
    });
  }
  ignorePath(root, `/${config.worktreesDir}/`);
  await run('sh', ['-c', config.link], {cwd: dir, encoding: 'utf8'});
  return dir;
}

/** Make `sdd/<key>` exist locally: fetch it, or cut it from `defaultBranch`. Does not check it out. */
export async function ensureIssueBranch(
  root: string,
  key: string,
  config: {branchPrefix: string; defaultBranch: string},
): Promise<void> {
  const branch = branchName(key, config.branchPrefix);
  if ((await gitAsync(root, ['rev-parse', '--verify', '--quiet', branch], true)).trim()) {
    return;
  }
  try {
    await run('git', ['fetch', 'origin', `${branch}:${branch}`], {cwd: root, encoding: 'utf8'});
  } catch {
    await run('git', ['branch', branch, config.defaultBranch], {cwd: root, encoding: 'utf8'});
  }
}

export function gitVcs(root: string, config: GitVcsConfig = {}): Vcs {
  const prefix = config.branchPrefix ?? 'sdd';
  const base = config.defaultBranch ?? 'origin/master';
  return {
    async prepare(key, options) {
      return prepareCheckout(root, key, {
        branchPrefix: prefix,
        defaultBranch: base,
        worktreesDir: options.worktreesDir,
        link: linkCommand(options.links, root),
      });
    },
    async tip(key) {
      const found = (await gitAsync(root, ['rev-parse', '--verify', '--quiet', branchName(key, prefix)], true)).trim();
      if (!found) {
        throw new Error(`no branch ${branchName(key, prefix)}`);
      }
      return found;
    },
    filesAt: key => gitFiles(root, key, prefix),
    async compare(base, head) {
      try {
        const commits = await gitAsync(root, ['log', '--oneline', `${base}..${head}`]);
        const diff = await gitAsync(root, ['diff', `${base}...${head}`]);
        return {commits, diff};
      } catch {
        return null;
      }
    },
    async head() {
      return (await gitAsync(root, ['rev-parse', 'HEAD'])).trim();
    },
    async push(key) {
      await run('git', ['push', '-u', 'origin', branchName(key, prefix)], {
        cwd: root,
        encoding: 'utf8',
      });
    },
    async published(key, commit) {
      const tip = (await gitAsync(root, ['ls-remote', 'origin', `refs/heads/${branchName(key, prefix)}`]))
        .trim()
        .split(/\s+/)[0];
      if (!tip) {
        return false;
      }
      return tip === commit || (await isAncestor(root, commit, tip));
    },
    async dirty() {
      const entries = (await gitAsync(root, ['status', '--porcelain', '-z'])).split('\0');
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
