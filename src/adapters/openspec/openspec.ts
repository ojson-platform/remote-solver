import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/** Same `openspec` binary as direct `openspec validate` (ADR 0015). */
export function openspecExecutable(): string {
  const bin = path.join(packageRoot, 'node_modules', '.bin', 'openspec');
  if (existsSync(bin)) {
    return bin;
  }
  return execFileSync('which', ['openspec'], {encoding: 'utf8'}).trim();
}
