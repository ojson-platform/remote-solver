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
  assert.deepEqual(
    steps.map(name => name.replace(/\.md$/, '')).sort(),
    [...new Set(Object.values(ACTION_SKILL))].sort(),
  );
  const found = new Set<string>();
  for (const file of steps) {
    const body = readFileSync(path.join(stepsDir, file), 'utf8');
    const name = file.replace(/\.md$/, '');
    assert.match(body.split('\n')[0], /^mode: (mechanical|judgment)$/, file);
    const mode = skillMode(body);
    assert.equal(mode, mechanical.has(name) ? 'mechanical' : 'judgment', file);
    assert.equal(
      modelFor(mode),
      mode === 'mechanical' ? 'composer-2.5-fast' : 'grok-4.7-high-fast',
    );
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
    const [code, who, target] = row
      .split('|')
      .slice(1, 4)
      .map(cell => cell.trim());
    if (who !== 'agent') {
      continue;
    }
    for (const [, action] of code.matchAll(/`([^`]+)`/g)) {
      route[action] = target.replace(/`/g, '');
    }
  }
  assert.deepEqual(route, {...ACTION_SKILL});
});

const FOCUS_MARKERS = [
  'sdd:focus:plan',
  'sdd:focus:spec',
  'sdd:focus:design',
  'sdd:focus:tasks',
  'sdd:focus:code',
  'sdd:focus:accept',
  'sdd:focus',
] as const;

const FOCUS_STEP_MARKERS: Record<string, string> = {
  plan: 'sdd:focus:plan',
  specify: 'sdd:focus:spec',
  design: 'sdd:focus:design',
  tasks: 'sdd:focus:tasks',
  implement: 'sdd:focus:code',
};

test('design.md Approach: paragraph rules live once in skills/sdd-flow/CONTEXT.md § Publish', () => {
  const context = readFileSync(path.join(flow, 'CONTEXT.md'), 'utf8');
  const publish =
    context
      .split(/^## Publish$/m)[1]
      ?.split(/^## /m)[0]
      ?.trim() ?? '';
  assert.ok(publish.length > 0, 'CONTEXT.md has a Publish section');
  for (const marker of FOCUS_MARKERS) {
    assert.match(publish, new RegExp(marker.replace(/:/g, '\\:')), marker);
  }
  const paragraphRules: Record<(typeof FOCUS_MARKERS)[number], RegExp> = {
    'sdd:focus:plan':
      /reader of the ticket|what was refused|open questions.*place and count/s,
    'sdd:focus:spec':
      /promise is new|existing promise changed|scenario without which|spec does not make/s,
    'sdd:focus:design':
      /behavior lives|alternative was rejected|deliberately not built|behavior is observed/s,
    'sdd:focus:tasks':
      /order a person would notice|waits on another/s,
    'sdd:focus:code':
      /became true after this commit|left untouched|check that does not prove/s,
    'sdd:focus:accept':
      /person has now|left out on purpose|capabilities and scenarios/s,
    'sdd:focus': /whole pull request/s,
  };
  for (const marker of FOCUS_MARKERS) {
    assert.match(publish, paragraphRules[marker], `${marker} paragraph rule`);
  }
  assert.match(
    publish,
    /Russian.*short|prose is Russian|Russian, short/s,
    'shared prose rules',
  );
  for (const [step, marker] of Object.entries(FOCUS_STEP_MARKERS)) {
    const body = readFileSync(path.join(stepsDir, `${step}.md`), 'utf8');
    assert.match(body, /Publish \(`CONTEXT\.md`\)/, step);
    assert.match(body, new RegExp(`focus with marker \`${marker}\``, 'i'), step);
    assert.doesNotMatch(body, /reader of the ticket|promise is new|behavior lives/, step);
  }
  const accept = readFileSync(path.join(stepsDir, 'accept.md'), 'utf8');
  assert.match(accept, /Publish \(`CONTEXT\.md`\)/);
  assert.match(accept, /focus with marker `sdd:focus:accept`/i);
  assert.doesNotMatch(accept, /reader of the ticket|capabilities and scenarios/);
});

test('baseline moves an unshown rule to Added and does not wait on the shelf', () => {
  const baseline = readFileSync(path.join(stepsDir, 'baseline.md'), 'utf8');
  const context = readFileSync(path.join(flow, 'CONTEXT.md'), 'utf8');
  const plan = readFileSync(path.join(stepsDir, 'plan.md'), 'utf8');
  assert.match(baseline, /rule this checkout does not show sits under `### Modified`/);
  assert.match(baseline, /Move an unshown rule under `### Added`/);
  assert.match(baseline, /what this checkout does today/);
  assert.match(baseline, /Do not Wait for a person to choose the shelf/);
  assert.doesNotMatch(baseline, /Wait with what the code does not show/);
  assert.match(context, /this checkout does not show the rule today/);
  assert.match(context, /issue text does not choose the shelf/);
  assert.match(plan, /That shelf is a first cut/);
  assert.match(plan, /does not Wait on the shelf/);
});

test('the chat files point at the sdd script', () => {
  const skill = readFileSync(path.join(flow, 'SKILL.md'), 'utf8');
  const context = readFileSync(path.join(flow, 'CONTEXT.md'), 'utf8');
  const init = readFileSync(path.join(root, 'sdd-init', 'SKILL.md'), 'utf8');
  for (const body of [skill, context, init]) {
    assert.match(body, /node scripts\/sdd\.mjs/);
    assert.doesNotMatch(body, /npx sdd|\bpnpm\b|\bSandcastle\b|\bmaster\b/);
    assert.doesNotMatch(
      body,
      /\bArcadia\b|\bArcanum\b|\bTracker\b|\ba\.yaml\b|\bya make\b|\btestsuite\b/,
    );
  }
});
