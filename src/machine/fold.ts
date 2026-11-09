import {execFileSync} from 'node:child_process';
import {existsSync, readdirSync, readFileSync, renameSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const DATED_ARCHIVE_DIR = /^\d{4}-\d{2}-\d{2}-issue-\d+$/;
const PLACEHOLDER_PURPOSE = /TBD - created by archiving change/;

function packageRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '../..');
}

function openspecBin(): string {
  return path.join(packageRoot(), 'node_modules', '.bin', 'openspec');
}

function git(root: string, args: string[]): string {
  return execFileSync('git', args, {cwd: root, encoding: 'utf8'});
}

function findDatedArchiveDir(root: string, key: string): string | undefined {
  const archiveRoot = path.join(root, 'openspec', 'changes', 'archive');
  if (!existsSync(archiveRoot)) {
    return undefined;
  }
  return readdirSync(archiveRoot).find(
    name => DATED_ARCHIVE_DIR.test(name) && name.endsWith(`issue-${key}`),
  );
}

function purposeLine(specText: string): string {
  const match = specText.match(/(?:^|\n)## Purpose\r?\n(?:\r?\n)?(.+?)(?:\r?\n## |\s*$)/s);
  return match?.[1]?.trim() ?? '';
}

function replacePurpose(specText: string, purpose: string): string {
  return specText.replace(
    /(?:^|\n)## Purpose\r?\n(?:\r?\n)?.+?(?=\r?\n## Requirements)/s,
    `\n## Purpose\n\n${purpose}`,
  );
}

function applyPurpose(root: string, key: string): void {
  const proposalPath = path.join(
    root,
    'openspec',
    'changes',
    'archive',
    `issue-${key}`,
    'proposal.md',
  );
  if (!existsSync(proposalPath)) {
    return;
  }
  const gists = new Map<string, string>();
  for (const match of readFileSync(proposalPath, 'utf8').matchAll(/^- `([^`]+)` (.+)$/gm)) {
    gists.set(match[1], match[2].trim());
  }
  for (const [capability, gist] of gists) {
    const specPath = path.join(root, 'openspec', 'specs', capability, 'spec.md');
    if (!existsSync(specPath)) {
      continue;
    }
    const specText = readFileSync(specPath, 'utf8');
    if (!PLACEHOLDER_PURPOSE.test(purposeLine(specText))) {
      continue;
    }
    writeFileSync(specPath, replacePurpose(specText, gist));
  }
}

/** Fold the change the way `accept.md` describes, as one commit. */
export function foldChange(root: string, key: string): void {
  let output = '';
  try {
    output = execFileSync(openspecBin(), ['archive', `issue-${key}`, '--yes'], {
      cwd: root,
      encoding: 'utf8',
    });
  } catch (error) {
    const failed = error as {stdout?: string; stderr?: string; status?: number};
    const text = `${failed.stdout ?? ''}${failed.stderr ?? ''}`;
    throw new Error(text.trim() || `openspec archive exited ${failed.status ?? 1}`);
  }
  if (output.includes('Aborted. No files were changed.')) {
    throw new Error(output.trim());
  }
  const dated = findDatedArchiveDir(root, key);
  if (!dated) {
    throw new Error('openspec archive did not write a dated archive directory');
  }
  const archiveRoot = path.join(root, 'openspec', 'changes', 'archive');
  renameSync(path.join(archiveRoot, dated), path.join(archiveRoot, `issue-${key}`));
  applyPurpose(root, key);
  execFileSync(openspecBin(), ['validate', '--all', '--strict', '--no-interactive'], {
    cwd: root,
    stdio: 'ignore',
  });
  git(root, ['add', '-A']);
  git(root, ['commit', '-m', 'archive fold', '-m', `Sdd-Archive: issue-${key}`]);
}

/** Revert the archive commit. The new tip names the issue and is not an archive. */
export function restoreChange(root: string, key: string): void {
  const message = git(root, ['log', '-1', '--format=%B']);
  const mark = `Sdd-Archive: issue-${key}`;
  if (!message.split('\n').some(line => line.trimEnd() === mark)) {
    throw new Error(`tip is not the archive commit for issue ${key}`);
  }
  git(root, ['revert', '--no-commit', 'HEAD']);
  git(root, ['commit', '-m', `#${key}`]);
}
