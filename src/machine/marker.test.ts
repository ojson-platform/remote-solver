import assert from 'node:assert/strict';
import {test} from 'vitest';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {memoryPorts} from '../adapters/github.ts';
import {fixThread} from '../sdd.ts';
import {action, change, issue, pull, ready} from './harness.ts';
import {markerName, mentionsGrammar, parseMarker} from './marker.ts';
import {decide} from './policy.ts';
import {readReview, reviewOf, spokeByRobot, threadsReport, type OpenItemFile} from './review.ts';

test('one parser reads every marker, fixed first, then note, then a layer', () => {
  assert.deepEqual(parseMarker('🤖 sdd:layer=spec → specifying'), {kind: 'layer', layer: 'spec'});
  assert.deepEqual(parseMarker('sdd:note baseline'), {kind: 'note'});
  assert.deepEqual(parseMarker('🤖 sdd:fixed abc123'), {kind: 'fixed', commit: 'abc123'});
  assert.deepEqual(parseMarker('sdd:fixed'), {kind: 'fixed', commit: null});
  assert.deepEqual(parseMarker('<!-- sdd:begin -->'), {kind: 'begin'});
  assert.deepEqual(parseMarker('sdd:layer=code sdd:fixed abc'), {kind: 'fixed', commit: 'abc'});
  assert.deepEqual(parseMarker('sdd:note sdd:layer=code'), {kind: 'note'});
  assert.equal(parseMarker('please fix the name'), null);
  assert.equal(parseMarker('sdd:layer=Spec'), null);
  assert.equal(markerName(parseMarker('sdd:layer=code')), 'code');
  assert.equal(markerName(parseMarker('sdd:fixed abc')), 'fixed');
  assert.equal(markerName(null), null);
});

