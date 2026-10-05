import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync, lstatSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {vi} from 'vitest';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {machine} from './adapters/compose.ts';
import {linkedTitle, memoryPorts} from './adapters/github.ts';
import {changeText, readChange, type ChangeView} from './machine/change.ts';
import {resolveCycle, resolveIssue} from './machine/flow.ts';
import {setPhase} from './machine/labels.ts';
import {parseMarker} from './machine/marker.ts';
import {accept, decide, settle, type Decision, type PullSnapshot} from './machine/policy.ts';
import type {FileSource, IssueRecord} from './machine/port.ts';
import {reviewOf, spokeByRobot, threadsReport} from './machine/review.ts';
import {exited, signature, tick, type State} from './machine/scheduler.ts';
import {loadCycle} from './machine/snapshot.ts';
import {updateMirror} from './machine/mirror.ts';
import {phaseOf} from './machine/phase.ts';
import {assembleDossier} from './reviewer/dossier.ts';
import {applyReview, passReview} from './reviewer/act.ts';
import {placeOnDiff} from './reviewer/place.ts';
import {describeQueue, reviewQueue} from './reviewer/plan.ts';
import {runReview} from './reviewer/run.ts';
import {parseVerdict} from './reviewer/verdict.ts';
import {fixThread, publish, runSdd} from './sdd.ts';

const files: FileSource = {exists: () => false, read: () => '', list: () => []};

function change(over: Partial<ChangeView> = {}): ChangeView {
  return {
    proposal: false,
    delta: false,
    design: false,
    tasks: false,
    archived: false,
    openQuestions: 0,
    openDecisions: 0,
    openTasks: 0,
    missingBaseline: [],
    ...over,
  };
}

function issue(
  key: number | string,
  labels: string[],
  extra: Partial<IssueRecord> = {},
): IssueRecord {
  return {
    key: String(key),
    title: `#${key}: title`,
    body: '',
    state: 'OPEN',
    labels,
    dependsOn: [],
    ...extra,
  };
}

function pull(id: number | string, over: Partial<PullSnapshot> = {}): PullSnapshot {
  return {
    id: String(id),
    title: '#1: title',
    state: 'OPEN',
    review: {unanswered: false, rollback: null, layers: []},
    checks: 'none',
    ...over,
  };
}

const ready = change({proposal: true, delta: true, design: true, tasks: true});

function action(decision: Decision): string {
  return decision.kind === 'agent' ? decision.action : decision.kind;
}

spec('phase', () => {
  requirement('A cycle with no phase enters proposing', () => {
    scenario('The cycle label alone enters proposing', () => {
      const settled = settle(issue(1, ['sdd:cycle']), [], [], change());
      assert.deepEqual(
        settled.transitions.map(step => step.to),
        ['proposing'],
      );
      assert.ok(settled.labels.includes('sdd:proposing'));
    });
  });

  requirement('Cancelled ends the cycle', () => {
    scenario('Cancelled with a phase label is done', () => {
      const settled = settle(issue(1, ['sdd:cancelled', 'sdd:proposing']), [], [], change());
      assert.equal(settled.decision.kind, 'done');
      assert.deepEqual(settled.transitions, []);
    });
  });

  requirement('Accepted wins over every other phase label', () => {
    scenario('Accepted wins over accepting', () => {
      assert.equal(phaseOf(['sdd:accepting', 'sdd:accepted']), 'accepted');
    });
  });

  requirement('A gate label wins only over the phase it closes', () => {
    scenario('The gate wins over the phase it closes', () => {
      assert.equal(phaseOf(['sdd:proposing', 'sdd:proposed']), 'proposed');
    });
    scenario('Otherwise the earliest label wins', () => {
      assert.equal(phaseOf(['sdd:proposing', 'sdd:specified']), 'proposing');
    });
  });

  requirement('The machine does not set a gate label', () => {
    scenario('Set refuses a gate label', async () => {
      const {tracker} = memoryPorts({
        issues: [
          {key: '7', title: '#7: title', body: '', state: 'OPEN', labels: ['sdd:proposing']},
        ],
      });
      await assert.rejects(setPhase('7', 'proposed', tracker), /gate label sdd:proposed/);
      assert.deepEqual(await tracker.labels('7'), ['sdd:proposing']);
    });
  });
});

spec('review-gate', () => {
  requirement('The machine opens the review once', () => {
    scenario('A published proposal is asked once', async () => {
      const {tracker, review, calls} = memoryPorts({
        issues: [
          {
            key: '5',
            title: '#5: title',
            body: '',
            state: 'OPEN',
            labels: ['Sandcastle', 'sdd:cycle', 'sdd:proposing'],
          },
        ],
        pulls: {'5': [{id: '9', title: '#5: title', state: 'OPEN'}]},
      });
      const options = {
        tracker,
        review,
        files,
        queues: [{name: 'Sandcastle'}],
        change: {...readChange('5', files), proposal: true},
      };
      assert.equal((await resolveIssue('5', options)).kind, 'wait');
      assert.ok((await tracker.labels('5')).includes('sdd:wait-human'));
      const asks = () => calls.filter(call => call.includes('Review the proposal'));
      assert.equal(asks().length, 1);
      assert.match(asks()[0], /replace the label `sdd:proposing` with `sdd:proposed`/);
      assert.match(asks()[0], /sdd accept 5/);
      const held = await resolveIssue('5', options);
      assert.equal(asks().length, 1);
      assert.equal(held.kind, 'wait');
      if (held.kind === 'wait') {
        assert.deepEqual(held.gate, {artifact: 'proposal', from: 'proposing', to: 'proposed'});
      }
    });
    scenario('An open question is not the review gate', () => {
      const held = decide(
        issue(1, ['sdd:proposing', 'sdd:wait-human']),
        [],
        [pull(9)],
        change({proposal: true, openQuestions: 1}),
      );
      assert.equal(held.kind, 'wait');
      if (held.kind === 'wait') {
        assert.equal(held.gate, undefined);
        assert.equal(held.reason, 'sdd:wait-human is set on proposing. Do the ask on the issue.');
      }
    });
    scenario('A wait on implementing points at the ask', () => {
      const held = decide(
        issue(1, ['sdd:implementing', 'sdd:wait-human']),
        [],
        [pull(9)],
        change(),
      );
      assert.equal(held.kind, 'wait');
      if (held.kind === 'wait') {
        assert.equal(held.gate, undefined);
        assert.equal(
          held.reason,
          'sdd:wait-human is set on implementing. Do the ask on the issue.',
        );
      }
    });
  });

  requirement('An auto tag skips the review', () => {
    scenario('Auto-plan advances a ready proposal', () => {
      const decision = decide(
        issue(1, ['sdd:proposing', 'sdd:auto-plan']),
        [],
        [pull(9)],
        change({proposal: true}),
      );
      assert.deepEqual(decision, {
        kind: 'advance',
        issue: '1',
        to: 'specifying',
        reason: 'sdd:auto-plan',
      });
    });
    scenario('Auto-spec does not lift an open review', () => {
      const held = decide(
        issue(1, ['sdd:specifying', 'sdd:wait-human', 'sdd:auto-spec']),
        [],
        [pull(9)],
        change({proposal: true, delta: true}),
      );
      assert.equal(held.kind, 'wait');
      if (held.kind === 'wait') {
        assert.deepEqual(held.gate, {artifact: 'spec', from: 'specifying', to: 'specified'});
      }
    });
    scenario('Auto-spec advances a ready delta', () => {
      const decision = decide(
        issue(1, ['sdd:specifying', 'sdd:auto-spec']),
        [],
        [pull(9)],
        change({proposal: true, delta: true}),
      );
      assert.deepEqual(decision, {
        kind: 'advance',
        issue: '1',
        to: 'designing',
        reason: 'sdd:auto-spec',
      });
    });
  });

  requirement('A person closes the gate on the issue', () => {
    scenario('Proposed on a ready proposal moves to specifying', async () => {
      const {tracker, review, calls} = memoryPorts({
        issues: [
          {
            key: '5',
            title: '#5: title',
            body: '',
            state: 'OPEN',
            labels: ['Sandcastle', 'sdd:cycle', 'sdd:proposing', 'sdd:proposed', 'sdd:wait-human'],
          },
        ],
        pulls: {'5': [{id: '9', title: '#5: title', state: 'OPEN'}]},
      });
      await resolveIssue('5', {
        tracker,
        review,
        files,
        queues: [{name: 'Sandcastle'}],
        change: {...readChange('5', files), proposal: true},
      });
      assert.ok((await tracker.labels('5')).includes('sdd:specifying'));
      assert.equal((await tracker.labels('5')).includes('sdd:wait-human'), false);
      assert.ok(calls.some(call => call.includes('sdd:accept proposing → specifying')));
    });
    scenario('Specified over a missing delta goes back once', async () => {
      const {tracker, review, calls} = memoryPorts({
        issues: [
          {
            key: '5',
            title: '#5: title',
            body: '',
            state: 'OPEN',
            labels: ['Sandcastle', 'sdd:cycle', 'sdd:specified'],
          },
        ],
        pulls: {'5': [{id: '9', title: '#5: title', state: 'OPEN'}]},
      });
      const options = {
        tracker,
        review,
        files,
        queues: [{name: 'Sandcastle'}],
        change: {...readChange('5', files), proposal: true},
      };
      await resolveIssue('5', options);
      assert.ok((await tracker.labels('5')).includes('sdd:specifying'));
      const notes = calls.filter(call => call.startsWith('body:'));
      assert.equal(notes.length, 1);
      assert.match(notes[0], /specs/);
      await resolveIssue('5', options);
      assert.equal(calls.filter(call => call.startsWith('body:')).length, 1);
    });
    scenario('Designed over an open decision goes back, then asks', () => {
      const open = change({proposal: true, delta: true, design: true, openDecisions: 1});
      const reverted = settle(issue(1, ['sdd:cycle', 'sdd:designed']), [], [pull(9)], open);
      assert.deepEqual(
        reverted.transitions.map(step => step.to),
        ['designing'],
      );
      assert.match(reverted.transitions[0].comment ?? '', /Open decisions/);
      const closed = settle(issue(1, reverted.labels), [], [pull(9)], ready);
      assert.equal(closed.decision.kind, 'wait');
      if (closed.decision.kind === 'wait') {
        assert.deepEqual(closed.decision.gate, {
          artifact: 'design',
          from: 'designing',
          to: 'designed',
        });
      }
    });
  });

  requirement('Accept closes only a writing phase', () => {
    scenario('Accept advances a ready proposal', () => {
      const decision = accept(issue(1, ['sdd:cycle', 'sdd:proposing']), change({proposal: true}));
      assert.deepEqual(decision, {
        kind: 'advance',
        issue: '1',
        to: 'specifying',
        reason: 'proposing → specifying',
      });
    });
    scenario('Accept waits on an open question', () => {
      const blocked = accept(
        issue(1, ['sdd:cycle', 'sdd:proposing']),
        change({proposal: true, openQuestions: 1}),
      );
      assert.equal(blocked.kind, 'wait');
      if (blocked.kind === 'wait') {
        assert.match(blocked.reason, /Open questions/);
      }
    });
    scenario('Accept refuses accepting', () => {
      const decision = accept(issue(1, ['sdd:cycle', 'sdd:accepting']), change({archived: true}));
      assert.equal(decision.kind, 'wait');
    });
    scenario('Accept refuses an issue with no cycle label', () => {
      const decision = accept(issue(1, ['sdd:proposing']), change({proposal: true}));
      assert.equal(decision.kind, 'wait');
      if (decision.kind === 'wait') {
        assert.match(decision.reason, /sdd:cycle/);
      }
    });
  });
});

