import path from 'node:path';

/** A resolved path that does not leave `root`. */
export function staysInside(root: string, target: string): boolean {
  const rel = path.relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}
