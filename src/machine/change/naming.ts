import path from 'node:path';

/** Every path and branch the machine derives from an issue key. Adapters use these too. */
export function changeDir(key: string): string {
  return path.join('openspec', 'changes', `issue-${key}`);
}

export function archiveDir(key: string): string {
  return path.join('openspec', 'changes', 'archive', `issue-${key}`);
}

function slash(file: string): string {
  return file.split('\\').join('/');
}

/** A change-file path as it stands on an archive tip. Other paths stay. */
export function archiveChangePath(key: string, file: string): string {
  const name = slash(file);
  const active = slash(changeDir(key));
  const archived = slash(archiveDir(key));
  if (name === active || name.startsWith(`${active}/`)) {
    return `${archived}${name.slice(active.length)}`;
  }
  return name;
}

/** A change-file path as it stood before the archive move. Other paths stay. */
export function activeChangePath(key: string, file: string): string {
  const name = slash(file);
  const active = slash(changeDir(key));
  const archived = slash(archiveDir(key));
  if (name === archived || name.startsWith(`${archived}/`)) {
    return `${active}${name.slice(archived.length)}`;
  }
  return name;
}

export function branchName(key: string, prefix = 'sdd'): string {
  return `${prefix}/${key}`;
}

/** Pull request titles start with this. The review adapter links a pull by it. */
export function pullTitlePrefix(key: string): string {
  return `#${key}:`;
}