spec('artifact', () => {
  requirement('A writing phase publishes its own file', () => {
    scenario('Proposing without a proposal writes one', () => {
      const decision = decide(issue(1, ['sdd:proposing']), [], [pull(9)], change());
      assert.equal(action(decision), 'create-proposal');
    });
    scenario('A proposal with no pull request is published', () => {
      const decision = decide(issue(1, ['sdd:proposing']), [], [], change({proposal: true}));
      assert.equal(action(decision), 'create-proposal');
    });
  });

  requirement('A missing earlier file returns one phase', () => {
    scenario('Specifying without a proposal returns to proposing', () => {
      const decision = decide(issue(1, ['sdd:specifying']), [], [pull(9)], change({delta: true}));
      assert.deepEqual(decision, {
        kind: 'advance',
        issue: '1',
        to: 'proposing',
        reason: 'proposal.md is missing',
      });
    });
    scenario('Designing with a delta and no proposal stays', () => {
      const decision = decide(issue(1, ['sdd:designing']), [], [pull(9)], change({delta: true}));
      assert.equal(action(decision), 'create-design');
    });
  });

  requirement('Open items hold only their own file', () => {
    scenario('Open questions hold proposing under auto-plan', () => {
      const decision = decide(
        issue(1, ['sdd:proposing', 'sdd:auto-plan']),
        [],
        [pull(9)],
        change({proposal: true, openQuestions: 2}),
      );
      assert.equal(decision.kind, 'wait');
    });
    scenario('An open task stays in implementing', () => {
      const decision = decide(issue(1, ['sdd:implementing']), [], [pull(9)], {
        ...ready,
        openTasks: 1,
      });
      assert.equal(action(decision), 'implement-next-task');
    });
  });
});

spec('baseline', () => {
  requirement('A Modified id without a baseline is restored first', () => {
    scenario('Specifying restores a missing baseline before the delta', () => {
      const decision = decide(
        issue(1, ['sdd:specifying']),
        [],
        [pull(9)],
        change({proposal: true, missingBaseline: ['cache-first']}),
      );
      assert.equal(action(decision), 'restore-baseline');
    });
    scenario('A spec thread waits for the missing baseline', () => {
      const decision = decide(
        issue(1, ['sdd:specifying']),
        [],
        [pull(9, {review: {unanswered: false, rollback: 'specifying', layers: ['spec']}})],
        change({proposal: true, delta: true, missingBaseline: ['cache-first']}),
      );
      assert.equal(action(decision), 'restore-baseline');
    });
    scenario('An Added id without a baseline does not restore', () => {
      const source: FileSource = {
        exists: rel => rel === 'openspec/changes/issue-1/proposal.md',
        read: () => '## Capabilities\n### Added\n- cache-first new\n',
        list: () => [],
      };
      const view = readChange('1', source);
      assert.deepEqual(view.missingBaseline, []);
      const decision = decide(issue(1, ['sdd:specifying']), [], [pull(9)], view);
      assert.notEqual(action(decision), 'restore-baseline');
    });
  });
});

