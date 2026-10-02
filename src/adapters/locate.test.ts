import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'vitest';

import {adapterFile} from './locate.ts';

const arcadiaFile = 'ai/artifacts/skills/teams/lavka/sdd/sdd-flow/scripts/adapters/index.mjs';

test('the file beside the script wins, then the arcadia tree above root', () => {
  const mount = mkdtempSync(path.join(tmpdir(), 'arcadia-'));
  const placed = path.join(mount, arcadiaFile);
  mkdirSync(path.dirname(placed), {recursive: true});
  writeFileSync(placed, '');
  const service = path.join(mount, 'taxi/lavka/service');
  mkdirSync(service, {recursive: true});
  assert.equal(adapterFile(path.join(service, 'node_modules/remote-solver/bin/remote-solver.mjs'), service), placed);

  const beside = path.join(mount, 'skills/sdd-flow/scripts/adapters/index.mjs');
  mkdirSync(path.dirname(beside), {recursive: true});
  writeFileSync(beside, '');
  assert.equal(adapterFile(path.join(mount, 'skills/sdd-flow/scripts/sdd.mjs'), service), beside);
  assert.equal(adapterFile(path.join(tmpdir(), 'nope.mjs'), tmpdir()), undefined);
});
