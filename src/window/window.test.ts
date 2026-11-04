import assert from 'node:assert/strict';
import {test} from 'vitest';
import {mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';

import {parse} from 'yaml';

import {focusBlockProse} from './focus.ts';
import {openWindow} from './window.ts';
import {
  MANAGER,
  assertNoEmptyStrings,
  columnCards,
  cycle,
  homeRoles,
  hookQueues,
  openCycles,
  openHookGroup,
  openSide,
  prepare,
  readHome,
  readServiceYaml,
  scratch,
  ticket,
  writeChange,
  writeLaunch,
  writeOverlay,
  writeServiceConfig,
  writeServiceYaml,
  yard,
} from './window.harness.ts';

test('choosing an agent does not read a live catalog', () => {
  const {dir, home} = scratch();
  let reads = 0;
  const window = openWindow(
    {homePath: home},
    {
      catalog: () => {
        reads += 1;
        return {mechanical: 'not-the-pair', judgment: 'also-not'};
      },
    },
  );
  window.chooseAgent('cursor');
  assert.equal(reads, 0);
  const doc = readHome(home);
  assert.equal(doc.models?.mechanical, 'composer-2.5-fast');
  assert.equal(doc.models?.judgment, 'grok-4.7-high-fast');
  rmSync(dir, {recursive: true, force: true});
});

test('an agent without a known pair leaves both models empty', () => {
  const {dir, home} = scratch();
  const window = openWindow({homePath: home, agents: ['other']}, {answers: () => true});
  window.chooseAgent('other');
  const doc = readHome(home);
  assert.equal(doc.agent, 'other');
  assert.equal(doc.models, undefined);
  assert.equal(doc.effort, undefined);
  assert.equal(doc.speed, undefined);
  assertNoEmptyStrings(doc);
  assert.equal(window.settings().models.mechanical.value, '');
  assert.equal(window.settings().models.mechanical.needsValue, true);
  assert.equal(window.settings().models.judgment.value, '');
  assert.equal(window.settings().models.judgment.needsValue, true);
  assert.deepEqual(window.board().rows, [{text: 'нужны модели mechanical и judgment'}]);
  rmSync(dir, {recursive: true, force: true});
});

test('an empty model stops the window spy', () => {
  const {dir, home} = scratch();
  let started = 0;
  const window = openWindow(
    {homePath: home},
    {
      answers: () => true,
      startStep: () => {
        started += 1;
      },
    },
  );
  window.chooseAgent('cursor');
  window.spy();
  assert.equal(started, 1);
  window.leaveModel('judgment', '');
  window.spy();
  assert.equal(started, 1);
  assert.equal(window.board().stepsStart, false);
  rmSync(dir, {recursive: true, force: true});
});

test('closing settings does not erase the home file', () => {
  const {dir, home} = scratch();
  const window = openWindow({homePath: home});
  window.chooseAgent('cursor');
  const written = readFileSync(home, 'utf8');
  window.openSettings();
  window.closeSettings();
  assert.equal(readFileSync(home, 'utf8'), written);
  assert.equal(window.settings().open, false);
  assert.equal(window.board().settingsOpen, false);
  assert.equal(readHome(home).agent, 'cursor');
  rmSync(dir, {recursive: true, force: true});
});

test('two launches do not share a home file', () => {
  const left = scratch();
  const right = scratch();
  const a = openWindow({homePath: left.home});
  const b = openWindow({homePath: right.home});
  a.chooseAgent('cursor');
  b.chooseAgent('codex');
  assert.equal(readHome(left.home).agent, 'cursor');
  assert.equal(readHome(left.home).models?.mechanical, 'composer-2.5-fast');
  assert.equal(readHome(right.home).agent, 'codex');
  assert.equal(readHome(right.home).effort?.mechanical, 'low');
  assert.equal(readHome(left.home).agent, 'cursor');
  rmSync(left.dir, {recursive: true, force: true});
  rmSync(right.dir, {recursive: true, force: true});
});

test('the user block writes the watch list and the roots immediately', () => {
  const {dir, home} = scratch();
  const window = openWindow({homePath: home, adapter: 'tracker'});
  window.chooseAgent('cursor');
  window.leaveWatch(['alpha', 'alpha', 'beta']);
  window.leaveRoots({arcadia: '/arcadia', github: '/github'});
  const doc = readHome(home);
  assert.deepEqual(doc.watch, ['alpha', 'beta']);
  assert.deepEqual(doc.roots, {arcadia: '/arcadia', github: '/github'});
  assert.equal(doc.agent, 'cursor');
  assert.equal((doc as {system?: unknown}).system, undefined);
  const disk = readFileSync(home, 'utf8');
  writeFileSync(home, disk.replace('cursor', 'codex'));
  window.leaveWatch(['gamma']);
  assert.equal(readFileSync(home, 'utf8').includes('gamma'), false);
  assert.equal(readHome(home).agent, 'codex');
  rmSync(dir, {recursive: true, force: true});
});

test('an overlay does not replace the checkout roots', () => {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeServiceConfig(checkout, ['alpha']);
  writeOverlay(checkout, ['alpha'], 'roots:\n  arcadia: /wrong\n');
  writeLaunch(home, ['alpha'], {arcadia});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})],
    },
  );
  const card = window.board().pool.find(item => item.key === '1');
  assert.ok(card);
  assert.equal(card.checkout, checkout);
  assert.equal(card.checkout?.startsWith('/wrong'), false);
  assert.equal(card.queue, 'alpha');
  assert.deepEqual(card.choices, ['services/billing']);
  assert.equal(
    window.board().cards.some(item => item.key === '1'),
    false,
  );
  rmSync(dir, {recursive: true, force: true});
});

