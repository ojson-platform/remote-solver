import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'vitest';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function output(child: {stdout: string; stderr: string}): string {
  return `${child.stdout}\n${child.stderr}`;
}

test('the build writes both files beside each other and leaves the repo files alone', () => {
  const before = spawnSync('git', ['status', '--porcelain', '--', 'skills/sdd-flow/scripts', 'bin'], {
    cwd: root,
    encoding: 'utf8',
  }).stdout;
  const dir = mkdtempSync(path.join(tmpdir(), 'sdd-build-'));
  symlinkSync(path.join(root, 'node_modules'), path.join(dir, 'node_modules'));
  const build = spawnSync(process.execPath, ['scripts/build-sdd.mjs', '--outdir', dir], {cwd: root, encoding: 'utf8'});
  assert.equal(build.status, 0, build.stderr);
  const chat = readFileSync(path.join(dir, 'sdd.mjs'), 'utf8');
  const spy = readFileSync(path.join(dir, 'remote-solver.mjs'), 'utf8');
  assert.doesNotMatch(chat, /@ai-hero\/sandcastle/);
  assert.match(spy, /from "@ai-hero\/sandcastle"/);
  const sdd = spawnSync(process.execPath, [path.join(dir, 'sdd.mjs')], {cwd: root, encoding: 'utf8'});
  assert.notEqual(sdd.status, 0);
  assert.match(output(sdd), /Usage: sdd/);
  const launcher = spawnSync(process.execPath, [path.join(dir, 'remote-solver.mjs')], {cwd: root, encoding: 'utf8'});
  assert.notEqual(launcher.status, 0);
  assert.match(output(launcher), /remote-solver spy/);
  const after = spawnSync('git', ['status', '--porcelain', '--', 'skills/sdd-flow/scripts', 'bin'], {
    cwd: root,
    encoding: 'utf8',
  }).stdout;
  assert.equal(after, before);
});

test('the package ships the built files and not the source', () => {
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {
    bin: Record<string, string>;
    dependencies: Record<string, string>;
  };
  assert.equal(pkg.bin.sdd, './skills/sdd-flow/scripts/sdd.mjs');
  assert.equal(pkg.bin['remote-solver'], './bin/remote-solver.mjs');
  assert.equal(pkg.dependencies.tsx, undefined);
  assert.equal(existsSync(path.join(root, 'bin', 'sdd.mjs')), false);
  const packed = spawnSync('npm', ['pack', '--dry-run', '--json'], {cwd: root, encoding: 'utf8'});
  assert.equal(packed.status, 0, packed.stderr);
  const files = (JSON.parse(packed.stdout) as {files: {path: string}[]}[])[0].files.map(file => file.path);
  for (const required of [
    'bin/remote-solver.mjs',
    'prompts/sdd.md',
    'skills/sdd-init/SKILL.md',
    'skills/sdd-flow/SKILL.md',
    'skills/sdd-flow/CONTEXT.md',
    'skills/sdd-flow/scripts/sdd.mjs',
  ]) {
    assert.ok(files.includes(required), required);
  }
  assert.ok(files.some(file => file.startsWith('skills/sdd-flow/steps/') && file.endsWith('.md')));
  assert.equal(files.some(file => file.startsWith('src/')), false);
});
