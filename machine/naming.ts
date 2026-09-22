import path from 'node:path';

/** Every path and branch the machine derives from an issue key. Adapters use these too. */
export function changeDir(key: string): string {
  return path.join('openspec', 'changes', `issue-${key}`);
}

export function archiveDir(key: string): string {
  return path.join('openspec', 'changes', 'archive', `issue-${key}`);
}

export function branchName(key: string, prefix = 'sdd'): string {
  return `${prefix}/${key}`;
}

/** Pull request titles start with this. The review adapter links a pull by it. */
export function pullTitlePrefix(key: string): string {
  return `#${key}:`;
}
