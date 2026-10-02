import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {test} from 'vitest';

import {ACTION_SKILL} from './route.ts';
import {modeOfSkill, modelFor, skillMode} from './skill.ts';

const root = path.join(import.meta.dirname, '..', '..', 'skills');
const flow = path.join(root, 'sdd-flow');
const stepsDir = path.join(flow, 'steps');
const mechanical = new Set(['tasks', 'implement', 'fix', 'pr-comments']);

test('skills holds the router and the init skill', () => {
  assert.deepEqual(readdirSync(root).sort(), ['sdd-flow', 'sdd-init']);
});

test('each step declares a mode and does not name another step', () => {
  const steps = readdirSync(stepsDir).filter(name => name.endsWith('.md'));
  assert.deepEqual(steps.map(name => name.replace(/\.md$/, '')).sort(), [...new Set(Object.values(ACTION_SKILL))].sort());
  const found = new Set<string>();
  for (const file of steps) {
    const body = readFileSync(path.join(stepsDir, file), 'utf8');
    const name = file.replace(/\.md$/, '');
    assert.match(body.split('\n')[0], /^mode: (mechanical|judgment)$/, file);
    const mode = skillMode(body);
    assert.equal(mode, mechanical.has(name) ? 'mechanical' : 'judgment', file);
    assert.equal(modelFor(mode), mode === 'mechanical' ? 'composer-2.5-fast' : 'grok-4.7-high-fast');
    found.add(name);
    const stop = body
      .split(/^## /m)
      .find(section => section.startsWith('Stop\n'))
      ?.slice('Stop\n'.length);
    assert.ok(stop, `${file} has a Stop section`);
    assert.match(stop, /Publish|Wait|Hand-off/);
    assert.match(body, /CONTEXT\.md/);
    for (const other of steps) {
      if (other === file) {
        continue;
      }
      const step = other.replace(/\.md$/, '');
      assert.doesNotMatch(body, new RegExp(`steps/${step}\\.md`), `${file} names ${step}`);
    }
    assert.doesNotMatch(body, /npx sdd|\bpnpm\b|\bSandcastle\b|\bmaster\b/);
  }
  for (const name of mechanical) {
    assert.ok(found.has(name), name);
  }
  assert.equal(modeOfSkill(stepsDir, 'tasks'), 'mechanical');
});

test('the router Actions table matches the route', () => {
  const table = readFileSync(path.join(flow, 'SKILL.md'), 'utf8')
    .split(/^## /m)
    .find(section => section.startsWith('Actions\n'));
  assert.ok(table);
  const route: Record<string, string> = {};
  for (const row of table.split('\n').filter(line => line.startsWith('| `'))) {
    const [code, who, target] = row.split('|').slice(1, 4).map(cell => cell.trim());
    if (who !== 'agent') {
      continue;
    }
    for (const [, action] of code.matchAll(/`([^`]+)`/g)) {
      route[action] = target.replace(/`/g, '');
    }
  }
  assert.deepEqual(route, {...ACTION_SKILL});
});

test('the chat files point at the sdd script', () => {
  const skill = readFileSync(path.join(flow, 'SKILL.md'), 'utf8');
  const context = readFileSync(path.join(flow, 'CONTEXT.md'), 'utf8');
  const init = readFileSync(path.join(root, 'sdd-init', 'SKILL.md'), 'utf8');
  for (const body of [skill, context]) {
    assert.match(body, /node scripts\/sdd\.mjs/);
    assert.doesNotMatch(body, /npx sdd|\bpnpm\b|\bSandcastle\b|\bmaster\b/);
  }
  assert.match(init, /node \.\.\/sdd-flow\/scripts\/sdd\.mjs/);
});