test('a fresh launch still reads an overlay after home drops the name', () => {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeOverlay(checkout, ['alpha']);
  writeServiceConfig(checkout, ['alpha']);
  writeLaunch(home, [], {arcadia});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})]},
  );
  assert.deepEqual(window.board().watch, ['alpha']);
  assert.deepEqual(
    window.board().pool.map(item => item.key),
    ['1'],
  );
  assert.deepEqual(window.board().cards, []);
  rmSync(dir, {recursive: true, force: true});
});

test('a name only in an overlay under the old root leaves when the roots change', () => {
  const {dir, home} = yard();
  const oldRoot = path.join(dir, 'old-arcadia');
  const newRoot = path.join(dir, 'new-arcadia');
  const oldCheckout = path.join(oldRoot, 'services', 'billing');
  mkdirSync(oldCheckout, {recursive: true});
  writeOverlay(oldCheckout, ['beta']);
  writeServiceConfig(oldCheckout, ['alpha']);
  writeLaunch(home, ['alpha'], {arcadia: oldRoot});
  const tickets = [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})];
  const window = openWindow({homePath: home, adapter: 'tracker'}, {tickets: () => tickets});
  assert.deepEqual(window.board().watch, ['alpha', 'beta']);
  window.leaveRoots({arcadia: newRoot});
  assert.deepEqual(window.board().watch, ['alpha']);
  const reached = path.join(newRoot, 'services', 'billing');
  mkdirSync(reached, {recursive: true});
  writeOverlay(reached, ['beta']);
  assert.deepEqual(window.board().watch, ['alpha', 'beta']);
  rmSync(dir, {recursive: true, force: true});
});

test('sdd:cycle is still required for a card', () => {
  const {dir, home, arcadia, github} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeServiceConfig(checkout, ['alpha']);
  writeLaunch(home, ['alpha', 'acme/billing'], {arcadia, github});
  const tracker = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      tickets: () => [
        ticket({key: '1', queue: 'alpha', labels: ['alpha'], sddService: 'services/billing'}),
      ],
    },
  );
  assert.deepEqual(tracker.board().cards, []);
  const repo = path.join(github, 'acme', 'billing');
  mkdirSync(repo, {recursive: true});
  writeServiceConfig(repo, ['alpha']);
  const hub = openWindow(
    {homePath: home, adapter: 'github'},
    {tickets: () => [ticket({key: '2', repo: 'acme/billing', sddService: '', labels: ['alpha']})]},
  );
  assert.deepEqual(hub.board().cards, []);
  rmSync(dir, {recursive: true, force: true});
});

test('the window does not append the queue to the service config', () => {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeServiceConfig(checkout, ['beta']);
  writeLaunch(home, ['alpha'], {arcadia});
  const config = path.join(checkout, 'openspec', 'config.yaml');
  const before = readFileSync(config, 'utf8');
  let started = 0;
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      answers: () => true,
      startStep: () => {
        started += 1;
      },
      tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})],
    },
  );
  window.chooseAgent('cursor');
  window.take('1');
  window.spy();
  assert.equal(readFileSync(config, 'utf8'), before);
  assert.equal(started, 0);
  assert.equal(window.board().pool[0]?.reason, 'очереди нет в конфиге сервиса');
  assert.deepEqual(window.board().cards, []);
  rmSync(dir, {recursive: true, force: true});
});

test('the step reads the gathered checkout', () => {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeServiceConfig(checkout, ['alpha']);
  writeLaunch(home, ['alpha'], {arcadia});
  const started: string[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      answers: () => true,
      startStep: value => {
        started.push(value ?? '');
      },
      tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})],
    },
  );
  window.chooseAgent('cursor');
  window.spy();
  assert.deepEqual(started, [checkout]);
  assert.notEqual(started[0], process.cwd());
  assert.notEqual(started[0], dir);
  rmSync(dir, {recursive: true, force: true});
});

test('designing counts open decisions including zero and tasking has no row', () => {
  const {dir, home, arcadia} = yard();
  const checkout = prepare(arcadia, home);
  writeChange(
    checkout,
    '1',
    'design.md',
    '## Open decisions\n\n- [ ] one\n- [x] done\n\n## Later\n\n- [ ] skip\n',
  );
  writeChange(checkout, '3', 'tasks.md', '- [x] done\n- [ ] open\n');
  const window = openCycles(home, [
    cycle('1', 'designed'),
    cycle('2', 'designing'),
    cycle('3', 'tasking'),
  ]);
  const board = window.board();
  assert.equal(columnCards(board, 'designing')?.find(card => card.key === '1')?.phaseRow, 1);
  assert.equal(columnCards(board, 'designing')?.find(card => card.key === '2')?.phaseRow, 0);
  assert.equal(columnCards(board, 'tasking')?.[0]?.phaseRow, undefined);
  rmSync(dir, {recursive: true, force: true});
});

