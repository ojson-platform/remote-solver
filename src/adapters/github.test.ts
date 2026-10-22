import assert from 'node:assert/strict';
import {test} from 'vitest';

import {
  changesPayload,
  classifyChecks,
  githubAdapters,
  linkedTitle,
  linksFrom,
  memoryPorts,
  threadRecord,
  type CheckRollup,
} from './github.ts';
import {setPhase} from '../machine/labels.ts';
import {loadCycle} from '../machine/snapshot.ts';
import type {FileSource} from '../machine/port.ts';

function rollup(over: Partial<CheckRollup> = {}): CheckRollup {
  return {state: 'OPEN', statusCheckRollup: [], ...over};
}

const files: FileSource = {exists: () => false, read: () => '', list: () => []};

test('a review requests changes on a line, a file, or the review body', () => {
  assert.deepEqual(
    changesPayload('abc', [
      {body: 'on the line', path: 'src/cache.ts', line: 13},
      {body: 'on the file', path: 'CONTRIBUTING.md'},
      {body: 'commit message'},
    ]),
    {
      commit_id: 'abc',
      event: 'REQUEST_CHANGES',
      body: '',
      comments: [
        {path: 'src/cache.ts', body: 'on the line', line: 13, side: 'RIGHT'},
        {path: 'CONTRIBUTING.md', body: 'on the file', subject_type: 'file'},
      ],
    },
  );
  assert.equal(changesPayload('abc', [{body: 'commit message'}]).body, 'commit message');
});

test('a merged pull request is green', () => {
  assert.equal(classifyChecks(rollup({state: 'MERGED'})), 'green');
});

test('a named check is red, pending, or missing on its own', () => {
  const view = rollup({
    statusCheckRollup: [
      {name: 'units', conclusion: 'SUCCESS', status: 'COMPLETED'},
      {name: 'audit', status: 'IN_PROGRESS'},
    ],
  });
  assert.equal(classifyChecks(view), 'pending');
  assert.equal(classifyChecks(view, 'audit'), 'pending');
  assert.equal(classifyChecks(rollup({statusCheckRollup: [{name: 'units', conclusion: 'FAILURE'}]}), 'units'), 'red');
  assert.equal(classifyChecks(view, 'missing'), 'none');
});

test('a completed rollup with no pending check is green', () => {
  assert.equal(
    classifyChecks(rollup({statusCheckRollup: [{name: 'units', conclusion: 'SUCCESS', status: 'COMPLETED'}]})),
    'green',
  );
});

test('parent and depends are read from the issue body', () => {
  assert.deepEqual(linksFrom('Parent: #LAVKA-1\nDepends: #LAVKA-2\nDepends: #9\n'), {
    parent: 'LAVKA-1',
    dependsOn: ['LAVKA-2', '9'],
  });
});

test('a pull title links to an issue only with the key prefix', () => {
  assert.equal(linkedTitle('7', '#7: change'), true);
  assert.equal(linkedTitle('7', '#7 leftover'), true);
  assert.equal(linkedTitle('7', 'unrelated'), false);
  assert.equal(linkedTitle('7', '#70: other'), false);
});

test('a thread record carries the handles a skill replies and resolves with', () => {
  assert.deepEqual(
    threadRecord({
      id: 'PRRT_1',
      isResolved: false,
      path: 'src/a.ts',
      line: 7,
      comments: {nodes: [{databaseId: 4094804166, author: {login: 'me'}, body: 'why?'}]},
    }),
    {id: 'PRRT_1', comment: '4094804166', path: 'src/a.ts', line: 7, resolved: false, body: 'why?'},
  );
  const empty = threadRecord({id: 'PRRT_2', isResolved: true, path: 'f', line: null, comments: {nodes: []}});
  assert.deepEqual(empty, {id: 'PRRT_2', comment: '', path: 'f', line: null, resolved: true, body: ''});
});

test('memory ports serve thread records from a plain thread seed', async () => {
  const {review} = memoryPorts({threads: {5: [{resolved: false, body: 'sdd:layer=spec'}]}});
  assert.deepEqual(await review.threadList('5'), [
    {resolved: false, body: 'sdd:layer=spec', id: 'T1', comment: 'C1', path: '', line: null},
  ]);
  assert.deepEqual(await review.threads('5'), [{resolved: false, body: 'sdd:layer=spec'}]);
});

test('loadCycle keeps marker grammar above the port', async () => {
  const {tracker, review, calls} = memoryPorts({
    user: 'robot',
    issues: [
      {
        key: '7',
        title: '#7: title',
        body: 'Parent: #1\n',
        state: 'OPEN',
        labels: ['Sandcastle', 'sdd:cycle', 'sdd:implementing'],
      },
    ],
    pulls: {
      7: [{id: '71', title: '#7: change', state: 'OPEN'}],
    },
    threads: {
      71: [{resolved: false, body: 'sdd:layer=spec → specifying'}],
    },
    comments: {
      71: [{robot: false, body: 'hello'}],
    },
  });
  const snapshot = await loadCycle(tracker, review, () => files, [{name: 'Sandcastle'}]);
  const pulls = snapshot.pulls.get('7') ?? [];
  assert.deepEqual(
    pulls.map(pr => pr.id),
    ['71'],
  );
  assert.equal(pulls[0].review.rollback, 'specifying');
  assert.equal(pulls[0].review.unanswered, true);
  assert.equal(snapshot.cycles[0].parent, '1');
  assert.equal(calls.filter(call => call === 'listOpen').length, 1);
});

