import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';

import {modelFor, skillMode} from './skill.ts';

const root = path.join(import.meta.dirname, '..', '..', 'skills');
const mechanical = new Set(['sdd-tasks', 'sdd-implement', 'sdd-pr-comments']);

test('every skill declares a mode and the runtime maps it to a model', () => {
  const skills = readdirSync(root);
  assert.ok(skills.length >= mechanical.size);
  for (const skill of skills) {
    const text = readFileSync(path.join(root, skill, 'SKILL.md'), 'utf8');
    assert.match(text, /^mode: (mechanical|judgment)$/m);
    const mode = skillMode(text);
    assert.equal(mode, mechanical.has(skill) ? 'mechanical' : 'judgment');
    assert.equal(modelFor(mode), mode === 'mechanical' ? 'composer-2.5-fast' : 'grok-4.7-high-fast');
  }
});
