import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

import {build} from 'esbuild';

let bundled: Promise<string> | undefined;

/** One browser bundle for the board process. The repository does not store it. */
export function bundleClient(): Promise<string> {
  bundled ??= build({
    absWorkingDir: dirname(fileURLToPath(import.meta.url)),
    entryPoints: [join(dirname(fileURLToPath(import.meta.url)), 'main.tsx')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    write: false,
    jsx: 'automatic',
    logLevel: 'silent',
  }).then(result => result.outputFiles[0]?.text ?? '');
  return bundled;
}