test('pending checks hide the icon and the phase row stays pending', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openCycles(home, [
    cycle('1', 'verifying', {checks: 'green'}),
    cycle('2', 'verifying', {
      checks: 'pending',
      labels: ['sdd:cycle', 'sdd:verifying', 'sdd:wait-human'],
    }),
  ]);
  const cards = columnCards(window.board(), 'verifying');
  assert.deepEqual(
    cards?.map(card => card.key),
    ['2', '1'],
  );
  assert.equal(cards?.[0]?.icon, undefined);
  assert.equal(cards?.[0]?.phaseRow, 'pending');
  assert.equal(cards?.[1]?.phaseRow, 'green');
  rmSync(dir, {recursive: true, force: true});
});

test('decisions are the only occasion and the phase row already shows the count', () => {
  const {dir, home, arcadia} = yard();
  const checkout = prepare(arcadia, home);
  writeChange(checkout, '1', 'design.md', '## Open decisions\n\n- [ ] one\n');
  const window = openCycles(home, [cycle('1', 'designing')]);
  const card = columnCards(window.board(), 'designing')?.[0];
  assert.equal(card?.phaseRow, 1);
  assert.equal(card?.icon, true);
  assert.equal(card?.reason, undefined);
  rmSync(dir, {recursive: true, force: true});
});

test('blockers are dependsOn keys found in this reading, in key order', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openCycles(home, [
    cycle('p', 'implementing', {dependsOn: ['z', 'missing', 'a', 'a']}),
    ticket({key: 'z', queue: 'other', labels: ['note']}),
    ticket({key: 'a', queue: 'other', labels: ['note']}),
  ]);
  const card = columnCards(window.board(), 'implementing')?.[0];
  assert.equal(card?.reason, 'блокеры a z');
  assert.equal(card?.reason?.includes('missing'), false);
  rmSync(dir, {recursive: true, force: true});
});

test('several open pull requests are one reason part', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openCycles(home, [
    cycle('1', 'implementing', {openPullRequests: 2}),
    cycle('2', 'implementing', {openPullRequests: 1}),
  ]);
  const cards = columnCards(window.board(), 'implementing');
  assert.equal(cards?.find(card => card.key === '1')?.reason, 'несколько pull request');
  assert.equal(cards?.find(card => card.key === '1')?.icon, true);
  assert.equal(cards?.find(card => card.key === '2')?.reason, undefined);
  assert.equal(cards?.find(card => card.key === '2')?.icon, undefined);
  rmSync(dir, {recursive: true, force: true});
});

test('a phaseless ticket with another assignee is absent', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openCycles(home, [
    ticket({
      key: '1',
      queue: 'alpha',
      sddService: 'services/billing',
      assignee: 'other',
      title: 'Theirs',
      open: true,
    }),
  ]);
  const board = window.board();
  const keys = [
    ...board.cards.map(card => card.key),
    ...board.pool.map(card => card.key),
    ...board.columns.flatMap(column => column.cards.map(card => card.key)),
  ];
  assert.equal(keys.includes('1'), false);
  rmSync(dir, {recursive: true, force: true});
});

test('pending checks hide the icon on a pool ticket with two open pull requests', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openCycles(home, [
    ticket({
      key: '1',
      queue: 'alpha',
      sddService: 'services/billing',
      title: 'Split',
      openPullRequests: 2,
      checks: 'pending',
    }),
  ]);
  const card = window.board().pool.find(item => item.key === '1');
  assert.ok(card);
  assert.equal(card.icon, undefined);
  assert.equal(card.reason, 'несколько pull request');
  assert.equal(card.takeDisabled, true);
  rmSync(dir, {recursive: true, force: true});
});

test('a running step hides the icon on a pool ticket with a checkout break', () => {
  const {dir, home, arcadia} = yard();
  writeLaunch(home, ['alpha'], {arcadia});
  const window = openCycles(
    home,
    [
      ticket({
        key: '1',
        queue: 'alpha',
        sddService: 'services/missing',
        title: 'Gone',
      }),
    ],
    key => key === '1',
  );
  const card = window.board().pool.find(item => item.key === '1');
  assert.ok(card);
  assert.equal(card.icon, undefined);
  assert.equal(card.reason, 'каталога нет');
  assert.equal(card.takeDisabled, true);
  rmSync(dir, {recursive: true, force: true});
});

test('a newer overlay file on disk blocks the write and the group shows the disk agent', () => {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeServiceConfig(checkout, ['alpha']);
  writeLaunch(home, ['alpha'], {arcadia});
  writeOverlay(checkout, ['alpha'], 'agent: cursor\n');
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})]},
  );
  window.openSettings();
  assert.equal(window.overlay().agent, 'cursor');
  const file = path.join(checkout, '.aifactory', 'config.yaml');
  writeFileSync(file, 'agent: codex\n');
  window.chooseOverlayAgent('opencode');
  assert.equal(readHome(file).agent, 'codex');
  assert.equal(window.overlay().agent, 'codex');
  rmSync(dir, {recursive: true, force: true});
});

