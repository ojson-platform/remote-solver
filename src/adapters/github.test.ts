import assert from 'node:assert/strict';
import {rmSync} from 'node:fs';
import {requirement, scenario, spec} from '@ojson/spec-coverage';
import {test, vi} from 'vitest';

import {
  changesPayload,
  classifyChecks,
  clearGithubPause,
  gh,
  ghErrorLine,
  githubAdapters,
  isRestGet,
  linkedTitle,
  memoryPorts,
  noteGithubPause,
  PULL_LIST_FRESH_MS,
  pullRangeArgs,
  readRest,
  resetMillis,
  restAnswer,
  threadRecord,
  withRestValidators,
  type CheckRollup,
} from './github.ts';
import {linkIssue} from '../sdd.ts';
import {setPhase} from '../machine/labels.ts';
import {loadCycle} from '../machine/snapshot.ts';
import type {FileSource} from '../machine/port.ts';
import {REFRESH_MS, serveLiveBoard} from '../window/live.ts';
import {yard} from '../window/live.harness.ts';

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
    {
      id: 'PRRT_1',
      comment: '4094804166',
      path: 'src/a.ts',
      line: 7,
      resolved: false,
      body: 'why?',
      comments: ['why?'],
    },
  );
  const empty = threadRecord({id: 'PRRT_2', isResolved: true, path: 'f', line: null, comments: {nodes: []}});
  assert.deepEqual(empty, {
    id: 'PRRT_2',
    comment: '',
    path: 'f',
    line: null,
    resolved: true,
    body: '',
    comments: [],
  });
});

spec('thread-line', () => {
  requirement('Each review thread stands on the line it anchors', () => {
    scenario('A thread that is already on the pull request is visible this way', () => {
      assert.deepEqual(
        threadRecord({
          id: 'PRRT_3',
          isResolved: false,
          path: 'openspec/changes/issue-49/tasks.md',
          line: 4,
          comments: {
            nodes: [
              {databaseId: 1, author: {login: 'human'}, body: 'sdd:layer=spec → specifying'},
              {databaseId: 2, author: {login: 'robot'}, body: 'sdd:fixed abc123'},
            ],
          },
        }),
        {
          id: 'PRRT_3',
          comment: '2',
          path: 'openspec/changes/issue-49/tasks.md',
          line: 4,
          resolved: false,
          body: 'sdd:fixed abc123',
          comments: ['sdd:layer=spec → specifying', 'sdd:fixed abc123'],
        },
      );
    });
  });
});