spec('marker', () => {
  requirement('One body carries one marker', () => {
    scenario('Fixed wins over a layer in the same reply', () => {
      assert.deepEqual(parseMarker('sdd:layer=code sdd:fixed abc'), {kind: 'fixed', commit: 'abc'});
    });
    scenario('A capitalised layer is no marker', () => {
      assert.equal(parseMarker('sdd:layer=Spec'), null);
    });
  });

  requirement('An unmarked remark is classified before the phase moves', () => {
    scenario('An unlabeled thread is classified during implementing', () => {
      const decision = decide(
        issue(1, ['sdd:implementing']),
        [],
        [pull(9, {review: {unanswered: true, rollback: null, layers: []}})],
        ready,
      );
      assert.equal(action(decision), 'classify-comments');
    });
    scenario('A fixed thread is done', () => {
      const records = [
        {
          id: 'T1',
          comment: '11',
          path: 'src/a.ts',
          line: 3,
          resolved: false,
          body: '🤖 sdd:fixed abc123',
        },
      ];
      const review = reviewOf(records, []);
      assert.equal(review.unanswered, false);
      assert.equal(review.rollback, null);
      assert.deepEqual(threadsReport(records, [], {unmarked: true}).threads, []);
    });
    scenario('An unanswered conversation on accepting is classified before the merge', () => {
      const review = reviewOf([], [{robot: false, body: 'please rebase'}]);
      const decision = decide(
        issue(1, ['sdd:accepting']),
        [],
        [pull(9, {checks: 'green', review})],
        change({archived: true}),
      );
      assert.equal(action(decision), 'classify-comments');
    });
  });

  requirement('The robot mark and an ignored author are not a person', () => {
    const ignored = [/sonarqubecloud/i];
    scenario('The robot mark and an ignored author leave the conversation answered', () => {
      const marked = '🤖 please rebase';
      const gate = 'Quality Gate passed';
      const byMark = reviewOf([], [{robot: spokeByRobot(marked, '3y3', ignored), body: marked}]);
      const byIgnore = reviewOf(
        [],
        [{robot: spokeByRobot(gate, 'sonarqubecloud[bot]', ignored), body: gate}],
      );
      assert.equal(byMark.unanswered, false);
      assert.equal(byIgnore.unanswered, false);
    });
    scenario('A bot login that is not ignored stays unanswered', () => {
      const body = 'please rename the cache';
      const review = reviewOf([], [{robot: spokeByRobot(body, 'reviewer[bot]', ignored), body}]);
      assert.equal(review.unanswered, true);
    });
  });

  requirement('The earliest layer rolls the phase back', () => {
    scenario('A spec marker during implementing moves to specifying', () => {
      const decision = decide(
        issue(1, ['sdd:implementing']),
        [],
        [pull(9, {review: {unanswered: false, rollback: 'specifying', layers: ['spec']}})],
        ready,
      );
      assert.deepEqual(decision, {
        kind: 'advance',
        issue: '1',
        to: 'specifying',
        reason: 'review thread sent the change back',
      });
    });
    scenario('Out does not move the phase', () => {
      const decision = decide(
        issue(1, ['sdd:implementing']),
        [],
        [pull(9, {review: {unanswered: false, rollback: 'implementing', layers: ['out', 'code']}})],
        ready,
      );
      assert.equal(action(decision), 'fix-implementation');
    });
    scenario('The earliest of two layers wins', () => {
      const review = reviewOf(
        [
          {resolved: false, body: 'sdd:layer=code → implementing'},
          {resolved: false, body: 'sdd:layer=spec → specifying'},
        ],
        [],
      );
      assert.equal(review.rollback, 'specifying');
    });
    scenario('A later fixed clears the conversation layer', () => {
      const review = reviewOf(
        [],
        [
          {robot: false, body: 'please rebase'},
          {robot: true, body: '🤖 sdd:layer=code → implementing'},
          {robot: true, body: '🤖 sdd:fixed abc'},
        ],
      );
      const decision = decide(
        issue(1, ['sdd:accepting']),
        [],
        [pull(9, {checks: 'green', review})],
        change({archived: true}),
      );
      assert.equal(decision.kind, 'wait');
    });
  });

  requirement('Thread fix closes a thread in one call', () => {
    scenario('Fix refuses before the commit is on the remote branch', async () => {
      const memory = memoryPorts({
        threadList: {
          '12': [
            {
              id: 'PRRT_1',
              comment: '41',
              path: 'src/a.ts',
              line: 3,
              resolved: false,
              body: 'sdd:layer=code',
            },
          ],
        },
      });
      await assert.rejects(
        fixThread(
          {key: '7', pull: '12', thread: 'PRRT_1'},
          {review: memory.review, vcs: {head: async () => 'abc123', published: async () => false}},
        ),
        /Publish/,
      );
      assert.deepEqual(memory.calls, []);
    });
    scenario('Fix replies and resolves together', async () => {
      const memory = memoryPorts({
        threadList: {
          '12': [
            {
              id: 'PRRT_1',
              comment: '41',
              path: 'src/a.ts',
              line: 3,
              resolved: false,
              body: 'sdd:layer=code',
            },
          ],
        },
      });
      assert.equal(
        await fixThread(
          {key: '7', pull: '12', thread: 'PRRT_1'},
          {review: memory.review, vcs: {head: async () => 'abc123', published: async () => true}},
        ),
        'sdd:fixed abc123',
      );
      assert.deepEqual(memory.calls, [
        'threadList',
        'reply',
        'body:🤖 sdd:fixed abc123',
        'resolveThread',
      ]);
    });
  });
});

spec('pull-request', () => {
  requirement('Several open pull requests stop the cycle before any step', () => {
    scenario('Two open pull requests stop proposing', () => {
      const decision = decide(
        issue(1, ['sdd:proposing']),
        [],
        [pull(3), pull(4)],
        change({proposal: true}),
      );
      assert.equal(decision.kind, 'wait');
      if (decision.kind === 'wait') {
        assert.match(decision.reason, /3, 4/);
      }
    });
    scenario('A gate label does not move while two pull requests are open', () => {
      const settled = settle(
        issue(1, ['sdd:proposing', 'sdd:proposed']),
        [],
        [pull(3), pull(4)],
        change({proposal: true}),
      );
      assert.equal(settled.decision.kind, 'wait');
      assert.deepEqual(settled.transitions, []);
      assert.ok(settled.labels.includes('sdd:proposed'));
      assert.equal(settled.labels.includes('sdd:specifying'), false);
    });
    scenario('Two open pull requests block entering the cycle', () => {
      const settled = settle(issue(1, ['sdd:cycle']), [], [pull(3), pull(4)], change());
      assert.deepEqual(settled.transitions, []);
      assert.equal(settled.labels.includes('sdd:proposing'), false);
    });
  });

  requirement('None creates a pull request, one is reused', () => {
    scenario('No open pull request is created with the given title', async () => {
      const titles: string[] = [];
      const pushed: string[] = [];
      const memory = memoryPorts();
      const id = await publish(
        {key: '7', title: '#7: land the change'},
        {
          review: {
            pulls: key => memory.review.pulls(key),
            ensurePull: (key, title, body) => {
              titles.push(title);
              return memory.review.ensurePull(key, title, body);
            },
          } as never,
          vcs: {dirty: async () => [], push: async key => void pushed.push(key)},
        },
      );
      assert.equal(id, '#7: pull new');
      assert.deepEqual(titles, ['#7: land the change']);
      assert.deepEqual(pushed, ['7']);
    });
    scenario('One open pull request is reused', async () => {
      const memory = memoryPorts({pulls: {'7': [{id: '9', title: '#7: existing', state: 'OPEN'}]}});
      const pushed: string[] = [];
      const id = await publish(
        {key: '7', title: '#7: again'},
        {review: memory.review, vcs: {dirty: async () => [], push: async key => void pushed.push(key)}},
      );
      assert.equal(id, '#7: pull 9');
      assert.deepEqual(pushed, ['7']);
    });
    scenario('A title without the key prefix does not belong to the issue', () => {
      assert.equal(linkedTitle('7', 'unrelated'), false);
      assert.equal(linkedTitle('7', '#7: change'), true);
    });
  });
});

