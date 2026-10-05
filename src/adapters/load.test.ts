import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'vitest';

import {openMachine} from './load.ts';

const file = 'ai/artifacts/skills/teams/lavka/sdd/sdd-flow/scripts/adapters/index.mjs';

const configYaml = `sdd:
  queues:
    - name: FROM-FILE
`;

function writeServiceConfig(root: string): void {
  const dir = path.join(root, 'openspec');
  mkdirSync(dir, {recursive: true});
  writeFileSync(path.join(dir, 'config.yaml'), configYaml);
}

function plant(mount: string, body: string): string {
  const placed = path.join(mount, file);
  mkdirSync(path.dirname(placed), {recursive: true});
  writeFileSync(placed, body);
  const root = path.join(mount, 'taxi/lavka/service');
  mkdirSync(root, {recursive: true});
  writeServiceConfig(root);
  return root;
}

const module = `export function createAdapters(root, config) {
  return {
    config: {queueLabel: 'LAVKA', defaultBranch: 'trunk', prBase: 'trunk'},
    tracker: {login: () => 'from-adapter'},
    review: {},
    vcs: {marker: 'arc'},
  };
}\n`;

test('adapters replace the ports and the config; the runtime is built over their vcs', async () => {
  const root = plant(mkdtempSync(path.join(tmpdir(), 'sdd-adapters-')), module);
  const chat = await openMachine(root);
  assert.equal(await chat.tracker.login(), 'from-adapter');
  assert.equal(chat.config.queues[0].name, 'FROM-FILE');
  assert.equal(chat.config.base, 'trunk');
  assert.equal(chat.runtime, undefined);

  const seen: unknown[] = [];
  const fake = {run: async () => ({commits: 0}), ask: async () => ({text: ''})};
  const spy = await openMachine(root, {runtime: box => (seen.push(box.vcs), fake)});
  assert.equal(spy.runtime, fake);
  assert.deepEqual(seen, [{marker: 'arc'}]);
});

test('without the adapter file the ports stay GitHub and git', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'sdd-plain-'));
  writeServiceConfig(root);
  const box = await openMachine(root);
  assert.equal(box.config.queues[0].name, 'FROM-FILE');
  assert.equal(box.runtime, undefined);
});

test('a root with no yaml is rejected', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'sdd-missing-'));
  await assert.rejects(() => openMachine(root), /openspec\/config.yaml is missing/);
});
