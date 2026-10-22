import {execFileSync} from 'node:child_process';

/** The published coverage package reads `<checkout>/.git` as a directory. A worktree's `.git` is a file, so name the remote default branch before the reporter looks. */
export default function setup(): void {
  if (process.env.GITHUB_BASE_REF?.trim()) {
    return;
  }
  try {
    const name = execFileSync('git', ['rev-parse', '--abbrev-ref', 'origin/HEAD'], {
      encoding: 'utf8',
    }).trim();
    const match = name.match(/^origin\/(.+)$/);
    if (match) {
      process.env.GITHUB_BASE_REF = match[1];
    }
  } catch {
    // No remote default. The package then skips the change diff.
  }
}
