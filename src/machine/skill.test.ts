import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {test} from 'vitest';

import {ACTION_SKILL} from './route.ts';
import {modelFor, skillMode} from './skill.ts';

const root = path.join(import.meta.dirname, '..', '..', 'skills');
const mechanical = new Set(['sdd-tasks', 'sdd-implement', 'sdd-fix', 'sdd-pr-comments']);
/** The routing table. The only skill allowed to name the others. */
const router = 'sdd-flow';

const skills = readdirSync(root);
const text = (skill: string) => readFileSync(path.join(root, skill, 'SKILL.md'), 'utf8');

test('every skill declares a mode and the runtime maps it to a model', () => {
  assert.ok(skills.length >= mechanical.size);
  for (const skill of skills) {
    const body = text(skill);
    assert.match(body, /^mode: (mechanical|judgment)$/m);
    const mode = skillMode(body);
    assert.equal(mode, mechanical.has(skill) ? 'mechanical' : 'judgment');
    assert.equal(modelFor(mode), mode === 'mechanical' ? 'composer-2.5-fast' : 'grok-4.7-high-fast');
  }
});

test('every action skill ends in a signal from context.md', () => {
  for (const skill of skills.filter(name => name !== router)) {
    const body = text(skill);
    const stop = body
      .split(/^## /m)
      .find(section => section.startsWith('Stop\n'))
      ?.slice('Stop\n'.length);
    assert.ok(stop, `${skill} has a Stop section`);
    assert.match(stop, /Publish|Wait|Hand-off/, `${skill} Stop names Publish, Wait, or Hand-off`);
    assert.match(body, /context\.md/, `${skill} points at context.md`);
  }
});

const routed = (skill: string) =>
  Object.entries(ACTION_SKILL)
    .filter(([, target]) => target === skill)
    .map(([action]) => action)
    .sort();

const triggers = (skill: string) => {
  const front = text(skill).split(/^---$/m)[1].replace(/\s+/g, ' ');
  const phrase = front.match(/Trigger: ([^.]+)\./)?.[1];
  assert.ok(phrase, `${skill} description has a Trigger phrase`);
  return phrase.split(/,\s*/).sort();
};

test('each skill Trigger lists the actions the route sends to it', () => {
  const seen: string[] = [];
  for (const skill of skills.filter(name => name !== router)) {
    assert.deepEqual(triggers(skill), routed(skill), `${skill} Trigger`);
    seen.push(...triggers(skill));
  }
  assert.deepEqual(seen.sort(), Object.keys(ACTION_SKILL).sort());
});

test('the router Actions table matches the route', () => {
  const table = text(router)
    .split(/^## /m)
    .find(section => section.startsWith('Actions\n'));
  assert.ok(table, `${router} has an Actions section`);
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

test('only the router names other skills', () => {
  for (const skill of skills.filter(name => name !== router)) {
    const body = text(skill);
    for (const other of skills.filter(name => name !== skill)) {
      assert.doesNotMatch(body, new RegExp(`\\b${other}\\b`), `${skill} names ${other}`);
    }
  }
});