spec('dependencies', () => {
  requirement('Tasking waits until every child is specified', () => {
    scenario('A child still on specifying holds tasking', () => {
      const parent = issue(1, ['sdd:tasking']);
      const child = issue(2, ['sdd:cycle', 'sdd:specifying'], {parent: '1'});
      const decision = decide(parent, [parent, child], [pull(9)], ready);
      assert.equal(decision.kind, 'wait');
      if (decision.kind === 'wait') {
        assert.match(decision.reason, /#2/);
      }
    });
    scenario('A specified child lets tasking move on', () => {
      const parent = issue(1, ['sdd:tasking']);
      const child = issue(2, ['sdd:cycle', 'sdd:specified'], {parent: '1'});
      const decision = decide(parent, [parent, child], [pull(9)], ready);
      assert.deepEqual(decision, {
        kind: 'advance',
        issue: '1',
        to: 'implementing',
        reason: 'tasks exist',
      });
    });
    scenario('A cancelled child does not count as specified', () => {
      const parent = issue(1, ['sdd:tasking']);
      const child = issue(2, ['sdd:cycle', 'sdd:cancelled'], {parent: '1'});
      const decision = decide(parent, [parent, child], [pull(9)], ready);
      assert.equal(decision.kind, 'wait');
      if (decision.kind === 'wait') {
        assert.match(decision.reason, /#2/);
      }
    });
  });

  requirement('Implementing waits for children and blockers after the tasks', () => {
    scenario('An open task runs before the children are checked', () => {
      const parent = issue(1, ['sdd:implementing']);
      const child = issue(2, ['sdd:cycle', 'sdd:specifying'], {parent: '1'});
      const decision = decide(parent, [parent, child], [pull(9)], {...ready, openTasks: 1});
      assert.equal(action(decision), 'implement-next-task');
    });
    scenario('A child that is not accepted holds implementing', () => {
      const parent = issue(1, ['sdd:implementing']);
      const child = issue(2, ['sdd:cycle', 'sdd:implementing'], {parent: '1'});
      const decision = decide(parent, [parent, child], [pull(9)], ready);
      assert.equal(decision.kind, 'wait');
      if (decision.kind === 'wait') {
        assert.match(decision.reason, /#2/);
      }
    });
    scenario('An open blocker holds implementing', () => {
      const parent = issue(1, ['sdd:implementing'], {dependsOn: ['8']});
      const blocker = issue(8, ['sdd:cycle', 'sdd:implementing']);
      const decision = decide(parent, [parent, blocker], [pull(9)], ready);
      assert.equal(decision.kind, 'wait');
      if (decision.kind === 'wait') {
        assert.match(decision.reason, /#8/);
      }
    });
    scenario('Finished tasks with no children move to verifying', () => {
      const decision = decide(issue(1, ['sdd:implementing']), [], [pull(9)], ready);
      assert.deepEqual(decision, {
        kind: 'advance',
        issue: '1',
        to: 'verifying',
        reason: 'no open tasks',
      });
    });
  });

  requirement('Parent and Depends are body lines', () => {
    scenario('A Parent line holds tasking', async () => {
      const {tracker} = memoryPorts({
        issues: [
          {
            key: '1',
            title: '#1: title',
            body: '',
            state: 'OPEN',
            labels: ['sdd:cycle', 'sdd:tasking'],
          },
          {
            key: '2',
            title: '#2: title',
            body: 'Parent: #1\n',
            state: 'OPEN',
            labels: ['sdd:cycle', 'sdd:specifying'],
          },
        ],
      });
      const issues = await tracker.listOpen();
      const parent = issues.find(item => item.key === '1');
      const decision = decide(parent!, issues, [pull(9)], ready);
      assert.equal(decision.kind, 'wait');
      if (decision.kind === 'wait') {
        assert.match(decision.reason, /#2/);
      }
    });
    scenario('A Depends line holds implementing', async () => {
      const {tracker} = memoryPorts({
        issues: [
          {
            key: '1',
            title: '#1: title',
            body: 'Depends: #8\n',
            state: 'OPEN',
            labels: ['sdd:cycle', 'sdd:implementing'],
          },
          {key: '8', title: '#8: title', body: '', state: 'OPEN', labels: []},
        ],
      });
      const issues = await tracker.listOpen();
      const parent = issues.find(item => item.key === '1');
      const decision = decide(parent!, issues, [pull(9)], ready);
      assert.equal(decision.kind, 'wait');
      if (decision.kind === 'wait') {
        assert.match(decision.reason, /#8/);
      }
    });
  });

  requirement('A parent rollback does not move a child', () => {
    scenario('A spec marker on the parent leaves the child in place', async () => {
      const parent = issue(1, ['Sandcastle', 'sdd:cycle', 'sdd:implementing']);
      const child = issue(2, ['Sandcastle', 'sdd:cycle', 'sdd:implementing'], {parent: '1'});
      const {tracker} = memoryPorts({
        issues: [
          {key: '1', title: '#1: title', body: '', state: 'OPEN', labels: [...parent.labels]},
          {
            key: '2',
            title: '#2: title',
            body: '',
            state: 'OPEN',
            labels: [...child.labels],
            parent: '1',
          },
        ],
      });
      const review = reviewOf([{resolved: false, body: 'sdd:layer=spec → specifying'}], []);
      await resolveCycle(
        {
          issues: [parent, child],
          cycles: [parent, child],
          pulls: new Map([
            ['1', [pull(9, {review})]],
            ['2', [pull(10)]],
          ]),
          changes: new Map([
            ['1', ready],
            ['2', {...ready, openTasks: 1}],
          ]),
        },
        tracker,
        [{name: 'Sandcastle'}],
      );
      assert.ok((await tracker.labels('1')).includes('sdd:specifying'));
      assert.equal((await tracker.labels('1')).includes('sdd:implementing'), false);
      assert.deepEqual(await tracker.labels('2'), ['Sandcastle', 'sdd:cycle', 'sdd:implementing']);
    });
  });
});

spec('verifying', () => {
  requirement('Verifying needs an open pull request', () => {
    scenario('Verifying without an open pull request waits', () => {
      const decision = decide(issue(1, ['sdd:verifying']), [], [], ready);
      assert.equal(decision.kind, 'wait');
    });
  });

  requirement('Red checks follow a marker, otherwise they are classified', () => {
    scenario('Red checks with a code marker return to implementing', () => {
      const decision = decide(
        issue(1, ['sdd:verifying']),
        [],
        [
          pull(9, {
            checks: 'red',
            review: {unanswered: false, rollback: 'implementing', layers: ['code']},
          }),
        ],
        ready,
      );
      assert.deepEqual(decision, {
        kind: 'advance',
        issue: '1',
        to: 'implementing',
        reason: 'review thread sent the change back',
      });
    });
    scenario('Red checks with no marker are classified', () => {
      const decision = decide(issue(1, ['sdd:verifying']), [], [pull(9, {checks: 'red'})], ready);
      assert.equal(action(decision), 'classify-failures');
    });
  });

  requirement('Only green checks without a marker reach accepting', () => {
    scenario('Pending checks wait', () => {
      const decision = decide(
        issue(1, ['sdd:verifying']),
        [],
        [pull(9, {checks: 'pending'})],
        ready,
      );
      assert.equal(decision.kind, 'wait');
    });
    scenario('Green checks with a design marker roll back', () => {
      const decision = decide(
        issue(1, ['sdd:verifying']),
        [],
        [
          pull(9, {
            checks: 'green',
            review: {unanswered: false, rollback: 'designing', layers: ['design']},
          }),
        ],
        ready,
      );
      assert.deepEqual(decision, {
        kind: 'advance',
        issue: '1',
        to: 'designing',
        reason: 'review thread sent the change back',
      });
    });
    scenario('Green checks move to accepting', () => {
      const decision = decide(issue(1, ['sdd:verifying']), [], [pull(9, {checks: 'green'})], ready);
      assert.deepEqual(decision, {
        kind: 'advance',
        issue: '1',
        to: 'accepting',
        reason: 'checks are green',
      });
    });
  });
});

spec('merge', () => {
  requirement('An early archived change is restored', () => {
    scenario('Tasking restores an archived change', () => {
      const decision = decide(
        issue(1, ['sdd:tasking']),
        [],
        [pull(9)],
        change({archived: true, design: true, tasks: true}),
      );
      assert.equal(action(decision), 'unarchive');
    });
    scenario('An archived change is restored before an unlabeled thread', () => {
      const review = reviewOf([{resolved: false, body: 'please rename'}], []);
      const decision = decide(
        issue(1, ['sdd:tasking']),
        [],
        [pull(9, {review})],
        change({archived: true, design: true, tasks: true}),
      );
      assert.equal(action(decision), 'unarchive');
    });
  });

  requirement('Accepting archives before it merges', () => {
    scenario('Accepting archives a change that is still open', () => {
      const decision = decide(issue(1, ['sdd:accepting']), [], [pull(9)], change({proposal: true}));
      assert.equal(action(decision), 'archive');
    });
    scenario('Accepting with no pull request does not archive', () => {
      const decision = decide(issue(1, ['sdd:accepting']), [], [], change({proposal: true}));
      assert.equal(decision.kind, 'wait');
      assert.notEqual(action(decision), 'archive');
    });
    scenario('Auto-merge merges a green archived pull request', () => {
      const decision = decide(
        issue(1, ['sdd:accepting', 'sdd:auto-merge']),
        [],
        [pull(9, {checks: 'green'})],
        change({archived: true}),
      );
      assert.equal(decision.kind, 'merge');
    });
    scenario('Without auto-merge the person merges', () => {
      const decision = decide(
        issue(1, ['sdd:accepting']),
        [],
        [pull(9, {checks: 'green'})],
        change({archived: true}),
      );
      assert.equal(decision.kind, 'wait');
      if (decision.kind === 'wait') {
        assert.match(decision.reason, /wait for merge/);
      }
    });
    scenario('Auto-merge waits for green checks', () => {
      const decision = decide(
        issue(1, ['sdd:accepting', 'sdd:auto-merge']),
        [],
        [pull(9, {checks: 'pending'})],
        change({archived: true}),
      );
      assert.equal(decision.kind, 'wait');
      assert.notEqual(decision.kind, 'merge');
    });
  });

  requirement('Accepted does not merge', () => {
    scenario('Accepted with an open change archives it', () => {
      const decision = decide(
        issue(1, ['sdd:accepted']),
        [],
        [pull(9, {state: 'MERGED'})],
        change({proposal: true}),
      );
      assert.equal(action(decision), 'archive');
    });
    scenario('A merged archived pull request closes the issue', async () => {
      const {tracker, review} = memoryPorts({
        issues: [
          {
            key: '5',
            title: '#5: title',
            body: '',
            state: 'OPEN',
            labels: ['Sandcastle', 'sdd:cycle', 'sdd:accepted'],
          },
        ],
        pulls: {'5': [{id: '9', title: '#5: title', state: 'MERGED'}]},
      });
      const decision = await resolveIssue('5', {
        tracker,
        review,
        files,
        queues: [{name: 'Sandcastle'}],
      });
      assert.equal(decision.kind, 'done');
      assert.equal((await tracker.issue('5')).state, 'CLOSED');
    });
    scenario('Accepted waits while the pull request is open', () => {
      const decision = decide(
        issue(1, ['sdd:accepted', 'sdd:auto-merge']),
        [],
        [pull(9, {checks: 'green'})],
        change({archived: true}),
      );
      assert.equal(decision.kind, 'wait');
      assert.notEqual(decision.kind, 'merge');
    });
  });
});

spec('change', () => {
  requirement('The change directory is issue-<key>', () => {
    scenario('A numeric directory is not the change', () => {
      const source: FileSource = {
        exists: rel => rel === 'openspec/changes/7/proposal.md',
        read: () => '## Open questions\n- [ ] no\n',
        list: () => [],
      };
      assert.equal(readChange('7', source).proposal, false);
    });
    scenario('The change is read from the issue branch', () => {
      const source: FileSource = {
        exists: rel => rel === 'openspec/changes/issue-7/proposal.md',
        read: () => '## Open questions\n- [ ] still open\n',
        list: () => [],
      };
      assert.equal(readChange('7', source).proposal, true);
    });
  });

  requirement('The active change wins over the archive', () => {
    scenario('Both copies present, the active text is read', () => {
      const source: FileSource = {
        exists: rel =>
          rel === 'openspec/changes/issue-11/proposal.md' ||
          rel === 'openspec/changes/archive/issue-11/proposal.md',
        read: rel => (rel.startsWith('openspec/changes/issue-11/') ? 'active\n' : 'archived\n'),
        list: () => [],
      };
      assert.match(changeText('11', source) ?? '', /active/);
    });
  });
});

spec('wait', () => {
  requirement('Wait comments the ask', () => {
    scenario('Wait without a sentence is refused', async () => {
      const {tracker, review} = memoryPorts({
        issues: [{key: '7', title: '#7: title', body: '', state: 'OPEN', labels: ['sdd:cycle']}],
      });
      const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('exit');
      });
      try {
        await assert.rejects(
          runSdd(
            ['wait', '7'],
            machine(process.cwd(), {tracker, review, config: {queues: [{name: 'Sandcastle'}]}}),
          ),
          /exit/,
        );
        assert.equal((await tracker.labels('7')).includes('sdd:wait-human'), false);
      } finally {
        exit.mockRestore();
      }
    });
    scenario('Wait posts the sentence', async () => {
      const {tracker, review, calls} = memoryPorts({
        issues: [{key: '7', title: '#7: title', body: '', state: 'OPEN', labels: ['sdd:cycle']}],
      });
      await runSdd(
        ['wait', '7', 'merge the pull request'],
        machine(process.cwd(), {tracker, review, config: {queues: [{name: 'Sandcastle'}]}}),
      );
      assert.ok((await tracker.labels('7')).includes('sdd:wait-human'));
      assert.ok(calls.some(call => call.includes('merge the pull request')));
    });
  });

  requirement('Unwait clears the label', () => {
    scenario('Unwait removes the label', async () => {
      const {tracker, review} = memoryPorts({
        issues: [
          {
            key: '7',
            title: '#7: title',
            body: '',
            state: 'OPEN',
            labels: ['sdd:cycle', 'sdd:wait-human'],
          },
        ],
      });
      await runSdd(
        ['unwait', '7'],
        machine(process.cwd(), {tracker, review, config: {queues: [{name: 'Sandcastle'}]}}),
      );
      assert.equal((await tracker.labels('7')).includes('sdd:wait-human'), false);
    });
    scenario('Unwait on an issue that is not waiting', async () => {
      const {tracker, review, calls} = memoryPorts({
        issues: [{key: '7', title: '#7: title', body: '', state: 'OPEN', labels: ['sdd:cycle']}],
      });
      await runSdd(
        ['unwait', '7'],
        machine(process.cwd(), {tracker, review, config: {queues: [{name: 'Sandcastle'}]}}),
      );
      assert.equal(calls.includes('editLabels'), false);
      assert.deepEqual(await tracker.labels('7'), ['sdd:cycle']);
    });
  });
});

spec('publish', () => {
  requirement('A dirty worktree is not published', () => {
    scenario('Dirty paths are named and nothing is pushed', async () => {
      const pushed: string[] = [];
      const memory = memoryPorts();
      await assert.rejects(
        publish(
          {key: '7', title: '#7: fix'},
          {
            review: memory.review,
            vcs: {dirty: async () => ['src/a.ts'], push: async key => void pushed.push(key)},
          },
        ),
        /src\/a\.ts/,
      );
      assert.deepEqual(pushed, []);
    });
  });

  requirement('Several open pull requests are refused before the push', () => {
    scenario('Two open pull requests reject publish before the push', async () => {
      const memory = memoryPorts({
        pulls: {
          '7': [
            {id: '3', title: '#7: one', state: 'OPEN'},
            {id: '4', title: '#7: two', state: 'OPEN'},
          ],
        },
      });
      const pushed: string[] = [];
      await assert.rejects(
        publish(
          {key: '7', title: '#7: fix'},
          {review: memory.review, vcs: {dirty: async () => [], push: async key => void pushed.push(key)}},
        ),
        /3, 4/,
      );
      assert.deepEqual(pushed, []);
    });
  });

  requirement('The argument is the pull request title', () => {
    scenario('The new pull request uses the given title', async () => {
      const titles: string[] = [];
      const memory = memoryPorts();
      await publish(
        {key: '7', title: '#7: land the change'},
        {
          review: {
            pulls: key => memory.review.pulls(key),
            ensurePull: (key, title, body) => {
              titles.push(title);
              return memory.review.ensurePull(key, title, body);
            },
          } as never,
          vcs: {dirty: async () => [], push: async () => undefined},
        },
      );
      assert.deepEqual(titles, ['#7: land the change']);
    });
  });
});

spec('idle', () => {
  requirement('A run with no commit is not repeated', () => {
    scenario('The same decision stays idle', () => {
      const empty: State = {running: [], idle: {}, reported: {}};
      const decision: Extract<Decision, {kind: 'agent'}> = {
        kind: 'agent',
        issue: '1',
        action: 'create-proposal',
        skill: 'plan',
        phase: 'proposing',
        pr: '',
        reason: 'write proposal.md',
      };
      const running = {...tick(empty, [decision], 1).state, running: ['1']};
      const idle = exited(running, '1', 2, signature(decision));
      const again = tick(idle, [decision], 1);
      assert.deepEqual(again.start, []);
      assert.equal(again.report.length, 1);
      const quiet = tick(again.state, [decision], 1);
      assert.deepEqual(quiet.report, []);
    });
    scenario('A different action starts', () => {
      const empty: State = {running: [], idle: {}, reported: {}};
      const first: Extract<Decision, {kind: 'agent'}> = {
        kind: 'agent',
        issue: '1',
        action: 'create-proposal',
        skill: 'plan',
        phase: 'proposing',
        pr: '',
        reason: 'write proposal.md',
      };
      const idle = exited({...empty, running: ['1']}, '1', 0, signature(first));
      const next = tick(
        idle,
        [{...first, action: 'create-initial-specs', reason: 'write the delta'}],
        1,
      );
      assert.equal(next.start[0]?.action, 'create-initial-specs');
    });
  });

  requirement('A running issue and the parallel cap are left alone', () => {
    scenario('A running issue is not moved', async () => {
      const {tracker, review, calls} = memoryPorts({
        issues: [
          {
            key: '7',
            title: '#7: title',
            body: '',
            state: 'OPEN',
            labels: ['Sandcastle', 'sdd:cycle', 'sdd:proposed'],
          },
        ],
      });
      const snapshot = await loadCycle(tracker, review, () => files, [{name: 'Sandcastle'}]);
      const decisions = await resolveCycle(
        snapshot,
        tracker,
        [{name: 'Sandcastle'}],
        new Set(['7']),
      );
      assert.deepEqual(decisions, []);
      assert.equal(calls.includes('editLabels'), false);
      assert.deepEqual(await tracker.labels('7'), ['Sandcastle', 'sdd:cycle', 'sdd:proposed']);
    });
    scenario('Parallel 1 starts one of two ready issues', () => {
      const empty: State = {running: [], idle: {}, reported: {}};
      const one: Extract<Decision, {kind: 'agent'}> = {
        kind: 'agent',
        issue: '1',
        action: 'create-proposal',
        skill: 'plan',
        phase: 'proposing',
        pr: '',
        reason: 'write proposal.md',
      };
      const turned = tick(empty, [one, {...one, issue: '2', reason: 'other'}], 1);
      assert.deepEqual(
        turned.start.map(item => item.issue),
        ['1'],
      );
    });
  });
});

const reviewedHead = 'abc123';

function namedFiles(entries: Record<string, string>): FileSource {
  return {
    exists: rel => rel in entries,
    read: rel => entries[rel] ?? '',
    list: rel => Object.keys(entries).filter(name => name.startsWith(`${rel}/`)),
  };
}

const reviewDiff = `diff --git a/src/cache.ts b/src/cache.ts
--- a/src/cache.ts
+++ b/src/cache.ts
@@ -10,3 +12,4 @@
 keep
+added
 same
`;

spec('reviewer', () => {
  const accepting = ['sdd:cycle', 'sdd:accepting', 'sdd:auto-review'];

  requirement('Only one accepting pull request is reviewed', () => {
    scenario('Auto-merge skips the reviewer', () => {
      const items = reviewQueue([{key: '11', labels: [...accepting, 'sdd:auto-merge']}], () => []);
      assert.equal(items[0]?.kind, 'skip');
      if (items[0]?.kind === 'skip') {
        assert.match(items[0].reason, /auto-merge/);
      }
    });
    scenario('Auto-review before accepting is skipped', () => {
      const items = reviewQueue(
        [{key: '13', labels: ['sdd:cycle', 'sdd:implementing', 'sdd:auto-review']}],
        () => [],
      );
      assert.equal(items[0]?.kind, 'skip');
      if (items[0]?.kind === 'skip') {
        assert.match(items[0].reason, /accepting/);
      }
    });
    scenario('An issue without auto-review is left out', () => {
      const items = reviewQueue([{key: '14', labels: ['sdd:cycle', 'sdd:accepting']}], () => [
        {id: '15', state: 'OPEN'},
      ]);
      assert.deepEqual(items, []);
    });
    scenario('Several open pull requests wait', () => {
      const items = reviewQueue([{key: '11', labels: accepting}], () => [
        {id: '3', state: 'OPEN'},
        {id: '4', state: 'OPEN'},
      ]);
      assert.equal(items[0]?.kind, 'wait');
    });
    scenario('One open pull request is ready', () => {
      const items = reviewQueue([{key: '12', labels: accepting}], () => [
        {id: '15', state: 'OPEN'},
      ]);
      assert.deepEqual(items, [{kind: 'ready', issue: '12', pull: '15'}]);
    });
    scenario('An empty queue says so', () => {
      assert.deepEqual(describeQueue([]), ['no sdd:auto-review issues']);
    });
  });

  requirement('The reviewer waits until the pull request is quiet', () => {
    scenario('Pending checks wait', async () => {
      const passed = await passReview(
        {
          review: memoryPorts({
            pulls: {'11': [{id: '15', title: '#11: title', state: 'OPEN'}]},
            checks: {'15': {checks: 'pending'}},
            ranges: {'15': {head: reviewedHead, base: 'def'}},
          }).review,
          vcs: {
            filesAt: () => files,
            compare: () => null,
            push() {},
            head: () => '',
            published: () => true,
            dirty: () => [],
          },
          judge: () => {
            throw new Error('judge');
          },
        },
        {issue: '11', pull: '15'},
      );
      assert.deepEqual(passed, {action: 'wait', reason: 'checks are pending'});
    });
    scenario('An unanswered comment waits', async () => {
      const {review, calls} = memoryPorts({
        pulls: {'11': [{id: '15', title: '#11: title', state: 'OPEN'}]},
        checks: {'15': {checks: 'green'}},
        ranges: {'15': {head: reviewedHead, base: 'def'}},
        comments: {'15': [{robot: false, body: 'please rebase'}]},
      });
      const passed = await passReview(
        {
          review,
          vcs: {
            filesAt: () => files,
            compare: () => null,
            push() {},
            head: () => '',
            published: () => true,
            dirty: () => [],
          },
          judge: () => {
            throw new Error('judge');
          },
        },
        {issue: '11', pull: '15'},
      );
      assert.deepEqual(passed, {action: 'wait', reason: 'unanswered comment'});
      assert.equal(calls.includes('merge:15'), false);
    });
    scenario('An open layer does not call the judge', async () => {
      let called = 0;
      const box = memoryPorts({
        pulls: {'11': [{id: '15', title: '#11: title', state: 'OPEN'}]},
        checks: {'15': {checks: 'green'}},
        ranges: {'15': {head: reviewedHead, base: 'def'}},
        comments: {'15': [{robot: true, body: '🤖 sdd:layer=code → implementing'}]},
      });
      const passed = await passReview(
        {
          review: box.review,
          vcs: {
            filesAt: () => files,
            compare: () => null,
            push() {},
            head: () => '',
            published: () => true,
            dirty: () => [],
          },
          judge: () => {
            called += 1;
            return {kind: 'clean'};
          },
        },
        {issue: '11', pull: '15'},
      );
      assert.deepEqual(passed, {action: 'wait', reason: 'open layer'});
      assert.equal(called, 0);
      assert.equal(box.calls.includes('merge:15'), false);
      assert.equal(box.calls.includes('say'), false);
    });
    scenario('A reviewed head merges without the judge', async () => {
      const box = memoryPorts({
        pulls: {'11': [{id: '15', title: '#11: title', state: 'OPEN'}]},
        checks: {'15': {checks: 'green'}},
        ranges: {'15': {head: reviewedHead, base: 'def'}},
        comments: {'15': [{robot: true, body: `🤖 sdd:note reviewed ${reviewedHead}`}]},
      });
      const passed = await passReview(
        {
          review: box.review,
          vcs: {
            filesAt: () => files,
            compare: () => null,
            push() {},
            head: () => '',
            published: () => true,
            dirty: () => [],
          },
          judge: () => {
            throw new Error('judge');
          },
        },
        {issue: '11', pull: '15'},
      );
      assert.deepEqual(passed, {action: 'clean'});
      assert.ok(box.calls.includes('merge:15'));
    });
    scenario('An empty head does not match another note', async () => {
      const box = memoryPorts({
        pulls: {'11': [{id: '15', title: '#11: title', state: 'OPEN'}]},
        checks: {'15': {checks: 'green'}},
        ranges: {'15': {head: '', base: 'def'}},
        comments: {'15': [{robot: true, body: `🤖 sdd:note reviewed ${reviewedHead}`}]},
      });
      const passed = await passReview(
        {
          review: box.review,
          vcs: {
            filesAt: () => files,
            compare: () => null,
            push() {},
            head: () => '',
            published: () => true,
            dirty: () => [],
          },
          judge: () => ({kind: 'clean'}),
        },
        {issue: '11', pull: '15'},
      );
      assert.deepEqual(passed, {action: 'wait', reason: 'head does not resolve'});
      assert.equal(box.calls.includes('merge:15'), false);
    });
  });

  requirement('The verdict posts a note, remarks, or nothing', () => {
    scenario('An empty answer posts nothing and the command fails', async () => {
      const quiet = memoryPorts();
      await applyReview({kind: 'unjudged', reason: 'empty answer'}, '15', reviewedHead, quiet.review);
      assert.deepEqual(quiet.calls, []);
      const {tracker, review, calls} = memoryPorts({
        issues: [
          {
            key: '11',
            title: '#11: title',
            body: '',
            state: 'OPEN',
            labels: ['sdd:cycle', 'sdd:accepting', 'sdd:auto-review'],
          },
        ],
        pulls: {'11': [{id: '15', title: '#11: title', state: 'OPEN'}]},
        checks: {'15': {checks: 'green'}},
        ranges: {'15': {head: reviewedHead, base: 'def'}},
      });
      const box = machine(process.cwd(), {
        config: {queues: [{name: 'Sandcastle'}]},
        tracker,
        review,
        vcs: {
          filesAt: () => namedFiles({'openspec/changes/archive/issue-11/proposal.md': 'why'}),
          compare: () => ({commits: 'abc', diff: 'diff --git a/a'}),
          push() {},
          head: () => '',
          published: () => true,
          dirty: () => [],
        },
      });
      const logged = console.log;
      console.log = () => {};
      let code = 0;
      try {
        code = await runReview(box, () => ({kind: 'unjudged', reason: 'empty answer'}));
      } finally {
        console.log = logged;
      }
      assert.equal(code, 1);
      assert.equal(calls.includes('say'), false);
      assert.equal(calls.includes('merge:15'), false);
    });
    scenario('A clean verdict notes the head and merges', async () => {
      const clean = memoryPorts();
      await applyReview({kind: 'clean'}, '15', reviewedHead, clean.review);
      assert.ok(clean.calls.includes(`body:🤖 sdd:note reviewed ${reviewedHead}`));
      assert.ok(clean.calls.includes('merge:15'));
    });
    scenario('Remarks are one comment and carry no robot mark', async () => {
      const remarks = memoryPorts();
      await applyReview(
        {
          kind: 'remarks',
          items: [
            {body: '  '},
            {body: 'Scenario TTL is missing'},
            {body: 'The diff skips the requirement'},
          ],
        },
        '15',
        reviewedHead,
        remarks.review,
      );
      assert.ok(
        remarks.calls.includes('body:Scenario TTL is missing\n\nThe diff skips the requirement'),
      );
      assert.equal(
        remarks.calls.some(call => call.includes('🤖')),
        false,
      );
      assert.equal(remarks.calls.includes('merge:15'), false);
    });
    scenario('A remark that carries a marker is dropped', () => {
      const verdict = parseVerdict(
        'remark: sdd:layer=code\nremark: 🤖 rebase\nremark: Scenario TTL is missing',
      );
      assert.deepEqual(verdict, {kind: 'remarks', items: [{body: 'Scenario TTL is missing'}]});
    });
    scenario('At most five remarks are kept', () => {
      const verdict = parseVerdict(
        ['one', 'two', 'three', 'four', 'five', 'six'].map(item => `remark: ${item}`).join('\n'),
      );
      assert.equal(verdict.kind, 'remarks');
      if (verdict.kind === 'remarks') {
        assert.deepEqual(
          verdict.items.map(item => item.body),
          ['one', 'two', 'three', 'four', 'five'],
        );
      }
    });
    scenario('Clean and an empty answer are read from the text', () => {
      assert.deepEqual(parseVerdict('clean'), {kind: 'clean'});
      assert.deepEqual(parseVerdict(''), {kind: 'unjudged', reason: 'empty answer'});
    });
  });

  requirement('A remark lands on a diff line only when that line is in the diff', () => {
    scenario('A line in the diff stays on that line', () => {
      assert.deepEqual(
        placeOnDiff(reviewDiff, {body: 'on the addition', path: 'src/cache.ts', line: 13}),
        {
          body: 'on the addition',
          path: 'src/cache.ts',
          line: 13,
        },
      );
    });
    scenario('A line outside the hunk keeps the file', () => {
      assert.deepEqual(
        placeOnDiff(reviewDiff, {body: 'elsewhere', path: 'src/cache.ts', line: 99}),
        {
          body: 'elsewhere',
          path: 'src/cache.ts',
        },
      );
    });
    scenario('A file outside the diff is left on the conversation', () => {
      assert.deepEqual(
        placeOnDiff(reviewDiff, {body: 'no such file', path: 'src/other.ts', line: 1}),
        {
          body: 'no such file',
        },
      );
    });
  });

  requirement('A dossier that cannot be assembled waits', () => {
    scenario('No base waits before the diff', async () => {
      let called = 0;
      const box = memoryPorts({
        pulls: {'11': [{id: '15', title: '#11: title', state: 'OPEN'}]},
        checks: {'15': {checks: 'green'}},
        ranges: {'15': {head: reviewedHead, base: null}},
      });
      const passed = await passReview(
        {
          review: box.review,
          vcs: {
            filesAt: () => files,
            compare: () => null,
            push() {},
            head: () => '',
            published: () => true,
            dirty: () => [],
          },
          judge: () => {
            called += 1;
            return {kind: 'clean'};
          },
        },
        {issue: '11', pull: '15'},
      );
      assert.deepEqual(passed, {action: 'wait', reason: 'base does not resolve'});
      assert.equal(called, 0);
    });
    scenario('A missing range waits', async () => {
      let called = 0;
      const box = memoryPorts({
        pulls: {'11': [{id: '15', title: '#11: title', state: 'OPEN'}]},
        checks: {'15': {checks: 'green'}},
        ranges: {'15': {head: reviewedHead, base: 'def'}},
      });
      const passed = await passReview(
        {
          review: box.review,
          vcs: {
            filesAt: () => namedFiles({'openspec/changes/archive/issue-11/proposal.md': 'why'}),
            compare: () => null,
            push() {},
            head: () => '',
            published: () => true,
            dirty: () => [],
          },
          judge: () => {
            called += 1;
            return {kind: 'clean'};
          },
        },
        {issue: '11', pull: '15'},
      );
      assert.deepEqual(passed, {action: 'wait', reason: 'range does not resolve'});
      assert.equal(called, 0);
    });
    scenario('An empty diff waits', () => {
      const built = assembleDossier({
        issue: '11',
        pull: '15',
        head: reviewedHead,
        base: 'def',
        commits: '',
        diff: '  ',
        files: namedFiles({'openspec/changes/issue-11/proposal.md': 'why'}),
      });
      assert.deepEqual(built, {kind: 'wait', reason: 'diff is empty'});
    });
    scenario('A change with no files waits', () => {
      const built = assembleDossier({
        issue: '11',
        pull: '15',
        head: reviewedHead,
        base: 'def',
        commits: 'abc',
        diff: 'diff --git a/a',
        files,
      });
      assert.deepEqual(built, {kind: 'wait', reason: 'change has no files'});
    });
    scenario('An archived change still fills the dossier', () => {
      const built = assembleDossier({
        issue: '11',
        pull: '15',
        head: reviewedHead,
        base: 'def',
        commits: 'abc',
        diff: 'diff --git a/a',
        files: namedFiles({'openspec/changes/archive/issue-11/proposal.md': 'why'}),
      });
      assert.equal(built.kind, 'ready');
      if (built.kind === 'ready') {
        assert.match(built.dossier.change, /why/);
      }
    });
  });
});

spec('mirror', () => {
  requirement("Mirror keeps the author's text", () => {
    scenario('A missing block is appended', () => {
      const next = updateMirror('Please look at cache.\n', 'Plan', 'one line');
      assert.match(
        next,
        /^Please look at cache\.\n\n<!-- sdd:begin -->\nPlan: one line\n<!-- sdd:end -->\n$/,
      );
    });
    scenario('An existing layer line is replaced', () => {
      const body = [
        'intro',
        '',
        '<!-- sdd:begin -->',
        'Plan: old',
        'Specify: kept',
        '<!-- sdd:end -->',
        '',
      ].join('\n');
      const next = updateMirror(body, 'Plan', 'new');
      assert.match(next, /Plan: new/);
      assert.match(next, /Specify: kept/);
      assert.match(next, /^intro/);
    });
  });
});

function planIssue(
  key: string,
  labels: string[],
  body = '',
): {key: string; title: string; body: string; state: string; labels: string[]} {
  return {key, title: `#${key}: title`, body, state: 'OPEN', labels};
}

function planFiles(key: string): FileSource {
  if (key === '2') {
    const tasks = 'openspec/changes/issue-2/tasks.md';
    return {
      exists: rel => rel === tasks,
      read: rel => (rel === tasks ? '- [ ] slice\n' : ''),
      list: () => [],
    };
  }
  if (key === '3') {
    return {
      exists: rel => rel === 'openspec/changes/archive/issue-3',
      read: () => '',
      list: () => [],
    };
  }
  return files;
}

async function runPlan(
  issues: {key: string; title: string; body: string; state: string; labels: string[]}[],
  pulls: Record<string, {id: string; title: string; state: string}[]> = {},
  queues: {name: string}[] = [{name: 'Sandcastle'}],
): Promise<{printed: Decision; labels: (key: string) => Promise<string[]>; calls: string[]}> {
  const {tracker, review, calls} = memoryPorts({
    issues,
    pulls,
    checks: {'9': {checks: 'green'}},
  });
  const box = machine(process.cwd(), {
    config: {queues},
    tracker,
    review,
    vcs: {
      filesAt: planFiles,
      compare: () => null,
      push() {},
      head: () => '',
      published: () => true,
      dirty: () => [],
    },
  });
  const logged = console.log;
  const lines: string[] = [];
  console.log = line => {
    lines.push(String(line));
  };
  try {
    await runSdd(['plan'], box);
  } finally {
    console.log = logged;
  }
  return {
    printed: JSON.parse(lines.at(-1) ?? '{}') as Decision,
    labels: key => tracker.labels(key),
    calls,
  };
}

spec('plan', () => {
  requirement('Plan applies mechanical moves and prints one decision', () => {
    scenario('A phase move is applied and the first skill is printed', async () => {
      const {printed, labels, calls} = await runPlan(
        [
          planIssue('1', ['Sandcastle', 'sdd:cycle', 'sdd:proposed']),
          planIssue('2', ['Sandcastle', 'sdd:cycle', 'sdd:implementing']),
          planIssue('3', ['Sandcastle', 'sdd:cycle', 'sdd:accepting', 'sdd:auto-merge']),
        ],
        {'3': [{id: '9', title: '#3: title', state: 'OPEN'}]},
      );
      assert.ok((await labels('1')).includes('sdd:proposing'));
      assert.equal(printed.kind, 'agent');
      if (printed.kind === 'agent') {
        assert.equal(printed.issue, '1');
      }
      assert.ok((await labels('2')).includes('sdd:implementing'));
      assert.ok((await labels('3')).includes('sdd:accepting'));
      assert.equal(calls.includes('merge:9'), false);
    });
    scenario('A merge is printed and not performed', async () => {
      const {printed, labels, calls} = await runPlan(
        [planIssue('3', ['Sandcastle', 'sdd:cycle', 'sdd:accepting', 'sdd:auto-merge'])],
        {'3': [{id: '9', title: '#3: title', state: 'OPEN'}]},
      );
      assert.equal(printed.kind, 'merge');
      if (printed.kind === 'merge') {
        assert.equal(printed.issue, '3');
      }
      assert.ok((await labels('3')).includes('sdd:accepting'));
      assert.equal(calls.includes('merge:9'), false);
    });
    scenario('Several waits are printed as one', async () => {
      const {printed} = await runPlan([
        planIssue('1', ['Sandcastle', 'sdd:cycle', 'sdd:verifying']),
        planIssue('4', ['Sandcastle', 'sdd:cycle', 'sdd:verifying']),
      ]);
      assert.equal(printed.kind, 'wait');
      if (printed.kind === 'wait') {
        assert.match(printed.reason, /#1/);
        assert.match(printed.reason, /#4/);
      }
    });
    scenario('A decision with no issue names the first queue', async () => {
      const {printed} = await runPlan([], {}, [{name: 'FIRST'}, {name: 'SECOND'}]);
      assert.equal(printed.issue, null);
      const named = printed as typeof printed & {queue?: string; base?: string};
      assert.equal(named.queue, 'FIRST');
      assert.equal(named.base, 'trunk');
    });
  });
});

function proposalFiles(key: string): FileSource {
  const proposal = `openspec/changes/issue-${key}/proposal.md`;
  return {
    exists: rel => rel === proposal,
    read: () => '# Proposal\n\n## Why\n\nBecause.\n',
    list: () => [],
  };
}

async function runStep(
  argv: string[],
  issues: {key: string; title: string; body: string; state: string; labels: string[]}[],
  filesAt: (key: string) => FileSource,
  pulls: Record<string, {id: string; title: string; state: string}[]> = {},
  queues: {name: string}[] = [{name: 'Sandcastle'}],
): Promise<{printed: Decision; labels: (key: string) => Promise<string[]>; calls: string[]}> {
  const {tracker, review, calls} = memoryPorts({
    issues,
    pulls,
    checks: {'9': {checks: 'green'}},
  });
  const box = machine(process.cwd(), {
    config: {queues},
    tracker,
    review,
    vcs: {
      filesAt,
      compare: () => null,
      push() {},
      head: () => '',
      published: () => true,
      dirty: () => [],
    },
    runtime: {
      async run() {
        calls.push('runtime');
        return {commits: 0};
      },
      async ask() {
        return {text: ''};
      },
    },
  });
  const logged = console.log;
  const lines: string[] = [];
  console.log = line => {
    lines.push(String(line));
  };
  try {
    await runSdd(argv, box);
  } finally {
    console.log = logged;
  }
  return {
    printed: JSON.parse(lines.at(-1) ?? '{}') as Decision,
    labels: key => tracker.labels(key),
    calls,
  };
}

function serviceRepo(): string {
  const service = mkdtempSync(path.join(tmpdir(), 'sdd-wt-'));
  const git = (args: string[]) => execFileSync('git', args, {cwd: service, encoding: 'utf8'});
  git(['init', '-q']);
  git(['symbolic-ref', 'HEAD', 'refs/heads/master']);
  writeFileSync(path.join(service, 'README'), 'x\n');
  git(['add', '.']);
  git(['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'base']);
  git(['update-ref', 'refs/remotes/origin/trunk', 'HEAD']);
  return service;
}

async function runWorktree(service: string, key: string): Promise<string> {
  const {tracker, review} = memoryPorts({issues: [planIssue(key, ['sdd:cycle'])]});
  const box = machine(service, {
    config: {queues: [{name: 'Sandcastle'}]},
    tracker,
    review,
  });
  const logged = console.log;
  const lines: string[] = [];
  console.log = line => {
    lines.push(String(line));
  };
  try {
    await runSdd(['worktree', key], box);
  } finally {
    console.log = logged;
  }
  return lines.at(-1) ?? '';
}

spec('step', () => {
  requirement('Step settles one issue and prints its decision', () => {
    scenario('One issue moves and another stays', async () => {
      const {printed, labels, calls} = await runStep(
        ['step', '1'],
        [
          planIssue('1', ['Sandcastle', 'sdd:cycle', 'sdd:proposed']),
          planIssue('2', ['Sandcastle', 'sdd:cycle', 'sdd:implementing']),
        ],
        planFiles,
      );
      assert.ok((await labels('1')).includes('sdd:proposing'));
      assert.equal(printed.kind, 'agent');
      if (printed.kind === 'agent') {
        assert.equal(printed.issue, '1');
      }
      assert.ok((await labels('2')).includes('sdd:implementing'));
      assert.equal(calls.includes('runtime'), false);
    });
    scenario('The printed decision names the queue and the base', async () => {
      const {printed} = await runStep(
        ['step', '1'],
        [planIssue('1', ['Sandcastle', 'sdd:cycle', 'sdd:proposed'])],
        planFiles,
      );
      const named = printed as typeof printed & {queue?: string; base?: string};
      assert.equal(named.queue, 'Sandcastle');
      assert.equal(named.base, 'trunk');
    });
    scenario('The printed queue is the issue queue', async () => {
      const {printed} = await runStep(
        ['step', '1'],
        [planIssue('1', ['SECOND', 'FIRST', 'sdd:cycle', 'sdd:proposed'])],
        planFiles,
        {},
        [{name: 'FIRST'}, {name: 'SECOND'}],
      );
      const named = printed as typeof printed & {queue?: string; base?: string};
      assert.equal(named.queue, 'FIRST');
      assert.equal(named.base, 'trunk');
    });
    scenario('A decision outside the cycle still names them', async () => {
      const {printed} = await runStep(['step', '7'], [planIssue('7', ['sdd:proposing'])], planFiles);
      assert.equal(printed.kind, 'done');
      const named = printed as typeof printed & {queue?: string; base?: string};
      assert.equal(named.queue, 'Sandcastle');
      assert.equal(named.base, 'trunk');
    });
    scenario('A merge is performed', async () => {
      const {printed, labels, calls} = await runStep(
        ['step', '3'],
        [planIssue('3', ['Sandcastle', 'sdd:cycle', 'sdd:accepting', 'sdd:auto-merge'])],
        planFiles,
        {'3': [{id: '9', title: '#3: title', state: 'OPEN'}]},
      );
      assert.equal(printed.kind, 'done');
      if (printed.kind === 'done') {
        assert.equal(printed.reason, 'pull request merged');
      }
      assert.ok((await labels('3')).includes('sdd:accepted'));
      assert.equal((await labels('3')).includes('sdd:accepting'), false);
      assert.equal(calls.filter(call => call === 'merge:9').length, 1);
      assert.ok(calls.some(call => call.startsWith('close:')));
    });
  });

  requirement('Auto tags are written only inside the cycle', () => {
    scenario('Auto-plan advances a ready proposal', async () => {
      const {labels} = await runStep(
        ['step', '1', '--auto-plan', '--auto-spec', '--auto-design'],
        [planIssue('1', ['Sandcastle', 'sdd:cycle', 'sdd:proposing'])],
        proposalFiles,
        {'1': [{id: '8', title: '#1: title', state: 'OPEN'}]},
      );
      assert.ok((await labels('1')).includes('sdd:auto-plan'));
      assert.ok((await labels('1')).includes('sdd:auto-spec'));
      assert.ok((await labels('1')).includes('sdd:auto-design'));
      assert.ok((await labels('1')).includes('sdd:specifying'));
    });
    scenario('A flag outside the cycle writes nothing', async () => {
      const {printed, labels} = await runStep(
        ['step', '7', '--auto-plan'],
        [planIssue('7', ['sdd:proposing'])],
        proposalFiles,
      );
      assert.equal(printed.kind, 'done');
      assert.equal((await labels('7')).includes('sdd:auto-plan'), false);
    });
  });

  requirement('Worktree prepares the session checkout', () => {
    scenario('A missing checkout is created', async () => {
      const service = serviceRepo();
      const printed = await runWorktree(service, '1');
      const checkout = path.join(service, '.worktrees', 'sdd-1');
      assert.equal(printed, checkout);
      assert.equal(existsSync(checkout), true);
      const head = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        cwd: checkout,
        encoding: 'utf8',
      }).trim();
      assert.equal(head, 'sdd/1');
      assert.equal(lstatSync(path.join(checkout, '.sandcastle', 'prompts')).isSymbolicLink(), true);
      const status = execFileSync('git', ['status', '--porcelain'], {
        cwd: service,
        encoding: 'utf8',
      });
      assert.equal(status.includes('.worktrees'), false);
    });
    scenario('A dirty checkout is reused', async () => {
      const service = serviceRepo();
      const checkout = await runWorktree(service, '1');
      writeFileSync(path.join(checkout, 'note.txt'), 'keep\n');
      const again = await runWorktree(service, '1');
      assert.equal(again, checkout);
      assert.equal(readFileSync(path.join(checkout, 'note.txt'), 'utf8'), 'keep\n');
    });
  });
});
