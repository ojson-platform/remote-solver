import {spawn} from 'node:child_process';
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import path from 'node:path';

import {matchesTestPath, testPathGlobs, tracesSpecCoverage} from '../change/required.ts';
import type {Tree} from '../port.ts';

/** Scenario titles a test file names with `scenario('...')`. */
export function scenarioTitles(text: string): string[] {
  return [...text.matchAll(/scenario\(\s*['"]([^'"]+)['"]/g)].flatMap(match => (match[1] ? [match[1]] : []));
}

function walk(dir: string, name: string, found: string[]): void {
  if (!existsSync(dir)) {
    return;
  }
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'archive') {
        continue;
      }
      walk(full, name, found);
      continue;
    }
    if (entry.name === name) {
      found.push(full);
    }
  }
}

function readDesigns(root: string): string {
  const found: string[] = [];
  walk(path.join(root, 'openspec', 'changes'), 'design.md', found);
  return found.map(file => readFileSync(file, 'utf8')).join('\n');
}

function oneFileCommand(design: string): string {
  const command = /^one-file:\s*`(.+)`\s*$/m.exec(design)?.[1];
  if (!command) {
    throw new Error('the verification boundary names no one-file command');
  }
  return command;
}

function specTitles(root: string, top: string, keep: (file: string) => boolean): Set<string> {
  const found: string[] = [];
  walk(path.join(root, top), 'spec.md', found);
  const titles = new Set<string>();
  for (const file of found) {
    const rel = path.relative(root, file).split(path.sep).join('/');
    if (!keep(rel)) {
      continue;
    }
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/^#### Scenario:\s*(.+?)\s*$/gm)) {
      if (match[1]) {
        titles.add(match[1]);
      }
    }
  }
  return titles;
}

function proofTitles(root: string, tests: readonly string[]): string[] {
  const allowed = new Set([
    ...specTitles(
      root,
      'openspec/changes',
      file => file.endsWith('/spec.md') && file.includes('/specs/') && !file.includes('/archive/'),
    ),
    ...specTitles(root, 'openspec/specs', file => file.endsWith('/spec.md') && file.startsWith('openspec/specs/')),
  ]);
  const named = new Set<string>();
  for (const file of tests) {
    for (const title of scenarioTitles(readFileSync(path.join(root, file), 'utf8'))) {
      if (allowed.has(title)) {
        named.add(title);
      }
    }
  }
  return [...named].sort();
}

function runBoundary(root: string, files: string[], titles: readonly string[]): Promise<number> {
  const command = oneFileCommand(readDesigns(root));
  const titleArg = titles.map(title => title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return new Promise((resolve, reject) => {
    let status = 0;
    const next = (index: number) => {
      if (index >= files.length || status !== 0) {
        resolve(status);
        return;
      }
      const line = command.replaceAll('<test-file>', files[index] ?? '').replaceAll('<titles>', titleArg);
      const child = spawn('sh', ['-c', line], {cwd: root, stdio: 'inherit'});
      child.on('error', reject);
      child.on('close', code => {
        status = code ?? 1;
        next(index + 1);
      });
    };
    next(0);
  });
}

/**
 * Refuses unless a check the HEAD commit changes fails against that commit's
 * first parent and passes on HEAD. A spec-coverage trace counts only a
 * `scenario` the delta or a stable spec names. Restores the worktree either way.
 */
export async function proveCodeFix(
  root: string,
  tree: Tree,
  run: (root: string, files: string[], titles: readonly string[]) => Promise<number> = runBoundary,
): Promise<void> {
  if (tree.dirty()) {
    throw new Error('the worktree is dirty: Publish, then thread fix.');
  }
  if (!tree.hasParent()) {
    throw new Error('the answering commit has no parent: the new test cannot fail on one.');
  }
  const design = readDesigns(root);
  oneFileCommand(design);
  const changes = tree.headChanges();
  const globs = testPathGlobs(design);
  const tests = changes
    .filter(change => change.kind !== 'deleted' && matchesTestPath(change.path, globs))
    .map(change => change.path);
  if (tests.length === 0) {
    throw new Error(
      'the answering commit changes no test. Add a test that fails on the parent, or hand the thread off to spec.',
    );
  }
  const titles = tracesSpecCoverage(design) ? proofTitles(root, tests) : [];
  if (tracesSpecCoverage(design) && titles.length === 0) {
    throw new Error(
      "the answering test's scenario is not in the delta or a stable spec. Hand the thread off to spec.",
    );
  }
  const sources = changes.filter(change => !tests.includes(change.path));
  tree.toParent(sources);
  let parentStatus: number;
  try {
    parentStatus = await run(root, tests, titles);
  } finally {
    tree.restoreHead(sources);
  }
  if (parentStatus === 0) {
    throw new Error(
      'a test the answering commit changes passes on the parent. It does not show the remark. Add a test that fails on the parent, or hand the thread off to spec.',
    );
  }
  if ((await run(root, tests, titles)) !== 0) {
    throw new Error('a test the answering commit changes fails on HEAD.');
  }
}
