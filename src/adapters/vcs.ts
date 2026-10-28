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

function exitStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  if ('status' in error && typeof error.status === 'number') {
    return error.status;
  }
  if ('code' in error && typeof error.code === 'number') {
    return error.code;
  }
  return undefined;
}

/** `root` or a parent holds `.git`. No such directory means the issue branch is absent. */
function inRepository(root: string): boolean {
  let current = path.resolve(root);
  while (path.dirname(current) !== current) {
    if (existsSync(path.join(current, '.git'))) {
      return true;
    }
    current = path.dirname(current);
  }
  return existsSync(path.join(current, '.git'));
}

/**
 * The issue ref for the deferred spine read.
 * Exit 1 is a missing ref. Any other failure throws.
 * A directory outside every repository is an absent branch.
 */
function strictIssueRef(root: string, key: string, prefix: string): string | null {
  if (!inRepository(root)) {
    return null;
  }
  for (const ref of [branchName(key, prefix), `origin/${branchName(key, prefix)}`]) {
    try {
      const found = git(root, ['rev-parse', '--verify', '--quiet', ref]).trim();
      if (found !== '') {
        return ref;
      }
    } catch (error) {
      if (exitStatus(error) !== 1) {
        throw error;
      }
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

function showFile(root: string, ref: string, rel: string, strict: boolean): string {
  try {
    return execFileSync('git', ['show', `${ref}:${rel}`], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    if (!strict || absentOnRef(error)) {
      return '';
    }
    throw error;
  }
}

const TREE_ROOTS = ['openspec/changes', 'openspec/specs'];

type RefTree = {files: Map<string, string>; dirs: Set<string>};

function slash(rel: string): string {
  return rel.split('\\').join('/');
}

function covered(rel: string): boolean {
  const name = slash(rel);
  return TREE_ROOTS.some(root => name === root || name.startsWith(`${root}/`));
}

function emptyTree(): RefTree {
  return {files: new Map(), dirs: new Set()};
}

/** One `ls-tree` and one `cat-file --batch` for the change and spec trees. */
function readTree(root: string, ref: string, strict: boolean): RefTree {
  const listed = git(
    root,
    ['ls-tree', '-r', '-t', '--name-only', ref, '--', ...TREE_ROOTS],
    !strict,
  );
  const names = listed.split('\n').filter(line => line.length > 0);
  if (names.length === 0) {
    return emptyTree();
  }
  const input = Buffer.from(`${names.map(name => `${ref}:${name}`).join('\n')}\n`);
  let buf: Buffer;
  try {
    buf = execFileSync('git', ['cat-file', '--batch'], {
      cwd: root,
      input,
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    }) as Buffer;
  } catch (error) {
    if (!strict) {
      return emptyTree();
    }
    throw error;
  }
  const files = new Map<string, string>();
  const dirs = new Set<string>();
  let offset = 0;
  let index = 0;
  while (index < names.length && offset < buf.length) {
    const nl = buf.indexOf(0x0a, offset);
    if (nl < 0) {
      break;
    }
    const header = buf.toString('utf8', offset, nl);
    offset = nl + 1;
    const name = names[index];
    index += 1;
    if (header.endsWith(' missing') || !name) {
      continue;
    }
    const blob = / blob (\d+)$/.exec(header);
    const tree = / tree (\d+)$/.exec(header);
    const size = Number((blob ?? tree)?.[1]);
    if (!Number.isFinite(size)) {
      break;
    }
    if (blob) {
      files.set(name, buf.toString('utf8', offset, offset + size));
    } else if (tree) {
      dirs.add(name);
    }
    offset += size + 1;
  }
  if (strict && index !== names.length) {
    throw new Error(`git cat-file --batch stopped at ${index} of ${names.length}`);
  }
  return {files, dirs};
}

function treeHas(tree: RefTree, rel: string): boolean {
  const name = slash(rel);
  if (tree.files.has(name) || tree.dirs.has(name)) {
    return true;
  }
  const prefix = name.endsWith('/') ? name : `${name}/`;
  for (const file of tree.files.keys()) {
    if (file.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

/**
 * Files on one ref.
 * `openspec/changes` and `openspec/specs` are read once per source.
 * Lenient: a git failure is an empty file or an empty list.
 * Strict: a missing path on that ref is empty. Any other git failure throws.
 */
function filesOfRef(root: string, ref: string | null, strict: boolean): FileSource {
  let cached: RefTree | undefined;
  const tree = (): RefTree => {
    if (cached) {
      return cached;
    }
    cached = ref ? readTree(root, ref, strict) : emptyTree();
    return cached;
  };
  return {
    exists(rel) {
      if (!ref) {
        return false;
      }
      if (covered(rel)) {
        return treeHas(tree(), rel);
      }
      return existsOnRef(root, ref, rel);
    },
    read(rel) {
      if (!ref) {
        return '';
      }
      if (covered(rel)) {
        return tree().files.get(slash(rel)) ?? '';
      }
      return showFile(root, ref, rel, strict);
    },
    list(rel) {
      if (!ref) {
        return [];
      }
      const prefix = slash(rel);
      if (covered(prefix)) {
        const loaded = tree();
        if (loaded.files.has(prefix)) {
          return [prefix];
        }
        const start = prefix.endsWith('/') ? prefix : `${prefix}/`;
        const out: string[] = [];
        for (const name of loaded.files.keys()) {
          if (name.startsWith(start)) {
            out.push(name);
          }
        }
        return out;
      }
      return git(root, ['ls-tree', '-r', '--name-only', ref, rel], !strict)
        .split('\n')
        .filter(line => line.length > 0);
    },
  };
}

function filesOnBranch(
  root: string,
  key: string,
  prefix: string,
  strict: boolean,
): FileSource | null {
  const ref = strict ? strictIssueRef(root, key, prefix) : issueRef(root, key, prefix);
  if (ref === null) {
    return null;
  }
  return filesOfRef(root, ref, strict);
}

/** The issue branch only. A file that exists only in the checkout is not the change. A git failure is empty. */
export function gitFiles(root: string, key: string, prefix: string): FileSource {
  return filesOfRef(root, issueRef(root, key, prefix), false);
}

/** The issue branch when it exists. Null when neither `<prefix>/<key>` nor `origin/<prefix>/<key>` is present. A git failure is empty. */
export function branchFiles(root: string, key: string, prefix: string): FileSource | null {
  return filesOnBranch(root, key, prefix, false);
}

/**
 * The issue branch for the deferred spine read.
 * Null when the checkout is not a repository, or the ref is missing (exit 1).
 * A missing path on the branch is empty. Any other git failure throws.
 */
export function strictBranchFiles(root: string, key: string, prefix: string): FileSource | null {
  return filesOnBranch(root, key, prefix, true);
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
    async changed(base, head) {
      try {
        await gitAsync(root, ['diff', '--quiet', `${base}...${head}`]);
        return false;
      } catch (error) {
        return exitStatus(error) === 1;
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
