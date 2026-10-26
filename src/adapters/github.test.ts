import assert from 'node:assert/strict';
import {requirement, scenario, spec} from '@ojson/spec-coverage';
import {test, vi} from 'vitest';

import {
  changesPayload,
  classifyChecks,
  githubAdapters,
  isRestGet,
  linkedTitle,
  linksFrom,
  memoryPorts,
  PULL_LIST_FRESH_MS,
  pullRangeArgs,
  readRest,
  resetMillis,
  restAnswer,
  threadRecord,
  withRestValidators,
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

test('the pull range is the REST head and base commits', () => {
  assert.deepEqual(pullRangeArgs('acme/billing', '11'), [
    'api',
    'repos/acme/billing/pulls/11',
    '--jq',
    '{head: .head.sha, base: .base.sha}',
  ]);
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

function viewedIssue(
  number: number,
  login?: string,
  labels: {name: string}[] = [],
): string {
  return JSON.stringify({
    number,
    title: 't',
    body: '',
    state: 'OPEN',
    labels,
    assignees: login ? [{login}] : [],
  });
}

function issueRead(number: number, fields: string | Error, login?: string) {
  return async (args: string[]) => {
    if (args.join(' ').includes('issue-field-values')) {
      if (fields instanceof Error) {
        throw fields;
      }
      return fields;
    }
    if (args[0] === 'issue' && args[1] === 'view') {
      return viewedIssue(number, login);
    }
    if (args.join(' ').includes('/issues?state=open')) {
      return `[${viewedIssue(number, login)}]`;
    }
    throw new Error(args.join(' '));
  };
}

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
        return viewedIssue(7, 'me');
      }
      if (args.join(' ').includes('/issues?state=open')) {
        return `[${viewedIssue(7, 'me', [{name: 'sdd:cycle'}])}]`;
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

test('a failed organization field read leaves sddHooks absent', async () => {
  const {tracker} = githubAdapters({run: issueRead(7, new Error('404'))});
  const absent = await tracker.issue('7');
  assert.equal('sddHooks' in absent, false);
});

test('blank organization text is an empty cycle field', async () => {
  const {tracker} = githubAdapters({
    run: issueRead(8, JSON.stringify([{issue_field_name: 'sddHooks', data_type: 'text', value: '   '}])),
  });
  assert.equal((await tracker.issue('8')).sddHooks, '');
});

test('organization text that is not a map stays text', async () => {
  const {tracker} = githubAdapters({
    run: issueRead(9, JSON.stringify([{issue_field_name: 'sddHooks', data_type: 'text', value: 'not: [a map'}])),
  });
  assert.equal((await tracker.issue('9')).sddHooks, 'not: [a map');
});

test('a cycle field of only spaces has no points', async () => {
  const {tracker} = githubAdapters({
    run: issueRead(
      10,
      JSON.stringify([{issue_field_name: 'sddHooks', data_type: 'text', value: 'archive:\n  after: "   "\n'}]),
    ),
  });
  assert.deepEqual((await tracker.issue('10')).sddHooks, {});
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

spec('spec-diff', () => {
  requirement('GitHub sends the side of the thread', () => {
    scenario('A plain right-side thread is unmarked', async () => {
      const calls: string[][] = [];
      const {review} = githubAdapters({
        run: async args => {
          calls.push(args);
          return '';
        },
      });
      await review.openThread('15', {
        commit: 'abc',
        path: 'src/a.ts',
        line: 4,
        body: 'смотрите сюда',
        plain: true,
        side: 'right',
      });
      await review.openThread('15', {
        commit: 'abc',
        path: 'src/a.ts',
        line: 4,
        body: 'смотрите сюда',
        plain: true,
        side: 'left',
      });
      await review.openThread('15', {
        commit: 'abc',
        path: 'src/a.ts',
        line: 1,
        body: 'sdd:note baseline',
      });
      const right = calls[0] ?? [];
      const left = calls[1] ?? [];
      const marked = calls[2] ?? [];
      assert.equal(right.includes('side=RIGHT'), true);
      assert.equal(right.includes('body=смотрите сюда'), true);
      assert.equal(
        right.some(arg => arg.includes('🤖')),
        false,
      );
      assert.equal(left.includes('side=LEFT'), true);
      assert.equal(marked.includes('body=🤖 sdd:note baseline'), true);
      assert.equal(
        marked.some(arg => arg.startsWith('side=')),
        false,
      );
    });
  });
});

spec('github-read', () => {
  requirement('The cycle field is read for a cycle', () => {
    scenario('An issue without the cycle label skips the field', async () => {
      const calls: string[] = [];
      const {tracker} = githubAdapters({
        run: async args => {
          calls.push(args.join(' '));
          if (args.join(' ').includes('/issues?state=open')) {
            return JSON.stringify([
              {
                number: 7,
                title: 't',
                body: '',
                state: 'OPEN',
                labels: [{name: 'sdd:cycle'}],
                assignees: [],
              },
              {
                number: 8,
                title: 'u',
                body: '',
                state: 'OPEN',
                labels: [{name: 'bug'}],
                assignees: [],
              },
            ]);
          }
          if (args.join(' ').includes('issues/7/issue-field-values')) {
            return JSON.stringify([
              {issue_field_name: 'sddHooks', data_type: 'text', value: 'archive:\n  before: keep\n'},
            ]);
          }
          throw new Error(args.join(' '));
        },
      });
      const open = await tracker.listOpen();
      const cycle = open.find(issue => issue.key === '7');
      const other = open.find(issue => issue.key === '8');
      assert.deepEqual(cycle?.sddHooks, {archive: {before: 'keep'}});
      assert.equal(other !== undefined && 'sddHooks' in other, false);
      assert.equal(
        calls.some(call => call.includes('issues/7/issue-field-values')),
        true,
      );
      assert.equal(
        calls.some(call => call.includes('issues/8/issue-field-values')),
        false,
      );
    });
  });

  requirement('One pull view carries checks and commits', () => {
    scenario('Checks and the two commits come from one view', async () => {
      const calls: string[][] = [];
      const {review} = githubAdapters({
        run: async args => {
          calls.push(args);
          if (args[0] === 'pr' && args[1] === 'list' && args.includes('merged')) {
            return '[]';
          }
          if (args[0] === 'pr' && args[1] === 'list') {
            return JSON.stringify([
              {number: 11, title: '#7: change', state: 'OPEN'},
              {number: 12, title: '#12: change', state: 'OPEN'},
            ]);
          }
          if (args[0] === 'pr' && args[1] === 'view' && args.includes('11')) {
            return JSON.stringify({
              state: 'OPEN',
              statusCheckRollup: [],
              headRefOid: 'aaa',
              baseRefOid: 'bbb',
            });
          }
          if (args[0] === 'pr' && args[1] === 'view' && args.includes('12')) {
            return JSON.stringify({state: 'OPEN', statusCheckRollup: []});
          }
          if (args.join(' ').includes('pulls/12')) {
            return JSON.stringify({head: 'ccc', base: 'ddd'});
          }
          throw new Error(args.join(' '));
        },
      });
      assert.equal((await review.pulls('7'))[0]?.checks, 'none');
      assert.deepEqual(await review.range('11'), {head: 'aaa', base: 'bbb'});
      const views = calls.filter(args => args[0] === 'pr' && args[1] === 'view');
      assert.equal(views.length, 1);
      assert.match(views[0]?.join(' ') ?? '', /headRefOid/);
      assert.match(views[0]?.join(' ') ?? '', /baseRefOid/);
      assert.equal(
        calls.some(args => args.join(' ').includes('pulls/11')),
        false,
      );
      assert.equal((await review.pulls('12'))[0]?.checks, 'none');
      assert.deepEqual(await review.range('12'), {head: 'ccc', base: 'ddd'});
      assert.equal(
        calls.filter(args => args.join(' ').includes('pulls/12')).length,
        1,
      );
    });

    scenario('A client without the base field still reads the pull request', async () => {
      const calls: string[][] = [];
      const {review} = githubAdapters({
        run: async args => {
          calls.push(args);
          const joined = args.join(' ');
          if (args[0] === 'pr' && args[1] === 'list' && args.includes('merged')) {
            return '[]';
          }
          if (args[0] === 'pr' && args[1] === 'list') {
            return JSON.stringify([{number: 11, title: '#7: change', state: 'OPEN'}]);
          }
          if (args[0] === 'pr' && args[1] === 'view' && joined.includes('baseRefOid')) {
            throw Object.assign(new Error('gh exited 1'), {
              stderr: 'Unknown JSON field: "baseRefOid"\n',
              stdout: '',
            });
          }
          if (args[0] === 'pr' && args[1] === 'view') {
            return JSON.stringify({state: 'OPEN', statusCheckRollup: [], headRefOid: 'aaa'});
          }
          if (joined.includes('pulls/11')) {
            return JSON.stringify({head: 'aaa', base: 'bbb'});
          }
          throw new Error(joined);
        },
      });
      assert.equal((await review.pulls('7'))[0]?.checks, 'none');
      assert.deepEqual(await review.range('11'), {head: 'aaa', base: 'bbb'});
      assert.equal(calls.filter(args => args.join(' ').includes('pulls/11')).length, 1);
      assert.deepEqual(await review.range('11'), {head: 'aaa', base: 'bbb'});
      assert.equal(calls.filter(args => args.join(' ').includes('pulls/11')).length, 1);
    });
  });

  requirement('Open pull requests are one repository list', () => {
    scenario('Two issues share one open list', async () => {
      const calls: string[][] = [];
      const {review} = githubAdapters({
        run: async args => {
          calls.push(args);
          if (args[0] === 'pr' && args[1] === 'list' && args.includes('open')) {
            return JSON.stringify([
              {number: 11, title: '#7: change', state: 'OPEN'},
              {number: 12, title: '#8: other', state: 'OPEN'},
              {number: 13, title: 'unrelated', state: 'OPEN'},
            ]);
          }
          if (args[0] === 'pr' && args[1] === 'list' && args.includes('merged')) {
            return '[]';
          }
          if (args[0] === 'pr' && args[1] === 'view') {
            return JSON.stringify({state: 'OPEN', statusCheckRollup: [], headRefOid: 'a', baseRefOid: 'b'});
          }
          throw new Error(args.join(' '));
        },
      });
      const seven = await review.pulls('7');
      const eight = await review.pulls('8');
      const openLists = calls.filter(
        args => args[0] === 'pr' && args[1] === 'list' && args.includes('open'),
      );
      assert.equal(openLists.length, 1);
      assert.equal(
        calls.some(args => args.includes('--search')),
        false,
      );
      assert.deepEqual(
        seven.map(pull => pull.id),
        ['11'],
      );
      assert.deepEqual(
        eight.map(pull => pull.id),
        ['12'],
      );
    });

    scenario('A merged pull request stays on the issue', async () => {
      const {review} = githubAdapters({
        run: async args => {
          if (args[0] === 'pr' && args[1] === 'list' && args.includes('merged')) {
            return JSON.stringify([{number: 9, title: '#7: old', state: 'MERGED'}]);
          }
          if (args[0] === 'pr' && args[1] === 'list') {
            return '[]';
          }
          throw new Error(args.join(' '));
        },
      });
      const pulls = await review.pulls('7');
      assert.equal(pulls[0]?.id, '9');
      assert.equal(pulls[0]?.state, 'MERGED');
    });

    scenario('The open list is read again after it ages', async () => {
      vi.useFakeTimers();
      let openLists = 0;
      const {review} = githubAdapters({
        run: async args => {
          if (args[0] === 'pr' && args[1] === 'list' && args.includes('open')) {
            openLists += 1;
            return '[]';
          }
          if (args[0] === 'pr' && args[1] === 'list' && args.includes('merged')) {
            return '[]';
          }
          throw new Error(args.join(' '));
        },
      });
      try {
        await review.pulls('7');
        await review.pulls('8');
        assert.equal(openLists, 1);
        await vi.advanceTimersByTimeAsync(PULL_LIST_FRESH_MS);
        await review.pulls('7');
        assert.equal(openLists, 2);
      } finally {
        vi.useRealTimers();
      }
    });

    scenario('A created pull request asks for the open list again', async () => {
      let openLists = 0;
      const {review} = githubAdapters({
        run: async args => {
          if (args[0] === 'pr' && args[1] === 'list' && args.includes('open')) {
            openLists += 1;
            return '[]';
          }
          if (args[0] === 'pr' && args[1] === 'list' && args.includes('merged')) {
            return '[]';
          }
          if (args[0] === 'pr' && args[1] === 'create') {
            return 'https://github.com/acme/billing/pull/15\n';
          }
          throw new Error(args.join(' '));
        },
      });
      assert.equal(await review.ensurePull('7', '#7: change', 'body'), '15');
      const afterCreate = openLists;
      await review.pulls('7');
      assert.ok(openLists > afterCreate);
    });
  });

  requirement('A repeated REST read sends the previous validator', () => {
    scenario('A repeated REST read sends the previous validator', () => {
      const ok = ['HTTP/2.0 200 OK', 'etag: W/"abc"', '', '[]'].join('\n');
      const same = ['HTTP/2.0 304 Not Modified', 'etag: W/"abc"', '', ''].join('\n');
      const first = readRest(ok);
      assert.equal(first.store?.etag, 'W/"abc"');
      assert.equal(first.store?.body, '[]');
      const sent = withRestValidators(
        ['api', 'repos/acme/billing/issues/7/comments'],
        first.store?.etag,
      );
      assert.equal(sent.includes('-i'), true);
      assert.equal(sent.includes('If-None-Match: W/"abc"'), true);
      assert.equal(isRestGet(['api', 'user', '--jq', '.login']), false);
      assert.equal(isRestGet(['api', 'graphql', '-f', 'query=x']), false);
      const again = readRest(same);
      assert.equal(again.notModified, true);
      assert.equal(restAnswer(again, first.store), '[]');
    });
  });

  requirement('A spent rate limit pauses polling', () => {
    scenario('A nameless rate limit reads the reset resource', () => {
      assert.equal(
        resetMillis(JSON.stringify({resources: {core: {reset: 1_793_005_596}}})),
        1_793_005_596_000,
      );
      assert.equal(resetMillis('not json'), undefined);
    });
  });
});
