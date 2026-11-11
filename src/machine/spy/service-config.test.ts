import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'vitest';

import {loadServiceConfig} from './service-config.ts';

function service(body: string | undefined): string {
  const root = mkdtempSync(path.join(tmpdir(), 'sdd-config-'));
  if (body !== undefined) {
    mkdirSync(path.join(root, 'openspec'));
    writeFileSync(path.join(root, 'openspec', 'config.yaml'), body);
  }
  return root;
}

const queues = `sdd:
  queues:
    - name: LAVKAOPSCORE
      description: Ordinary work
    - name: OTHER
`;

test('missing optional keys take trunk, sdd, and no ignored authors', () => {
  const config = loadServiceConfig(service(`schema: spec-driven\n${queues}`));
  assert.equal(config.base, 'trunk');
  assert.equal(config.branchScope, 'sdd');
  assert.deepEqual(config.ignoreComments.map(pattern => pattern.source), []);
  assert.deepEqual(config.queues, [
    {name: 'LAVKAOPSCORE', description: 'Ordinary work'},
    {name: 'OTHER'},
  ]);
});

test('base, branch-scope, and ignore-comments are read', () => {
  const config = loadServiceConfig(
    service(`schema: spec-driven
sdd:
  queues:
    - name: LAVKAOPSCORE
      description: Ordinary work
    - name: OTHER
  base: master
  branch-scope: feature
  ignore-comments:
    - dependabot
`),
  );
  assert.equal(config.base, 'master');
  assert.equal(config.branchScope, 'feature');
  assert.equal(config.ignoreComments[0].test('Dependabot[bot]'), true);
  assert.equal(config.ignoreComments[0].test('reviewer'), false);
});

test('a missing file, a missing sdd key, and a queue without a name stop', () => {
  assert.throws(() => loadServiceConfig(service(undefined)), /openspec\/config.yaml is missing/);
  assert.throws(() => loadServiceConfig(service('schema: spec-driven\n')), /sdd is missing/);
  assert.throws(() => loadServiceConfig(service('sdd:\n  base: trunk\n')), /queues is missing/);
  assert.throws(() => loadServiceConfig(service('sdd:\n  queues: []\n')), /queues is empty/);
  assert.throws(() => loadServiceConfig(service('sdd:\n  queues:\n    - description: no name\n')), /queue name is missing/);
  assert.throws(
    () => loadServiceConfig(service('sdd:\n  queues:\n    - name: Q\n  ignore-comments:\n    - "("\n')),
    /ignore-comments/,
  );
});
