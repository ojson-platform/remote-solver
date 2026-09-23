#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const child = spawnSync(
  process.execPath,
  [
    path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    '--tsconfig',
    path.join(root, 'tsconfig.json'),
    path.join(root, 'src', 'cli.ts'),
    ...process.argv.slice(2),
  ],
  {stdio: 'inherit'},
);
process.exit(child.status ?? 1);