test('the service-config group shows no fields when the agent is silent and the file does not parse', () => {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeServiceYaml(checkout, 'sdd: [\n');
  writeLaunch(home, ['alpha'], {arcadia});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      answers: () => false,
      tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})],
    },
  );
  window.chooseAgent('cursor');
  window.openCard('1');
  window.openSettings();
  assert.deepEqual(window.board().rows, [{text: 'агент не отвечает'}]);
  assert.equal(window.board().settingsOpen, true);
  assert.equal(window.serviceConfig().checkout, checkout);
  assert.equal(window.serviceConfig().save, false);
  assert.equal(window.serviceConfig().queues, undefined);
  rmSync(dir, {recursive: true, force: true});
});

test('a free point is written as a list and a later string skips the choice', () => {
  const {dir, file, window} = openHookGroup(hookQueues);
  window.chooseServiceHook('archive', 'before', 'first\nstill');
  window.saveServiceConfig();
  assert.deepEqual(readServiceYaml(file).sdd?.hooks?.archive?.before, ['first\nstill']);
  assert.equal(
    window
      .serviceConfig()
      .hookChoices?.some(item => item.action === 'archive' && item.point === 'before'),
    false,
  );
  window.setServiceHook('archive', 'before', ['first\nstill', 'second']);
  window.chooseServiceHook('archive', 'before', 'not through the choice');
  window.saveServiceConfig();
  assert.deepEqual(readServiceYaml(file).sdd?.hooks?.archive?.before, ['first\nstill', 'second']);
  rmSync(dir, {recursive: true, force: true});
});

test('an action leaves the free list when both points are taken', () => {
  const {dir, file, window} = openHookGroup(
    [
      'sdd:',
      '  queues:',
      '    - name: alpha',
      '  hooks:',
      '    archive:',
      '      before:',
      '        - kept',
      '',
    ].join('\n'),
  );
  assert.deepEqual(
    window
      .serviceConfig()
      .hookChoices?.filter(item => item.action === 'archive')
      .map(item => item.point),
    ['after'],
  );
  window.chooseServiceHook('archive', 'after', 'tail');
  assert.equal(
    window.serviceConfig().hookChoices?.some(item => item.action === 'archive'),
    false,
  );
  assert.equal(
    window.serviceConfig().hookChoices?.some(item => item.action === 'create-proposal'),
    true,
  );
  window.saveServiceConfig();
  const hooks = readServiceYaml(file).sdd?.hooks;
  assert.deepEqual(hooks?.archive?.before, ['kept']);
  assert.deepEqual(hooks?.archive?.after, ['tail']);
  rmSync(dir, {recursive: true, force: true});
});

test('an unknown point is edited and is not offered', () => {
  const {dir, file, window} = openHookGroup(
    [
      'sdd:',
      '  queues:',
      '    - name: alpha',
      '  hooks:',
      '    custom:',
      '      during:',
      '        - old',
      '      before: 4',
      '',
    ].join('\n'),
  );
  assert.deepEqual(window.serviceConfig().hooks, [
    {action: 'custom', point: 'during', values: ['old']},
  ]);
  assert.equal(
    window
      .serviceConfig()
      .hookChoices?.some(item => item.action === 'custom' || item.point === 'during'),
    false,
  );
  window.setServiceHook('custom', 'during', ['new']);
  window.chooseServiceHook('custom', 'before', 'no');
  window.setServiceHook('custom', 'before', ['no']);
  window.saveServiceConfig();
  const hooks = readServiceYaml(file).sdd?.hooks;
  assert.deepEqual(hooks?.custom?.during, ['new']);
  assert.equal(hooks?.custom?.before, 4);
  rmSync(dir, {recursive: true, force: true});
});

test('an empty key stays out of the free list and a new string skips the choice', () => {
  for (const stored of ['[]', '""', '"   "']) {
    const {dir, file, window} = openHookGroup(
      [
        'sdd:',
        '  queues:',
        '    - name: alpha',
        '  hooks:',
        '    archive:',
        `      before: ${stored}`,
        '',
      ].join('\n'),
    );
    assert.deepEqual(window.serviceConfig().hooks, [
      {action: 'archive', point: 'before', values: []},
    ]);
    assert.equal(
      window
        .serviceConfig()
        .hookChoices?.some(item => item.action === 'archive' && item.point === 'before'),
      false,
    );
    window.chooseServiceHook('archive', 'before', 'through the choice');
    assert.deepEqual(window.serviceConfig().hooks, [
      {action: 'archive', point: 'before', values: []},
    ]);
    window.setServiceHook('archive', 'before', ['added']);
    window.saveServiceConfig();
    assert.deepEqual(readServiceYaml(file).sdd?.hooks?.archive?.before, ['added']);
    rmSync(dir, {recursive: true, force: true});
  }
});

