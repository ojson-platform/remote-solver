import {existsSync, readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

let bundled: Promise<string> | undefined;

/**
 * One browser bundle for the board process. The repository does not store it.
 * Source starts esbuild beside `main.tsx`. The built bin reads `client.js`
 * written next to it by `pnpm build`, and does not carry the esbuild API.
 */
export function bundleClient(): Promise<string> {
  bundled ??= loadClient();
  return bundled;
}

function loadClient(): Promise<string> {
  const dir = dirname(fileURLToPath(import.meta.url));
  const entry = join(dir, 'main.tsx');
  if (!existsSync(entry)) {
    return Promise.resolve(readFileSync(join(dir, 'client.js'), 'utf8'));
  }
  return import('esbuild').then(({build}) =>
    build({
      absWorkingDir: dir,
      entryPoints: [entry],
      bundle: true,
      format: 'iife',
      platform: 'browser',
      write: false,
      jsx: 'automatic',
      logLevel: 'silent',
    }).then(result => result.outputFiles[0]?.text ?? ''),
  );
}
