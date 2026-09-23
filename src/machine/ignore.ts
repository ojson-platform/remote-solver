import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';

/** Commenter logins the machine does not treat as a person. */
export function parseIgnoredAuthors(text: string): RegExp[] {
  const patterns: RegExp[] = [];
  let section: 'root' | 'comments' | 'ignore' = 'root';
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+#.*$/, '');
    if (!line.trim() || line.trim().startsWith('#')) {
      continue;
    }
    if (section === 'root' && line === 'comments:') {
      section = 'comments';
      continue;
    }
    if (section === 'comments' && line === '  ignore:') {
      section = 'ignore';
      continue;
    }
    if (section === 'ignore') {
      const author = /^ {4}- author: (\S+)$/.exec(line);
      if (!author) {
        throw new Error(`sandcastle.yaml: expected an author pattern, saw ${JSON.stringify(line)}`);
      }
      patterns.push(new RegExp(author[1], 'i'));
      continue;
    }
    throw new Error(`sandcastle.yaml: unexpected ${JSON.stringify(line)}`);
  }
  if (section !== 'ignore') {
    throw new Error('sandcastle.yaml: comments.ignore is missing');
  }
  return patterns;
}

export function authorIgnored(login: string, patterns: readonly RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(login));
}

/** `sandcastle.yaml` in the service. A service without the file ignores nobody. */
export function loadIgnoredAuthors(root: string): RegExp[] {
  const file = path.join(root, 'sandcastle.yaml');
  if (!existsSync(file)) {
    return [];
  }
  return parseIgnoredAuthors(readFileSync(file, 'utf8'));
}
