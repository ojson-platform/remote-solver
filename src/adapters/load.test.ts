import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'vitest';

import {openMachine} from './load.ts';

const file = 'ai/artifacts/skills/teams/lavka/sdd/sdd-flow/scripts/adapters/index.mjs';

function plant(mount: string, body: string): string {
  const placed = path.join(mount, file);
  mkdirSync(path.dirname(placed), {recursive: true});
  writeFileSync(placed, body);
  const root = path.join(mount, 'taxi/lavka/service');
  mkdirSync(root, {recursive: true});
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
  assert.equal(chat.config.queueLabel, 'LAVKA');
  assert.equal(chat.config.prBase, 'trunk');
  assert.equal(chat.runtime, undefined);

  const seen: unknown[] = [];
  const fake = {run: async () => ({commits: 0}), ask: async () => ({text: ''})};
  const spy = await openMachine(root, {runtime: box => (seen.push(box.vcs), fake)});
  assert.equal(spy.runtime, fake);
  assert.deepEqual(seen, [{marker: 'arc'}]);
});

test('without the adapter file the ports stay GitHub and git', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'sdd-plain-'));
  const box = await openMachine(root);
  assert.equal(box.config.queueLabel, 'Sandcastle');
  assert.equal(box.runtime, undefined);
});
