import type {FileSource} from '../machine/port.ts';

import {existsSync, readdirSync, readFileSync} from 'node:fs';
import path from 'node:path';

import {branchFiles} from '../adapters/vcs.ts';
import {changeDir} from '../machine/naming.ts';

const empty: FileSource = {
  exists: () => false,
  read: () => '',
  list: () => [],
};

function slash(rel: string): string {
  return rel.split(path.sep).join('/');
}

function disk(root: string): FileSource {
  return {
    exists(rel) {
      return existsSync(path.join(root, rel));
    },
    read(rel) {
      try {
        return readFileSync(path.join(root, rel), 'utf8');
      } catch {
        return '';
      }
    },
    list(rel) {
      const out: string[] = [];
      const walk = (dir: string): void => {
        if (!existsSync(dir)) {
          return;
        }
        for (const entry of readdirSync(dir, {withFileTypes: true})) {
          const abs = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(abs);
          } else if (entry.isFile()) {
            out.push(slash(path.relative(root, abs)));
          }
        }
      };
      walk(path.join(root, rel));
      return out.sort();
    },
  };
}

/**
 * Change files for one issue.
 * The issue branch when `sdd/<key>` or `origin/sdd/<key>` exists.
 * The checkout directory when that branch does not.
 * A file that exists only in the checkout is not the change once the branch exists.
 */
export function changeFiles(checkout: string | undefined, key: string): FileSource {
  if (!checkout || checkout.trim() === '' || key.trim() === '') {
    return empty;
  }
  return branchFiles(checkout, key, 'sdd') ?? disk(checkout);
}

export function changeRel(key: string, name: string): string {
  return slash(path.join(changeDir(key), name));
}

export function listedSpecs(files: FileSource, key: string): {id: string; rel: string}[] {
  const dir = slash(path.join(changeDir(key), 'specs'));
  const prefix = `${dir}/`;
  const found: {id: string; rel: string}[] = [];
  for (const raw of files.list(dir)) {
    const rel = slash(raw);
    if (!rel.startsWith(prefix) || !rel.endsWith('/spec.md')) {
      continue;
    }
    const id = rel.slice(prefix.length, -'/spec.md'.length);
    if (id === '' || id === '.') {
      continue;
    }
    found.push({id, rel});
  }
  found.sort((left, right) => left.id.localeCompare(right.id));
  return found;
}