test('spaces stay out of a hook list and the manager can reorder it', () => {
  const {dir, file, window} = openHookGroup(
    [
      'sdd:',
      '  queues:',
      '    - name: alpha',
      '  hooks:',
      '    archive:',
      '      before:',
      '        - one',
      '        - two',
      '',
    ].join('\n'),
  );
  window.setServiceHook('archive', 'before', ['two', '   ', '', 'one']);
  window.saveServiceConfig();
  assert.deepEqual(readServiceYaml(file).sdd?.hooks?.archive?.before, ['two', 'one']);
  rmSync(dir, {recursive: true, force: true});
});

test('sidebar() with no open card has no blocks', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openSide(home, [
    cycle('1', 'implementing', {comments: [{body: 'sdd:focus\nPlan gap\n'}]}),
  ]);
  assert.deepEqual(window.sidebar(), []);
  rmSync(dir, {recursive: true, force: true});
});

test('the sidebar reason is the card full line', () => {
  const {dir, home, arcadia} = yard();
  const checkout = prepare(arcadia, home);
  writeChange(checkout, 'p', 'proposal.md', '## Open questions\n\n- [ ] one\n');
  const window = openSide(home, [
    cycle('p', 'proposed', {
      labels: ['sdd:cycle', 'sdd:proposed', 'sdd:wait-human'],
      open: true,
      mergeAhead: true,
      dependsOn: ['a'],
    }),
    ticket({key: 'c-1', parent: 'p', queue: 'other', labels: ['sdd:cycle']}),
    ticket({key: 'a', queue: 'other', labels: ['note']}),
  ]);
  const card = columnCards(window.board(), 'accepting')?.find(item => item.key === 'p');
  const line = 'proposed · Ask · вопросы 1 · мерж · дети c-1 · блокеры a';
  assert.equal(card?.reason, line);
  window.openCard('p');
  assert.deepEqual(window.sidebar()[0], {kind: 'reason', line});
  rmSync(dir, {recursive: true, force: true});
});

test('a decision-only card hides the line and the sidebar still shows it', () => {
  const {dir, home, arcadia} = yard();
  const checkout = prepare(arcadia, home);
  writeChange(checkout, '1', 'design.md', '## Open decisions\n\n- [ ] one\n');
  const window = openSide(home, [cycle('1', 'designing')]);
  const card = columnCards(window.board(), 'designing')?.[0];
  assert.equal(card?.phaseRow, 1);
  assert.equal(card?.icon, true);
  assert.equal(card?.reason, undefined);
  window.openCard('1');
  assert.deepEqual(window.sidebar(), [{kind: 'reason', line: 'решения 1'}]);
  rmSync(dir, {recursive: true, force: true});
});

test('a conversation last comment with no marker is in the sidebar unanswered block', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openSide(home, [cycle('1', 'implementing')], {
    review: () => ({
      threads: [{marker: 'code', lines: ['kept out']}],
      conversation: {last: {body: 'please reply'}},
    }),
  });
  window.openCard('1');
  const blocks = window.sidebar();
  assert.deepEqual(blocks, [{kind: 'unanswered', comment: 'please reply'}]);
  assert.equal(JSON.stringify(blocks).includes('kept out'), false);
  rmSync(dir, {recursive: true, force: true});
});

test('the review port returning nothing leaves no sidebar unanswered block', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const silent = openSide(home, [cycle('1', 'implementing')], {review: () => undefined});
  silent.openCard('1');
  assert.deepEqual(silent.sidebar(), []);
  const absent = openSide(home, [cycle('1', 'implementing')]);
  absent.openCard('1');
  assert.deepEqual(absent.sidebar(), []);
  rmSync(dir, {recursive: true, force: true});
});

test('an action point other than before or after keeps its place in the sidebar', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const item = cycle('1', 'implementing', {
    sddHooks: [
      {action: 'other', point: 'during', value: 'stay'},
      {action: 'archive', point: 'before', value: 'one'},
    ],
  });
  const window = openSide(home, [item]);
  window.openCard('1');
  assert.deepEqual(window.sidebar(), [
    {
      kind: 'hook',
      points: [
        {action: 'other', point: 'during', paragraph: 'stay'},
        {action: 'archive', point: 'before', paragraph: 'one'},
      ],
    },
  ]);
  rmSync(dir, {recursive: true, force: true});
});

test('the sidebar shows sddHooks after the field changes', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const item = cycle('1', 'implementing');
  item.sddHooks = [{action: 'archive', point: 'before', value: 'first'}];
  let writes = 0;
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => [item],
      writeAssignee: () => {
        writes += 1;
      },
    },
  );
  window.openCard('1');
  assert.deepEqual(window.sidebar(), [
    {kind: 'hook', points: [{action: 'archive', point: 'before', paragraph: 'first'}]},
  ]);
  item.sddHooks = [{action: 'archive', point: 'before', value: 'second\nline'}];
  assert.deepEqual(window.sidebar(), [
    {kind: 'hook', points: [{action: 'archive', point: 'before', paragraph: 'second\nline'}]},
  ]);
  assert.equal(writes, 0);
  rmSync(dir, {recursive: true, force: true});
});