test('threadList drops ignored-only threads and keeps a person with a later ignored fixed reply', async () => {
  const calls: string[][] = [];
  const {review} = githubAdapters({
    ignoreComments: [/^dependabot$/],
    run: async args => {
      calls.push(args);
      const joined = args.join(' ');
      if (joined.includes('reviewThreads')) {
        return JSON.stringify({
          data: {
            repository: {
              pullRequest: {
                reviewThreads: {
                  nodes: [
                    {
                      id: 'PRRT_ignored',
                      isResolved: false,
                      path: 'a.ts',
                      line: 1,
                      comments: {
                        nodes: [{databaseId: 9, author: {login: 'dependabot'}, body: 'noise'}],
                      },
                    },
                    {
                      id: 'PRRT_stays',
                      isResolved: false,
                      path: 'b.ts',
                      line: 2,
                      comments: {
                        nodes: [
                          {databaseId: 10, author: {login: 'human'}, body: 'sdd:layer=code'},
                          {databaseId: 11, author: {login: 'dependabot'}, body: 'sdd:fixed deadbeef'},
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        });
      }
      throw new Error(joined);
    },
  });
  const listed = await review.threadList('58');
  assert.match(calls.find(args => args.join(' ').includes('reviewThreads'))?.join(' ') ?? '', /comments\(first:100\)/);
  assert.deepEqual(listed, [
    {
      id: 'PRRT_stays',
      comment: '11',
      path: 'b.ts',
      line: 2,
      resolved: false,
      body: 'sdd:fixed deadbeef',
      comments: ['sdd:layer=code', 'sdd:fixed deadbeef'],
    },
  ]);
});

test('memory ports serve thread records from a plain thread seed', async () => {
  const {review} = memoryPorts({threads: {5: [{resolved: false, body: 'sdd:layer=spec'}]}});
  assert.deepEqual(await review.threadList('5'), [
    {
      resolved: false,
      body: 'sdd:layer=spec',
      id: 'T1',
      comment: 'C1',
      path: '',
      line: null,
      comments: ['sdd:layer=spec'],
    },
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
        body: '',
        state: 'OPEN',
        labels: ['Sandcastle', 'sdd:cycle', 'sdd:implementing'],
        parent: '1',
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
  body = '',
): string {
  return JSON.stringify({
    number,
    title: 't',
    body,
    state: 'OPEN',
    labels,
    assignees: login ? [{login}] : [],
  });
}

function answerGithubGraphql(args: string[]): string | undefined {
  const joined = args.join(' ');
  if (!joined.includes('graphql')) {
    return undefined;
  }
  if (joined.includes('parent{number}')) {
    return githubLinkGraph({});
  }
  if (joined.includes('{id}')) {
    const number = joined.match(/number=(\d+)/)?.[1] ?? '0';
    return githubNodeId(`ID-${number}`);
  }
  return undefined;
}

function issueRead(number: number, fields: string | Error, login?: string) {
  return async (args: string[]) => {
    const graph = answerGithubGraphql(args);
    if (graph !== undefined) {
      return graph;
    }
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
      const graph = answerGithubGraphql(args);
      if (graph !== undefined) {
        return graph;
      }
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

test('a phase focus comment stays sdd:focus:plan on the first line', async () => {
  const {tracker, calls} = memoryPorts({
    user: '3y3',
    issues: [{key: '7', title: '#7: title', body: '', state: 'OPEN', labels: []}],
  });
  await tracker.comment('7', 'sdd:focus:plan\nPlan prose.\n');
  assert.equal(calls.includes('body:sdd:focus:plan\nPlan prose.\n'), true);
  assert.equal(
    calls.some(call => call.startsWith('body:🤖 sdd:focus:plan')),
    false,
  );
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

function githubLinkGraph(issue: {
  parent?: number | null;
  blockedBy?: number[];
  blocking?: number[];
}): string {
  return JSON.stringify({
    data: {
      repository: {
        issue: {
          parent: issue.parent === undefined || issue.parent === null ? null : {number: issue.parent},
          blockedBy: {nodes: (issue.blockedBy ?? []).map(number => ({number}))},
          blocking: {nodes: (issue.blocking ?? []).map(number => ({number}))},
        },
      },
    },
  });
}

function githubNodeId(id: string): string {
  return JSON.stringify({data: {repository: {issue: {id}}}});
}

spec('dependencies', () => {
  requirement('Host issue links are the child and the blocker', () => {
    scenario('The machine reads parent, blocks, blocked-by, and depends-on from the host\'s own issue links', async () => {
      const calls: string[] = [];
      const {tracker} = githubAdapters({
        run: async args => {
          calls.push(args.join(' '));
          const joined = args.join(' ');
          if (joined.includes('graphql') && joined.includes('parent{number}')) {
            return githubLinkGraph({parent: 1, blockedBy: [8], blocking: [9]});
          }
          if (args[0] === 'issue' && args[1] === 'view') {
            return viewedIssue(7, 'me');
          }
          if (joined.includes('/issues?state=open')) {
            return `[${viewedIssue(7, 'me', [{name: 'sdd:cycle'}])}]`;
          }
          if (joined.includes('issue-field-values')) {
            return '[]';
          }
          throw new Error(joined);
        },
      });
      const record = await tracker.issue('7');
      assert.equal(record.parent, '1');
      assert.deepEqual(record.blockedBy, ['8']);
      assert.deepEqual(record.blocks, ['9']);
      assert.deepEqual(record.dependsOn, []);
      const withBody = await tracker.issue('7');
      assert.equal(withBody.parent, '1');
    });

    scenario('It writes those links when the flow creates a child cycle or a dependency, and it does not write a body line', async () => {
      const calls: string[][] = [];
      const {tracker} = githubAdapters({
        run: async args => {
          calls.push(args);
          const joined = args.join(' ');
          if (joined.includes('graphql') && joined.includes('addSubIssue')) {
            return '{}';
          }
          const graph = answerGithubGraphql(args);
          if (graph !== undefined) {
            return graph;
          }
          throw new Error(joined);
        },
      });
      await tracker.link('2', 'parent', '1');
      const edits = calls.filter(args => args[0] === 'issue' && args[1] === 'edit');
      assert.equal(edits.length, 0);
      assert.equal(
        calls.some(args => args.join(' ').includes('addSubIssue')),
        true,
      );
    });

    scenario('The flow that opens a child cycle or a dependency writes the host link and does not write a body line', async () => {
      const {tracker, calls} = memoryPorts({
        issues: [{key: '2', title: '#2: title', body: 'unchanged\n', state: 'OPEN', labels: []}],
      });
      await linkIssue({key: '2', kind: 'parent', other: '1'}, tracker);
      assert.equal(calls.includes('link:parent:1'), true);
      assert.equal(calls.includes('updateBody'), false);
      assert.equal((await tracker.issue('2')).body, 'unchanged\n');
      assert.equal((await tracker.issue('2')).parent, '1');
    });

    scenario('A parent link is a child: an open cycle issue this issue is the parent of', async () => {
      const {tracker} = memoryPorts({
        issues: [
          {key: '1', title: '#1: title', body: 'Parent: #9\n', state: 'OPEN', labels: ['sdd:cycle']},
          {key: '2', title: '#2: title', body: '', state: 'OPEN', labels: ['sdd:cycle'], parent: '1'},
        ],
      });
      const child = await tracker.issue('2');
      assert.equal(child.parent, '1');
      const parent = await tracker.issue('1');
      assert.equal(parent.parent, undefined);
    });

    scenario('A blocked-by link and a depends-on link are blockers: issues this issue waits on', async () => {
      const {tracker} = githubAdapters({
        run: async args => {
          if (args.join(' ').includes('parent{number}')) {
            return githubLinkGraph({blockedBy: [8, 10]});
          }
          if (args[0] === 'issue' && args[1] === 'view') {
            return viewedIssue(7, 'me', [], 'Depends: #99\n');
          }
          if (args.join(' ').includes('issue-field-values')) {
            return '[]';
          }
          throw new Error(args.join(' '));
        },
      });
      const record = await tracker.issue('7');
      assert.deepEqual(record.blockedBy, ['8', '10']);
      assert.deepEqual(record.dependsOn, []);
    });

    scenario('A blocks link is the other side and does not hold this issue', async () => {
      const {tracker} = githubAdapters({
        run: async args => {
          if (args.join(' ').includes('parent{number}')) {
            return githubLinkGraph({blocking: [3]});
          }
          if (args[0] === 'issue' && args[1] === 'view') {
            return viewedIssue(7, 'me');
          }
          if (args.join(' ').includes('issue-field-values')) {
            return '[]';
          }
          throw new Error(args.join(' '));
        },
      });
      const record = await tracker.issue('7');
      assert.deepEqual(record.blocks, ['3']);
      assert.deepEqual(record.blockedBy, []);
    });

    scenario('One issue on two of these links counts once for the wait', async () => {
      const {tracker} = memoryPorts({
        issues: [
          {
            key: '1',
            title: '#1: title',
            body: '',
            state: 'OPEN',
            labels: ['sdd:implementing'],
            parent: '9',
            blockedBy: ['9'],
            dependsOn: [],
          },
        ],
      });
      const record = await tracker.issue('1');
      assert.equal(record.parent, '9');
      assert.deepEqual(record.blockedBy, ['9']);
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
          const graph = answerGithubGraphql(args);
          if (graph !== undefined) {
            return graph;
          }
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
      assert.equal((await review.pulls('12'))[0]?.conflict, false);
      assert.deepEqual(await review.range('12'), {head: 'ccc', base: 'ddd'});
      assert.equal(
        calls.filter(args => args.join(' ').includes('pulls/12')).length,
        1,
      );
    });

    scenario('A conflicting pull request is named from that view', async () => {
      const calls: string[][] = [];
      const {review} = githubAdapters({
        run: async args => {
          calls.push(args);
          if (args[0] === 'pr' && args[1] === 'list' && args.includes('merged')) {
            return '[]';
          }
          if (args[0] === 'pr' && args[1] === 'list') {
            return JSON.stringify([{number: 16, title: '#7: change', state: 'OPEN'}]);
          }
          if (args[0] === 'pr' && args[1] === 'view') {
            return JSON.stringify({
              state: 'OPEN',
              statusCheckRollup: [],
              headRefOid: 'aaa',
              baseRefOid: 'bbb',
              mergeable: 'CONFLICTING',
            });
          }
          throw new Error(args.join(' '));
        },
      });
      const [pull] = await review.pulls('7');
      assert.equal(pull?.conflict, true);
      const views = calls.filter(args => args[0] === 'pr' && args[1] === 'view');
      assert.equal(views.length, 1);
      assert.match(views[0]?.join(' ') ?? '', /mergeable/);
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
    scenario('A spent rate limit waits until the reset', async () => {
      vi.useFakeTimers();
      const staged = yard();
      let reads = 0;
      const listOpen = staged.tracker.listOpen.bind(staged.tracker);
      staged.tracker.listOpen = async () => {
        reads += 1;
        return listOpen();
      };
      const page = await serveLiveBoard({
        homePath: staged.homePath,
        repo: 'acme/billing',
        tracker: staged.tracker,
        review: staged.review,
        githubRoot: staged.github,
      });
      try {
        const afterOpen = reads;
        const resetSec = Math.floor(Date.now() / 1000) + 90;
        const limited = [
          'HTTP/2.0 403 Forbidden',
          `x-ratelimit-reset: ${resetSec}`,
          '',
          '{"message":"API rate limit exceeded"}',
        ].join('\n');
        const read = readRest(limited);
        assert.equal(read.pauseUntil, resetSec * 1000);
        noteGithubPause(read.pauseUntil ?? 0);
        await vi.advanceTimersByTimeAsync(REFRESH_MS);
        assert.equal(reads, afterOpen);
        await vi.advanceTimersByTimeAsync(REFRESH_MS);
        assert.ok(reads > afterOpen);
      } finally {
        clearGithubPause();
        await page.close();
        vi.useRealTimers();
        rmSync(staged.dir, {recursive: true, force: true});
      }
    });
    scenario('A nameless rate limit reads the reset resource', () => {
      assert.equal(
        resetMillis(JSON.stringify({resources: {core: {reset: 1_793_005_596}}})),
        1_793_005_596_000,
      );
      assert.equal(resetMillis('not json'), undefined);
    });
  });

  requirement('A gateway answer is tried again', () => {
    const gateway = Object.assign(new Error('gh exited 1'), {
      stdout: 'Service Unavailable\n',
      stderr: "invalid character 'S' looking for beginning of value\n",
    });

    scenario('Plain text is tried again', async () => {
      vi.useFakeTimers();
      clearGithubPause();
      const logs: string[] = [];
      const write = console.error;
      console.error = line => {
        logs.push(String(line));
      };
      let calls = 0;
      try {
        const run = async () => {
          calls += 1;
          if (calls === 1) {
            throw gateway;
          }
          return {stdout: '[]', stderr: ''};
        };
        const pending = gh(['api', 'repos/acme/billing/issues'], undefined, run);
        await vi.runAllTimersAsync();
        assert.equal(await pending, '[]');
        assert.equal(calls, 2);
        assert.match(logs.join('\n'), /GitHub answered with text: Service Unavailable/);
        assert.equal(logs.join('\n').includes('invalid character'), false);
      } finally {
        console.error = write;
        clearGithubPause();
        vi.useRealTimers();
      }
    });

    scenario('A repeated gateway answer fails with the reason', async () => {
      vi.useFakeTimers();
      clearGithubPause();
      const logs: string[] = [];
      const write = console.error;
      console.error = line => {
        logs.push(String(line));
      };
      let calls = 0;
      try {
        const run = async () => {
          calls += 1;
          throw gateway;
        };
        const pending = gh(['api', 'repos/acme/billing/issues'], undefined, run);
        const failed = assert.rejects(pending, /GitHub answered with text: Service Unavailable/);
        await vi.runAllTimersAsync();
        await failed;
        assert.equal(calls, 3);
        assert.equal(logs.join('\n').includes('invalid character'), false);
        assert.equal(
          ghErrorLine(Object.assign(new Error('gh exited 1'), {stderr: gateway.stderr, stdout: gateway.stdout})),
          'GitHub answered with text: Service Unavailable',
        );
      } finally {
        console.error = write;
        clearGithubPause();
        vi.useRealTimers();
      }
    });

    scenario('An unknown field is not tried again', async () => {
      clearGithubPause();
      let calls = 0;
      const run = async () => {
        calls += 1;
        throw Object.assign(new Error('gh exited 1'), {
          stdout: '',
          stderr: 'Unknown JSON field: "baseRefOid"\n',
        });
      };
      await assert.rejects(gh(['pr', 'view', '9', '--json', 'baseRefOid'], undefined, run), /gh exited 1/);
      assert.equal(calls, 1);
      clearGithubPause();
    });

    scenario('HTTP 503 is tried again', async () => {
      vi.useFakeTimers();
      clearGithubPause();
      const logs: string[] = [];
      const write = console.error;
      console.error = line => {
        logs.push(String(line));
      };
      let calls = 0;
      try {
        const run = async () => {
          calls += 1;
          if (calls === 1) {
            throw Object.assign(new Error('gh exited 1'), {
              stdout: 'HTTP/2.0 503 Service Unavailable\n\n<html></html>\n',
              stderr: "invalid character '<' looking for beginning of value\n",
            });
          }
          return {stdout: '[]', stderr: ''};
        };
        const pending = gh(['api', 'graphql'], undefined, run);
        await vi.runAllTimersAsync();
        assert.equal(await pending, '[]');
        assert.equal(calls, 2);
        assert.match(logs.join('\n'), /GitHub answered HTTP 503/);
        assert.equal(logs.join('\n').includes('invalid character'), false);
      } finally {
        console.error = write;
        clearGithubPause();
        vi.useRealTimers();
      }
    });

    scenario('An unreachable network is tried again', async () => {
      vi.useFakeTimers();
      clearGithubPause();
      const logs: string[] = [];
      const write = console.error;
      console.error = line => {
        logs.push(String(line));
      };
      let calls = 0;
      try {
        const run = async () => {
          calls += 1;
          if (calls === 1) {
            throw new Error('connect ETIMEDOUT');
          }
          return {stdout: 'ok', stderr: ''};
        };
        const pending = gh(['pr', 'view', '9'], undefined, run);
        await vi.runAllTimersAsync();
        assert.equal(await pending, 'ok');
        assert.equal(calls, 2);
        assert.match(logs.join('\n'), /GitHub could not be reached/);
      } finally {
        console.error = write;
        clearGithubPause();
        vi.useRealTimers();
      }
    });
  });
});
