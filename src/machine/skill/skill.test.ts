import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {test} from 'vitest';

import {ACTION_SKILL} from '../decide/route.ts';
import {modeOfSkill, modelFor, skillMode} from './skill.ts';

const root = path.join(import.meta.dirname, '..', '..', '..', 'skills');
const flow = path.join(root, 'sdd-flow');
const stepsDir = path.join(flow, 'steps');
const mechanical = new Set([
  'tasks',
  'implement',
  'fix',
  'pr-comments',
  'cover-baseline',
  'repair-suite',
]);

test('skills holds the flow skill', () => {
  assert.deepEqual(readdirSync(root).sort(), ['sdd-flow']);
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
      /what changes for the person|what was refused|open questions.*place and count/s,
    'sdd:focus:spec':
      /promise is new|existing promise changed|scenario without which|spec does not make/s,
    'sdd:focus:design':
      /person sees on the screen|alternative was rejected|deliberately not built|where on the screen to look/s,
    'sdd:focus:tasks':
      /order a person would notice|waits on another/s,
    'sdd:focus:code':
      /became true after this commit|left untouched|check that does not prove/s,
    'sdd:focus:accept':
      /landed in the baseline specs[\s\S]*left out on purpose[\s\S]*Do not count capabilities/s,
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
  assert.match(publish, /what a person sees/, 'shared screen sentence');
  assert.match(publish, /does not become a metaphor/, 'shared metaphor rule');
  assert.match(publish, /not a test file/, 'shared place to look');
  for (const [step, marker] of Object.entries(FOCUS_STEP_MARKERS)) {
    const body = readFileSync(path.join(stepsDir, `${step}.md`), 'utf8');
    assert.match(body, /Publish \(`CONTEXT\.md`\)/, step);
    assert.match(body, new RegExp(`focus with marker \`${marker}\``, 'i'), step);
    assert.doesNotMatch(
      body,
      /what changes for the person|promise is new|behavior lives|person sees on the screen/,
      step,
    );
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
  assert.match(plan, /leave `### Added` and `### Modified` empty and do not invent an id/);
  assert.match(plan, /Both lists empty is a finished cut when no rule changes/);
  assert.match(context, /names no id/);
  assert.match(context, /needs no delta/);
});

test('an existing artifact stays only when the upstream block says nothing changed', () => {
  const context = readFileSync(path.join(flow, 'CONTEXT.md'), 'utf8');
  const plan = readFileSync(path.join(stepsDir, 'plan.md'), 'utf8');
  const specify = readFileSync(path.join(stepsDir, 'specify.md'), 'utf8');
  const design = readFileSync(path.join(stepsDir, 'design.md'), 'utf8');
  const tasks = readFileSync(path.join(stepsDir, 'tasks.md'), 'utf8');
  assert.match(context, /## Upstream/);
  assert.match(context, /Do not rebuild it from history/);
  assert.match(plan, /file existing is not a reason to leave that sentence|every caller-visible sentence/);
  assert.match(plan, /already replaced is not copied back/);
  assert.match(specify, /does not start from the result already visible/);
  assert.match(specify, /behavior of another surface is absent is not a Scenario/);
  assert.match(context, /behavior of another surface is absent is not a Scenario/);
  assert.match(tasks, /reopens that task's `- \[ \]`/);
  assert.match(design, /do not move `sdd-absorbed`/);
  assert.match(readFileSync(path.join(stepsDir, 'fix.md'), 'utf8'), /## Source` asks for behavior/);
  assert.match(specify, /stamp matches/);
  assert.match(specify, /Do not judge a match from the whole proposal/);
  assert.match(design, /Do not judge `design.md` already right from the whole spec/);
  assert.match(tasks, /stamp matches/);
  assert.doesNotMatch(design, /design\.md` is already right/);
  assert.doesNotMatch(plan, /proposal\.md` already exists: leave it/);
});

test('an instruction is a thread of this phase, and a note asks for nothing', () => {
  const comments = readFileSync(path.join(stepsDir, 'pr-comments.md'), 'utf8');
  const context = readFileSync(path.join(flow, 'CONTEXT.md'), 'utf8');
  const plan = readFileSync(path.join(stepsDir, 'plan.md'), 'utf8');
  const specify = readFileSync(path.join(stepsDir, 'specify.md'), 'utf8');
  const design = readFileSync(path.join(stepsDir, 'design.md'), 'utf8');
  const tasks = readFileSync(path.join(stepsDir, 'tasks.md'), 'utf8');
  const fix = readFileSync(path.join(stepsDir, 'fix.md'), 'utf8');
  assert.match(comments, /This step does not divide the request/);
  assert.match(comments, /After that thread is open, `thread say/);
  assert.match(comments, /do not open a `code` thread/);
  assert.match(comments, /Step 3 Waited: leave `sdd:wait-human` set/);
  assert.doesNotMatch(comments, /rebase or a merge conflict is `code`/);
  assert.doesNotMatch(comments, /are `code`/);
  assert.match(context, /do not write that file again/);
  assert.match(context, /Publish is this step's own Publish, once/);
  assert.match(context, /does not invent `code`/);
  assert.match(context, /### Onto the base/);
  assert.match(comments, /reply with one line: `sdd:layer=<layer> → <phase>`/);
  assert.doesNotMatch(comments, /reply with one line: `sdd:layer=<layer> → <phase> <cause>`/);
  assert.doesNotMatch(plan, /then step 5/);
  assert.match(specify, /go to step 5/);
  assert.match(specify, /An open spec thread does not take step 3/);
  assert.match(specify, /there is no open spec thread: step 3, then step 5/);
  assert.match(specify, /sdd probe <issue>/);
  assert.doesNotMatch(design, /then step 6/);
  assert.doesNotMatch(tasks, /then step 8/);
  assert.doesNotMatch(fix, /conversation\.layer` is `code`/);
  assert.match(fix, /§ Onto the base/);
});

test('a code fix hands off before the commit, and verify reads the THEN first', () => {
  const fix = readFileSync(path.join(stepsDir, 'fix.md'), 'utf8');
  const verify = readFileSync(path.join(stepsDir, 'verify.md'), 'utf8');
  const handed = fix.indexOf('behavior the named scenarios do not describe');
  const commit = fix.indexOf('One commit per thread');
  assert.ok(handed !== -1 && commit !== -1 && handed < commit);
  assert.match(fix, /The red run fails on the example the remark names before any source edit/);
  assert.match(fix, /A green run of a neighboring example is not that red run/);
  assert.match(fix, /whose `scenario` title this change's delta names/);
  assert.match(fix, /fails on that commit's parent and passes on HEAD/);
  assert.match(fix, /neighboring check in the same file does not either/);
  assert.match(fix, /A `scenario` a stable spec names counts the same way and stays on this layer/);
  assert.match(fix, /When the trace line names `@ojson\/spec-coverage`/);
  assert.match(fix, /does not mark `sdd:layer=spec`/);
  assert.match(
    readFileSync(path.join(flow, 'CONTEXT.md'), 'utf8'),
    /When the trace line names `@ojson\/spec-coverage`/,
  );
  assert.match(
    readFileSync(path.join(flow, 'CONTEXT.md'), 'utf8'),
    /fails on that commit's parent and passes on HEAD[\s\S]*whose `scenario` title this change's delta names/,
  );
  const then = verify.indexOf("read that scenario's THEN");
  const code = verify.indexOf('Hand-off (`CONTEXT.md`) to `code`');
  assert.ok(then !== -1 && code !== -1 && then < code);
});

test('the final review treats a broken design sentence as a return', () => {
  const review = readFileSync(
    path.join(import.meta.dirname, '..', '..', '..', '.agents/skills/sdd-final-review/SKILL.md'),
    'utf8',
  );
  assert.match(review, /design approach and its rejected list/);
  const design = review.indexOf('**Design.**');
  const named = review.indexOf('A test with no scenario is a finding when the design lens names it');
  assert.ok(design !== -1 && named !== -1 && design < named);
  assert.match(review, /One return per design sentence/);
  assert.match(review, /A scenario that names one example of the class, and not the class, does not state the class/);
  assert.match(review, /widen the scenario that should state the sentence so its WHEN and THEN name the class/);
  assert.match(review, /one weaker stand-in of the class and stays red while the observation is false/);
  assert.match(review, /the return is that scenario's own example failing in the diff/);
  assert.match(review, /An input the scenarios do not use is not a return/);
  assert.match(review, /A check that stays green on the example the scenario names is not a failing example/);
  assert.match(review, /A branch that check does not call is an input the scenarios do not use/);
  assert.match(review, /A later return of the same sentence happens only when the scenario that now names the class is false/);
  assert.match(review, /A design sentence the diff breaks is a return/);
  assert.match(review, /When no scenario names the promise, the lens is `spec`/);
  assert.match(review, /`where` is the delta spec that should name it/);
  const designStep = readFileSync(path.join(stepsDir, 'design.md'), 'utf8');
  const unnamed = designStep.indexOf('names an observation no scenario names is a Hand-off');
  const publishWhenNamed = designStep.indexOf('Publish (`CONTEXT.md`) only when every such sentence is named by a scenario');
  assert.ok(unnamed !== -1 && publishWhenNamed !== -1 && unnamed < publishWhenNamed);
  const comments = readFileSync(path.join(stepsDir, 'pr-comments.md'), 'utf8');
  const quoted = comments.indexOf('quotes a promise a scenario already states');
  const unnamedRemark = comments.indexOf('observation no scenario names is `spec`');
  assert.ok(quoted !== -1 && unnamedRemark !== -1 && quoted < unnamedRemark);
  assert.match(comments, /A word the scenario title does not contain is that same promise/);
  assert.match(review, /does not name the promise, and the lens is `spec`/);
  assert.match(review, /An input the scenarios do not use is not a new code return of that promise/);
});

test('a long command keeps the command status, not a pipe', () => {
  const context = readFileSync(path.join(flow, 'CONTEXT.md'), 'utf8');
  const repair = readFileSync(path.join(stepsDir, 'repair-suite.md'), 'utf8');
  assert.match(context, /Redirect its output to a file and remember its status/);
  assert.match(context, /Do not pipe the command into `tail` or `head`/);
  assert.match(context, /`missing`, `near`, `outside`, or `spec coverage has gaps`/);
  assert.match(context, /Do not run the command again to see another slice of the same output/);
  assert.match(repair, /Keep each command's own status, as § Once says/);
});

test('the chat files point at the sdd command', () => {
  const skill = readFileSync(path.join(flow, 'SKILL.md'), 'utf8');
  const context = readFileSync(path.join(flow, 'CONTEXT.md'), 'utf8');
  const banned = /\bgit\b|\bnode\b|\bnpm\b|\bpnpm\b|\bvitest\b|\bnpx sdd\b|\bSandcastle\b|\bmaster\b/;
  for (const body of [skill, context]) {
    assert.match(body, /\bsdd (step|rebase) /);
    assert.doesNotMatch(body, banned);
    assert.doesNotMatch(
      body,
      /\bArcadia\b|\bArcanum\b|\bTracker\b|\ba\.yaml\b|\bya make\b|\btestsuite\b/,
    );
  }
  for (const file of readdirSync(stepsDir).filter(name => name.endsWith('.md'))) {
    assert.doesNotMatch(readFileSync(path.join(stepsDir, file), 'utf8'), banned, file);
  }
});
