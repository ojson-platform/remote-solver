import {existsSync} from 'node:fs';
import path from 'node:path';

const ARCADIA = 'ai/artifacts/skills/teams/lavka/sdd/sdd-flow/scripts/adapters/index.mjs';

export function adapterFile(scriptPath: string, root: string): string | undefined {
  const beside = path.join(path.dirname(scriptPath), 'adapters', 'index.mjs');
  if (existsSync(beside)) {
    return beside;
  }
  let dir = path.resolve(root);
  for (;;) {
    const candidate = path.join(dir, ARCADIA);
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return undefined;
    }
    dir = parent;
  }
}