test('opening a pool card and opening a column card both use sidebar() the same way', () => {
  const {dir, home, arcadia} = yard();
  const checkout = prepare(arcadia, home);
  const body = 'sdd:focus\nPlan gap\nwhy\n';
  const window = openSide(home, [
    cycle('1', 'implementing', {assignee: '', comments: [{body}]}),
    cycle('2', 'implementing', {comments: [{body}]}),
  ]);
  const board = window.board();
  assert.equal(
    board.pool.some(card => card.key === '1'),
    true,
  );
  assert.equal(
    columnCards(board, 'implementing')?.some(card => card.key === '2'),
    true,
  );
  window.openCard('1');
  assert.equal(window.overlay().checkout, checkout);
  const fromPool = window.sidebar();
  window.openCard('2');
  assert.equal(window.overlay().checkout, checkout);
  const fromColumn = window.sidebar();
  assert.deepEqual(fromPool, [
    {
      kind: 'focus',
      marker: 'sdd:focus',
      body: 'Plan gap\nwhy\n',
      display: focusBlockProse('sdd:focus', 'Plan gap\nwhy\n'),
    },
  ]);
  assert.deepEqual(fromColumn, fromPool);
  rmSync(dir, {recursive: true, force: true});
});

test('the sidebar lists the blocks that exist from reason through hook', () => {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const item = cycle('1', 'proposed', {
    labels: ['sdd:cycle', 'sdd:proposed', 'sdd:wait-human'],
    comments: [{body: 'please decide'}, {body: 'sdd:focus\nPlan gap\n'}],
    sddHooks: [{action: 'archive', point: 'before', value: 'keep'}],
  });
  const window = openSide(home, [item], {
    review: () => ({
      threads: [{marker: null, lines: ['please look']}],
      conversation: {last: {marker: 'note', body: 'answered'}},
    }),
  });
  window.openCard('1');
  assert.deepEqual(window.sidebar(), [
    {kind: 'reason', line: 'proposed · Ask'},
    {kind: 'ask', body: 'please decide'},
    {
      kind: 'focus',
      marker: 'sdd:focus',
      body: 'Plan gap\n',
      display: focusBlockProse('sdd:focus', 'Plan gap\n'),
    },
    {kind: 'unanswered', threads: [{lines: ['please look']}]},
    {kind: 'hook', points: [{action: 'archive', point: 'before', paragraph: 'keep'}]},
  ]);
  rmSync(dir, {recursive: true, force: true});
});

function proveTheUserBlockEditsARoleImmediately(): void {
  const {dir, home} = scratch();
  writeFileSync(home, 'watch:\n  - alpha\n');
  const window = openWindow({homePath: home});
  assert.equal(window.settings().open, false);
  window.addRole({name: 'Page', outcome: 'html', text: 'one'});
  assert.equal(homeRoles(home)[0]?.name, 'Page');
  window.renameRole('Page', 'Sheet');
  assert.equal(homeRoles(home)[0]?.name, 'Sheet');
  window.chooseRoleOutcome('Sheet', 'ticket-fields');
  assert.equal(homeRoles(home)[0]?.outcome, 'ticket-fields');
  window.setRoleText('Sheet', 'archive:\n  before: keep\n');
  assert.equal(homeRoles(home)[0]?.text, 'archive:\n  before: keep\n');
  window.setRoleLabels('Sheet', ['sdd:auto-spec', 'sdd:auto-merge']);
  assert.deepEqual(homeRoles(home)[0]?.labels, ['sdd:auto-spec']);
  assert.deepEqual(readHome(home).watch, ['alpha']);
  assert.equal(window.settings().open, false);
  rmSync(dir, {recursive: true, force: true});
}

test('an empty point map does not replace sddHooks', () => {
  for (const text of ['{}\n', 'archive: {}\n', 'archive:\n  before: "   "\n']) {
    const {dir, home, arcadia} = yard();
    prepare(arcadia, home);
    const item = cycle('1', 'implementing', {sddHooks: {archive: {before: 'old'}}});
    let hooks = 0;
    const window = openWindow(
      {homePath: home, adapter: 'tracker'},
      {
        login: () => MANAGER,
        tickets: () => [item],
        editLabels: (_key, add) => {
          item.labels = [...item.labels, ...add];
        },
        writeHooks: () => {
          hooks += 1;
        },
      },
    );
    window.addRole({name: 'Hooks', outcome: 'ticket-fields', text, labels: ['sdd:auto-plan']});
    window.drag('Hooks', '1');
    assert.equal(hooks, 0);
    assert.deepEqual(item.sddHooks, {archive: {before: 'old'}});
    assert.ok(item.labels.includes('sdd:auto-plan'));
    rmSync(dir, {recursive: true, force: true});
  }
});

function proveSeveralPullRequestsWriteNothing(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const item = cycle('1', 'implementing', {openPullRequests: 2});
  const comments: string[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => [item],
      commentPull: (_key, body) => {
        comments.push(body);
      },
    },
  );
  window.addRole({name: 'Note', outcome: 'pull-comment', text: 'ship it'});
  assert.equal(columnCards(window.board(), 'implementing')?.[0]?.icon, true);
  assert.deepEqual(window.drag('Note', '1'), {status: 'комментарий не записан'});
  assert.deepEqual(comments, []);
  rmSync(dir, {recursive: true, force: true});
}

