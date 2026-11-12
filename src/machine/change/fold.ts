import {execFileSync} from 'node:child_process';
import {existsSync, readdirSync, readFileSync, renameSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const DATED_ARCHIVE_DIR = /^\d{4}-\d{2}-\d{2}-issue-\d+$/;
const PLACEHOLDER_PURPOSE = /TBD - created by archiving change/;

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

/** The specs a strict validate refused, and the rule it named. Raw text stays when it names neither. */
export function commandRefusal(text: string): string {
  const ids: string[] = [];
  const rules: string[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const id = /^[✗×]\s+((?:spec|change)\/\S+)/u.exec(line)?.[1];
    if (id !== undefined && !ids.includes(id)) {
      ids.push(id);
    }
    const rule = /\[(?:WARNING|ERROR)\]\s+[^:]+:\s+(.+)/.exec(line)?.[1]?.trim();
    if (rule !== undefined && !rules.includes(rule)) {
      rules.push(rule);
    }
  }
  if (ids.length === 0) {
    const trimmed = text.trim();
    return trimmed === '' ? 'openspec validate --all --strict refused' : trimmed;
  }
  return `openspec validate --all --strict refused ${ids.join(', ')}: ${rules[0] ?? 'strict validation failed'}`;
}

/** True when `file` differs between `base` and `head`. An empty head is not a pull request diff. */
export function changedInDiff(root: string, base: string, head: string, file: string): boolean {
  if (head === '') {
    return false;
  }
  const from = base === '' ? 'HEAD^' : base;
  try {
    return git(root, ['diff', '--name-only', `${from}...${head}`, '--', file]).trim() !== '';
  } catch {
    return false;
  }
}

/** The first added line of `file` in `base...head`. Null when that file is not in the diff. */
export function addedDiffLine(root: string, base: string, head: string, file: string): number | null {
  const from = base === '' ? 'HEAD^' : base;
  const to = head === '' ? 'HEAD' : head;
  let text = '';
  try {
    text = git(root, ['diff', '-U0', `${from}...${to}`, '--', file]);
  } catch {
    return null;
  }
  let line = 0;
  for (const raw of text.split('\n')) {
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (hunk?.[1]) {
      line = Number(hunk[1]);
      continue;
    }
    if (
      raw.startsWith('diff ') ||
      raw.startsWith('index ') ||
      raw.startsWith('---') ||
      raw.startsWith('+++')
    ) {
      continue;
    }
    if (raw.startsWith('+')) {
      return line;
    }
    if (raw.startsWith('-') || raw.startsWith('\\')) {
      continue;
    }
    line += 1;
  }
  return null;
}

/** Drop the fold. The tip from before the archive stays, and the delta is back in the change. */
function restoreCheckout(root: string): void {
  try {
    git(root, ['reset', '--hard', 'HEAD']);
    git(root, ['clean', '-fd', '--', 'openspec']);
  } catch {
    // A checkout that is not a git tree still reports the refusal.
  }
}

/** Fold the change the way `accept.md` describes, as one commit. */
export function foldChange(root: string, key: string, executable: string): void {
  try {
    foldCommitted(root, key, executable);
  } catch (error) {
    restoreCheckout(root);
    throw error;
  }
}

function foldCommitted(root: string, key: string, executable: string): void {
  let output = '';
  try {
    output = execFileSync(executable, ['archive', `issue-${key}`, '--yes'], {
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
  try {
    execFileSync(executable, ['validate', '--all', '--strict', '--no-interactive'], {
      cwd: root,
      encoding: 'utf8',
    });
  } catch (error) {
    const failed = error as {stdout?: string; stderr?: string};
    throw new Error(commandRefusal(`${failed.stdout ?? ''}\n${failed.stderr ?? ''}`));
  }
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
