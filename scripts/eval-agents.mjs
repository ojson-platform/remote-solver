import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
import {mkdirSync, mkdtempSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const cache = path.join(root, 'node_modules', '.cache');
mkdirSync(cache, {recursive: true});
const outdir = mkdtempSync(path.join(cache, 'eval-agents-'));
const outfile = path.join(outdir, 'run.mjs');

await build({
  absWorkingDir: root,
  entryPoints: ['src/eval/run.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile,
  packages: 'external',
});

const child = spawnSync(process.execPath, [outfile, ...process.argv.slice(2)], {
  cwd: root,
  stdio: 'inherit',
});
process.exit(child.status ?? 1);