test('setPhase keeps a single phase label and refuses a gate label', async () => {
  const {tracker} = memoryPorts({
    issues: [
      {
        key: '7',
        title: '#7: title',
        body: '',
        state: 'OPEN',
        labels: ['Sandcastle', 'sdd:proposing', 'sdd:designing'],
      },
    ],
  });
  await setPhase('7', 'specifying', tracker);
  assert.deepEqual(await tracker.labels('7'), ['Sandcastle', 'sdd:specifying']);
  await assert.rejects(setPhase('7', 'proposed', tracker), /gate label sdd:proposed/);
});

test('an organization issue field named sddHooks is the cycle field', async () => {
  const calls: string[] = [];
  const yaml = 'archive:\n  before: keep\n  after: "   "\n';
  const {tracker} = githubAdapters({
    run: async (args, input) => {
      calls.push(`${args.join(' ')}${input ? ` <${input}>` : ''}`);
      const joined = args.join(' ');
      if (joined.includes('issue-field-values')) {
        return JSON.stringify([
          {issue_field_name: 'other', data_type: 'text', value: 'no'},
          {issue_field_name: 'sddHooks', data_type: 'number', value: 1},
          {issue_field_name: 'sddHooks', data_type: 'text', value: yaml},
        ]);
      }
      if (args[0] === 'issue' && args[1] === 'view') {
        return JSON.stringify({
          number: 7,
          title: 't',
          body: '',
          state: 'OPEN',
          labels: [],
          assignees: [{login: 'me'}],
        });
      }
      if (args[0] === 'issue' && args[1] === 'list') {
        return JSON.stringify([
          {number: 7, title: 't', body: '', state: 'OPEN', labels: [], assignees: [{login: 'me'}]},
        ]);
      }
      throw new Error(joined);
    },
  });
  const record = await tracker.issue('7');
  assert.deepEqual(record.sddHooks, {archive: {before: 'keep'}});
  assert.deepEqual((await tracker.listOpen())[0]?.sddHooks, {archive: {before: 'keep'}});
  assert.equal(
    calls.some(call => call.includes('repos/ojson-platform/remote-solver/issues/7/issue-field-values')),
    true,
  );
  assert.equal(
    calls.some(call => call.includes('POST') || call.includes('<')),
    false,
  );
});

test('a missing or unreadable organization field does not create sddHooks', async () => {
  const missing = githubAdapters({
    run: async args => {
      if (args.join(' ').includes('issue-field-values')) {
        throw new Error('404');
      }
      return JSON.stringify({
        number: 7,
        title: 't',
        body: '',
        state: 'OPEN',
        labels: [],
        assignees: [],
      });
    },
  });
  const absent = await missing.tracker.issue('7');
  assert.equal('sddHooks' in absent, false);

  const blank = githubAdapters({
    run: async args => {
      if (args.join(' ').includes('issue-field-values')) {
        return JSON.stringify([{issue_field_name: 'sddHooks', data_type: 'text', value: '   '}]);
      }
      return JSON.stringify({
        number: 8,
        title: 't',
        body: '',
        state: 'OPEN',
        labels: [],
        assignees: [],
      });
    },
  });
  assert.equal((await blank.tracker.issue('8')).sddHooks, '');

  const prose = githubAdapters({
    run: async args => {
      if (args.join(' ').includes('issue-field-values')) {
        return JSON.stringify([{issue_field_name: 'sddHooks', data_type: 'text', value: 'not: [a map'}]);
      }
      return JSON.stringify({
        number: 9,
        title: 't',
        body: '',
        state: 'OPEN',
        labels: [],
        assignees: [],
      });
    },
  });
  assert.equal((await prose.tracker.issue('9')).sddHooks, 'not: [a map');

  const spaces = githubAdapters({
    run: async args => {
      if (args.join(' ').includes('issue-field-values')) {
        return JSON.stringify([
          {issue_field_name: 'sddHooks', data_type: 'text', value: 'archive:\n  after: "   "\n'},
        ]);
      }
      return JSON.stringify({
        number: 10,
        title: 't',
        body: '',
        state: 'OPEN',
        labels: [],
        assignees: [],
      });
    },
  });
  assert.deepEqual((await spaces.tracker.issue('10')).sddHooks, {});
});

test('a focus comment stays sdd:focus on the first line', async () => {
  const {tracker, calls} = memoryPorts({
    user: '3y3',
    issues: [{key: '7', title: '#7: title', body: '', state: 'OPEN', labels: []}],
  });
  await tracker.comment('7', 'sdd:focus\nChange solid\n');
  assert.equal(calls.includes('body:sdd:focus\nChange solid\n'), true);
  assert.equal(
    calls.some(call => call.startsWith('body:🤖 sdd:focus')),
    false,
  );
  assert.equal((await tracker.comments('7'))[0]?.body.startsWith('sdd:focus\n'), true);
});

test('posted bodies carry the spy mark, and the shared login is not the robot', async () => {
  const {tracker, review, calls} = memoryPorts({
    user: '3y3',
    issues: [{key: '7', title: '#7: title', body: '', state: 'OPEN', labels: []}],
  });
  await tracker.comment('7', 'sdd:accept proposal accepted by @3y3');
  await review.openThread('15', {commit: 'abc', path: 'src/a.ts', line: 1, body: 'sdd:note baseline'});
  await review.reply('15', '9', 'sdd:fixed abc');
  await review.say('15', 'sdd:layer=code → implementing');
  await review.speak('15', 'rebase onto master');
  await tracker.close('7', 'SDLC accepted');
  assert.deepEqual(
    calls.filter(call => call.startsWith('body:')),
    [
      'body:🤖 sdd:accept proposal accepted by @3y3',
      'body:🤖 sdd:note baseline',
      'body:🤖 sdd:fixed abc',
      'body:🤖 sdd:layer=code → implementing',
      'body:rebase onto master',
      'body:🤖 SDLC accepted',
    ],
  );
});
