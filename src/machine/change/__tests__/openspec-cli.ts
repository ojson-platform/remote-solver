import {spawnSync} from 'node:child_process';

import {openspecExecutable} from '../../../adapters/openspec/openspec.ts';

export {openspecExecutable};

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