test('a remark may not mention any marker token, even malformed, or the robot mark', () => {
  assert.equal(mentionsGrammar('rename the cache'), false);
  assert.equal(mentionsGrammar('sdd:layer=Spec'), true);
  assert.equal(mentionsGrammar('see sdd:fixed'), true);
  assert.equal(mentionsGrammar('🤖 done'), true);
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
  });

  requirement('A conversation marker does not take the phase', () => {
    const codeTalk = [
      {robot: false, body: 'Перед архивацией обновить face.md'},
      {robot: true, body: '🤖 sdd:layer=code → implementing'},
    ];
    scenario('A conversation code marker during implementing leaves the next task', () => {
      const review = reviewOf([], codeTalk);
      const decision = decide(
        issue(1, ['sdd:implementing']),
        [],
        [pull(9, {review})],
        change({...ready, openTasks: 1}),
      );
      assert.equal(review.rollback, null);
      assert.deepEqual(review.layers, []);
      assert.equal(action(decision), 'implement-next-task');
    });
    scenario('A conversation code marker with no open task moves on to verifying', () => {
      const decision = decide(
        issue(1, ['sdd:implementing']),
        [],
        [pull(9, {review: reviewOf([], codeTalk)})],
        ready,
      );
      assert.deepEqual(decision, {
        kind: 'advance',
        issue: '1',
        to: 'verifying',
        reason: 'no open tasks',
      });
    });
    scenario('A conversation code marker on accepting does not move to implementing', () => {
      const decision = decide(
        issue(1, ['sdd:accepting']),
        [],
        [pull(9, {checks: 'green', review: reviewOf([], codeTalk)})],
        change({archived: true}),
      );
      assert.deepEqual(decision, {
        kind: 'wait',
        issue: '1',
        reason: 'wait for merge of PR #9',
      });
    });
    scenario('A later fixed clears the conversation layer', () => {
      const review = readReview(
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
      assert.equal(review.conversation.layer, null);
      assert.equal(decision.kind, 'wait');
    });
  });

  requirement('A classified marker moves before a held review gate', () => {
    scenario('An unlabeled thread during a held design review is classified', () => {
      const decision = decide(
        issue(1, ['sdd:designing', 'sdd:wait-human']),
        [],
        [pull(9, {review: {unanswered: true, rollback: null, layers: []}})],
        ready,
      );
      assert.equal(action(decision), 'classify-comments');
    });
    scenario('A spec marker during a held design review moves to specifying', () => {
      const decision = decide(
        issue(1, ['sdd:designing', 'sdd:wait-human']),
        [],
        [
          pull(9, {
            review: {unanswered: false, rollback: 'specifying', layers: ['spec', 'design']},
          }),
        ],
        ready,
      );
      assert.deepEqual(decision, {
        kind: 'advance',
        issue: '1',
        to: 'specifying',
        reason: 'review thread sent the change back',
      });
    });
    scenario('A design marker during a held design review improves the design', () => {
      const decision = decide(
        issue(1, ['sdd:designing', 'sdd:wait-human']),
        [],
        [pull(9, {review: {unanswered: false, rollback: 'designing', layers: ['design']}})],
        ready,
      );
      assert.equal(action(decision), 'improve-design');
    });
  });

  requirement('An open item keeps its file\'s layer', () => {
    const designFile = 'openspec/changes/issue-1/design.md';
    const proposalFile = 'openspec/changes/issue-1/proposal.md';
    const design = [
      '## Approach',
      '',
      'stay',
      '',
      '## Open decisions',
      '',
      '- [ ] which write',
    ].join('\n');
    const proposal = [
      '## Outcome',
      '',
      'the field moves',
      '',
      '## Open questions',
      '',
      '- [ ] which write',
    ].join('\n');
    const files = (text: Record<string, string>): OpenItemFile => rel => text[rel];
    const designFiles = files({[designFile]: design});

    scenario('A spec marker on an open decision stays on design', () => {
      const thread = {
        id: 'T1',
        comment: '11',
        path: designFile,
        line: 7,
        resolved: false,
        body: 'sdd:layer=spec → specifying',
      };
      const review = reviewOf([thread], [], designFiles);
      const decision = decide(
        issue(1, ['sdd:designing', 'sdd:auto-design']),
        [],
        [pull(9, {review})],
        change({proposal: true, delta: true, design: true, openDecisions: 1}),
      );
      assert.equal(action(decision), 'improve-design');
      assert.deepEqual(
        threadsReport([thread], [], {layer: 'design'}, designFiles).threads.map(item => item.thread),
        ['T1'],
      );
      assert.deepEqual(threadsReport([thread], [], {layer: 'spec'}, designFiles).threads, []);
    });

    scenario('An unmarked reply on an open decision is design', () => {
      const thread = {
        id: 'T1',
        comment: '11',
        path: designFile,
        line: 7,
        resolved: false,
        body: 'keep the factory-config write',
      };
      const review = reviewOf([thread], [], designFiles);
      assert.equal(review.unanswered, false);
      assert.deepEqual(
        threadsReport([thread], [], {layer: 'design'}, designFiles).threads.map(item => item.thread),
        ['T1'],
      );
      assert.deepEqual(threadsReport([thread], [], {unmarked: true}, designFiles).threads, []);
    });

    scenario('A spec marker on an open question stays on proposal', () => {
      const proposalFiles = files({[proposalFile]: proposal});
      const thread = {
        id: 'T1',
        comment: '11',
        path: proposalFile,
        line: 7,
        resolved: false,
        body: 'sdd:layer=spec → specifying',
      };
      const review = reviewOf([thread], [], proposalFiles);
      const decision = decide(
        issue(1, ['sdd:proposing', 'sdd:auto-plan']),
        [],
        [pull(9, {review})],
        change({proposal: true, openQuestions: 1}),
      );
      assert.equal(action(decision), 'improve-proposal');
    });

    scenario('A spec marker on another design line moves to specifying', () => {
      const thread = {
        resolved: false,
        path: designFile,
        line: 3,
        body: 'sdd:layer=spec → specifying',
      };
      const decision = decide(
        issue(1, ['sdd:designing']),
        [],
        [pull(9, {review: reviewOf([thread], [], designFiles)})],
        change({proposal: true, delta: true, design: true, openDecisions: 1}),
      );
      assert.deepEqual(decision, {
        kind: 'advance',
        issue: '1',
        to: 'specifying',
        reason: 'review thread sent the change back',
      });
    });

    scenario('A checked decision keeps the reply\'s layer', () => {
      const checked = design.replace('- [ ] which write', '- [x] which write');
      const review = reviewOf(
        [
          {
            resolved: false,
            path: designFile,
            line: 7,
            body: 'sdd:layer=spec → specifying',
          },
        ],
        [],
        files({[designFile]: checked}),
      );
      assert.equal(review.rollback, 'specifying');
    });

    scenario('Fix refuses while the open item is unchecked', async () => {
      const memory = memoryPorts({
        threadList: {
          '12': [
            {
              id: 'PRRT_1',
              comment: '41',
              path: designFile,
              line: 7,
              resolved: false,
              body: 'sdd:layer=spec → specifying',
            },
          ],
        },
      });
      await assert.rejects(
        fixThread(
          {key: '7', pull: '12', thread: 'PRRT_1'},
          {
            review: memory.review,
            vcs: {head: async () => 'abc123', published: async () => true},
            readFile: designFiles,
          },
        ),
        /still an open item/,
      );
      assert.deepEqual(memory.calls, ['threadList']);
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