function proveAWriteThatDoesNotFitLeavesThePreviousValue(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const text = 'archive:\n  before: next\n';
  const item = cycle('1', 'implementing', {sddHooks: {archive: {before: 'old'}}});
  let seen = '';
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => [item],
      writeHooks: (_key, next) => {
        seen = next;
      },
    },
  );
  window.addRole({name: 'Wide', outcome: 'ticket-fields', text, labels: ['sdd:auto-plan']});
  window.openCard('1');
  window.drag('Wide', '1');
  assert.equal(seen, text);
  assert.deepEqual(item.sddHooks, {archive: {before: 'old'}});
  assert.deepEqual(window.sidebar(), [
    {kind: 'hook', points: [{action: 'archive', point: 'before', paragraph: 'old'}]},
  ]);
  rmSync(dir, {recursive: true, force: true});
}

function proveTheLastDragWritesItsOwnText(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const item = cycle('1', 'implementing', {sddHooks: {archive: {before: 'old'}}});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => [item],
      writeHooks: (_key, next) => {
        item.sddHooks = parse(next);
      },
    },
  );
  window.addRole({
    name: 'First',
    outcome: 'ticket-fields',
    text: 'archive:\n  before: keep\n',
  });
  window.addRole({
    name: 'Second',
    outcome: 'ticket-fields',
    text: 'create-proposal:\n  after: fresh\n',
  });
  window.openCard('1');
  window.drag('First', '1');
  window.drag('Second', '1');
  assert.deepEqual(window.sidebar(), [
    {kind: 'hook', points: [{action: 'create-proposal', point: 'after', paragraph: 'fresh'}]},
  ]);
  rmSync(dir, {recursive: true, force: true});
}

test('checkouts includes a cycle that stands only in a column', () => {
  const {dir, home, arcadia} = yard();
  try {
    prepare(arcadia, home);
    const other = path.join(arcadia, 'services', 'other');
    writeServiceConfig(other, ['alpha']);
    const window = openWindow(
      {homePath: home, adapter: 'tracker'},
      {
        login: () => MANAGER,
        tickets: () => [
          ticket({
            key: '1',
            queue: 'alpha',
            sddService: 'services/billing',
            title: 'Pool',
          }),
          cycle('2', 'implementing', {sddService: 'services/other', title: 'Column'}),
        ],
      },
    );
    const board = window.board();
    assert.equal(
      board.pool.some(card => card.key === '2'),
      false,
    );
    assert.equal(
      board.pool.some(card => card.checkout?.endsWith(path.join('services', 'other'))),
      false,
    );
    const listed = window.checkouts();
    assert.ok(listed.some(item => item.endsWith(path.join('services', 'billing'))));
    assert.ok(listed.some(item => item.endsWith(path.join('services', 'other'))));
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});

test('the user block edits a role immediately', () => {
  proveTheUserBlockEditsARoleImmediately();
});

test('several open pull requests write nothing', () => {
  proveSeveralPullRequestsWriteNothing();
});

test('a write that does not fit leaves the previous value', () => {
  proveAWriteThatDoesNotFitLeavesThePreviousValue();
});

test('the last drag writes its own text', () => {
  proveTheLastDragWritesItsOwnText();
});

type ThreadPlace = {path: string; line: number; side: 'right' | 'left'};

function hostedAnswer(openPullRequests: number) {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const comments: {key: string; body: string}[] = [];
  const threads: {key: string; body: string; place: ThreadPlace}[] = [];
  const spoken: {key: string; body: string}[] = [];
  const hosts: {
    commentPull: (key: string, body: string) => void;
    threadPull: (key: string, body: string, place: ThreadPlace) => Promise<void>;
    speakPull: (key: string, body: string) => Promise<void>;
  } = {
    commentPull(key, body) {
      comments.push({key, body});
    },
    async threadPull(key, body, place) {
      threads.push({key, body, place});
    },
    async speakPull(key, body) {
      spoken.push({key, body});
    },
  };
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => [cycle('1', 'implementing', {openPullRequests})],
      commentPull: (key, body) => {
        hosts.commentPull(key, body);
      },
      threadPull: (key, body, place) => hosts.threadPull(key, body, place),
      speakPull: (key, body) => hosts.speakPull(key, body),
    },
  );
  return {dir, window, comments, threads, spoken, hosts};
}

test('one open pull request with a path and a line opens a thread', async () => {
  const hosted = hostedAnswer(1);
  try {
    const status = await hosted.window.answer(
      '1',
      '',
      'ответ',
      'строка',
      'src/a.ts',
      '12',
      'right',
    );
    assert.equal(status, undefined);
    assert.deepEqual(hosted.threads, [
      {key: '1', body: 'ответ', place: {path: 'src/a.ts', line: 12, side: 'right'}},
    ]);
    assert.deepEqual(hosted.comments, []);
    assert.deepEqual(hosted.spoken, []);
  } finally {
    rmSync(hosted.dir, {recursive: true, force: true});
  }
});

