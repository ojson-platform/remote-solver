import {execFileSync, spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function installedOpenspecBin(): string | undefined {
  const bin = path.join(packageRoot, 'node_modules', '.bin', 'openspec');
  return existsSync(bin) ? bin : undefined;
}

/** Same `openspec` binary as direct `openspec validate` (ADR 0015). */
export function openspecExecutable(): string {
  const local = installedOpenspecBin();
  if (local) {
    return local;
  }
  return execFileSync('which', ['openspec'], {encoding: 'utf8'}).trim();
}

export function runOpenspec(
  cwd: string,
  args: string[],
): {status: number | null; stdout: string; stderr: string} {
  const result = spawnSync(openspecExecutable(), args, {cwd, encoding: 'utf8', env: process.env});
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

export function archiveIssue(cwd: string, issueKey: string): void {
  const change = issueKey.startsWith('issue-') ? issueKey : `issue-${issueKey}`;
  const result = runOpenspec(cwd, ['archive', change, '--yes']);
  if (result.status !== 0) {
    throw new Error(
      `openspec archive ${change} failed (${result.status}): ${result.stderr || result.stdout}`,
    );
  }
}
