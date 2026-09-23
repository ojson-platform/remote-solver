import type {Remark} from './verdict.ts';

/** Right-side lines GitHub will accept a comment on, per file in a unified diff. */
export function commentableLines(diff: string): Map<string, Set<number>> {
  const files = new Map<string, Set<number>>();
  let path: string | null = null;
  let next = 0;
  for (const line of diff.split('\n')) {
    const plus = line.match(/^\+\+\+ b\/(.+)$/);
    if (plus) {
      path = plus[1] === '/dev/null' ? null : plus[1];
      if (path && !files.has(path)) {
        files.set(path, new Set());
      }
      next = 0;
      continue;
    }
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk && path) {
      next = Number(hunk[1]);
      continue;
    }
    if (!path || next === 0) {
      continue;
    }
    if (line.startsWith('-') || line.startsWith('\\')) {
      continue;
    }
    files.get(path)?.add(next);
    next += 1;
  }
  return files;
}

/** Keep a file or a line only when that spot is in the diff. Otherwise the note stays on the pull request. */
export function placeOnDiff(diff: string, remark: Remark): Remark {
  if (!remark.path) {
    return remark;
  }
  const lines = commentableLines(diff).get(remark.path);
  if (!lines) {
    return {body: remark.body};
  }
  if (remark.line && lines.has(remark.line)) {
    return remark;
  }
  return {body: remark.body, path: remark.path};
}
