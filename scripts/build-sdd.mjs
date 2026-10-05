import * as esbuild from 'esbuild';
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
await esbuild.build({
  ...common,
  entryPoints: ['src/cli.ts'],
  outfile: target('bin/remote-solver.mjs', 'remote-solver.mjs'),
  external: ['@ai-hero/sandcastle'],
});
