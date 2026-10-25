import * as esbuild from 'esbuild';
import {copyFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outdirFlag = process.argv.indexOf('--outdir');
const outdir = outdirFlag === -1 ? null : path.resolve(process.argv[outdirFlag + 1]);

const target = (committed, name) => (outdir ? path.join(outdir, name) : path.join(root, committed));

const common = {
  absWorkingDir: root,
  bundle: true,
  platform: 'node',
  format: 'esm',
  // yaml's CJS build calls require("process") and require("buffer"). esbuild
  // leaves those as dynamic requires in an ESM bundle, which Node rejects.
  banner: {
    js: [
      '#!/usr/bin/env node',
      "import {createRequire} from 'node:module';",
      'const require = createRequire(import.meta.url);',
    ].join('\n'),
  },
};

await esbuild.build({
  ...common,
  entryPoints: ['src/sdd.ts'],
  outfile: target('skills/sdd-flow/scripts/sdd.mjs', 'sdd.mjs'),
});
const bin = target('bin/remote-solver.mjs', 'remote-solver.mjs');
const beside = path.dirname(bin);
// Same options as bundleClient(). The esbuild API cannot live inside this ESM
// bin: it calls require() and reads __filename, and the bin has top-level await.
await esbuild.build({
  absWorkingDir: root,
  entryPoints: ['src/window/client/main.tsx'],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  jsx: 'automatic',
  outfile: path.join(beside, 'client.js'),
  logLevel: 'silent',
});
copyFileSync(path.join(root, 'src/window/face.css'), path.join(beside, 'face.css'));
await esbuild.build({
  ...common,
  entryPoints: ['src/cli.ts'],
  outfile: bin,
  external: ['@ai-hero/sandcastle', 'esbuild'],
});