test('an empty side on a live anchor is the right side', async () => {
  const hosted = hostedAnswer(1);
  try {
    await hosted.window.answer('1', '', 'ответ', 'строка', 'src/a.ts', '12', '');
    assert.deepEqual(hosted.threads, [
      {key: '1', body: 'ответ', place: {path: 'src/a.ts', line: 12, side: 'right'}},
    ]);
  } finally {
    rmSync(hosted.dir, {recursive: true, force: true});
  }
});

test('a left side stays on the left', async () => {
  const hosted = hostedAnswer(1);
  try {
    await hosted.window.answer('1', '', 'ответ', 'строка', 'src/a.ts', '12', 'left');
    assert.deepEqual(hosted.threads, [
      {key: '1', body: 'ответ', place: {path: 'src/a.ts', line: 12, side: 'left'}},
    ]);
  } finally {
    rmSync(hosted.dir, {recursive: true, force: true});
  }
});

test('a refused thread falls back to a quoted conversation comment', async () => {
  const hosted = hostedAnswer(1);
  hosted.hosts.threadPull = async () => {
    throw new Error('host refused the thread');
  };
  try {
    const status = await hosted.window.answer('1', '', 'ответ', 'строка', 'src/a.ts', '4', 'right');
    assert.equal(status, undefined);
    assert.equal(String(status).includes('host refused the thread'), false);
    assert.deepEqual(hosted.spoken, [{key: '1', body: '> строка\n\nответ'}]);
    assert.deepEqual(hosted.comments, []);
  } finally {
    rmSync(hosted.dir, {recursive: true, force: true});
  }
});

test('a refused thread and a refused quote are not written', async () => {
  const hosted = hostedAnswer(1);
  hosted.hosts.threadPull = async () => {
    throw new Error('host refused the thread');
  };
  hosted.hosts.speakPull = async () => {
    throw new Error('host refused the quote');
  };
  try {
    const status = await hosted.window.answer('1', '', 'ответ', 'строка', 'src/a.ts', '4', 'right');
    assert.equal(status, 'комментарий не записан');
    assert.equal(status.includes('host refused'), false);
  } finally {
    rmSync(hosted.dir, {recursive: true, force: true});
  }
});

test('a missing path quotes the line through the conversation', async () => {
  const hosted = hostedAnswer(1);
  try {
    const status = await hosted.window.answer('1', '', 'ответ', 'строка');
    assert.equal(status, undefined);
    assert.deepEqual(hosted.comments, [{key: '1', body: '> строка\n\nответ'}]);
    assert.deepEqual(hosted.threads, []);
    assert.deepEqual(hosted.spoken, []);
  } finally {
    rmSync(hosted.dir, {recursive: true, force: true});
  }
});

test('a path without a whole line number quotes the line', async () => {
  const hosted = hostedAnswer(1);
  try {
    const status = await hosted.window.answer(
      '1',
      '',
      'ответ',
      'строка',
      'src/a.ts',
      '4.2',
      'right',
    );
    assert.equal(status, undefined);
    assert.deepEqual(hosted.comments, [{key: '1', body: '> строка\n\nответ'}]);
    assert.deepEqual(hosted.threads, []);
  } finally {
    rmSync(hosted.dir, {recursive: true, force: true});
  }
});

test('a question ignores the anchor and posts a checklist comment', async () => {
  const hosted = hostedAnswer(1);
  try {
    const status = await hosted.window.answer(
      '1',
      'вопрос',
      'ответ',
      'строка',
      'src/a.ts',
      '12',
      'right',
    );
    assert.equal(status, undefined);
    assert.deepEqual(hosted.comments, [{key: '1', body: '- [ ] вопрос\n\nответ'}]);
    assert.deepEqual(hosted.threads, []);
    assert.deepEqual(hosted.spoken, []);
  } finally {
    rmSync(hosted.dir, {recursive: true, force: true});
  }
});

test('an empty reply names the empty field and calls no host', async () => {
  const hosted = hostedAnswer(1);
  try {
    assert.equal(
      await hosted.window.answer('1', '', '   ', 'строка', 'src/a.ts', '12', 'right'),
      'Комментарий пустой. Напишите его в поле.',
    );
    assert.equal(
      await hosted.window.answer('1', 'вопрос', '', 'строка', 'src/a.ts', '12', 'right'),
      'Ответ пустой. Напишите его в поле.',
    );
    assert.deepEqual(hosted.comments, []);
    assert.deepEqual(hosted.threads, []);
    assert.deepEqual(hosted.spoken, []);
  } finally {
    rmSync(hosted.dir, {recursive: true, force: true});
  }
});

test('zero or two open pull requests write nothing', async () => {
  for (const count of [0, 2]) {
    const hosted = hostedAnswer(count);
    try {
      const status = await hosted.window.answer(
        '1',
        '',
        'ответ',
        'строка',
        'src/a.ts',
        '12',
        'right',
      );
      assert.equal(status, 'комментарий не записан');
      assert.deepEqual(hosted.comments, []);
      assert.deepEqual(hosted.threads, []);
      assert.deepEqual(hosted.spoken, []);
    } finally {
      rmSync(hosted.dir, {recursive: true, force: true});
    }
  }
});
