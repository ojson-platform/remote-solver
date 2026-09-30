import assert from 'node:assert/strict';
import {test} from 'vitest';

import type {ChangeView} from './change.ts';
import {
  accept,
  decide,
  publishChoice,
  settle,
  severalOpenReason,
  writingGate,
  type PullSnapshot,
} from './policy.ts';
import type {IssueRecord} from './port.ts';
import {emptyReview} from './review.ts';

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
    title: `#1: title`,
    state: 'OPEN',
    review: emptyReview,
    checks: 'none',
    ...over,
  };
}

const ready = change({proposal: true, delta: true, design: true, tasks: true});

test('a cycle with no phase enters proposing', () => {
  const decision = decide(issue(1, ['Sandcastle', 'sdd:cycle']), [], [], change());
  assert.deepEqual(decision, {
    kind: 'advance',
    issue: '1',
    to: 'proposing',
    reason: 'enter the cycle',
  });
});

test('cancelled is done', () => {
  const decision = decide(issue(1, ['sdd:cancelled', 'sdd:proposing']), [], [], change());
  assert.equal(decision.kind, 'done');
});

test('proposing without a proposal asks the plan skill to write one', () => {
  const decision = decide(issue(1, ['sdd:proposing']), [], [pull(9)], change());
  assert.equal(decision.kind, 'agent');
  if (decision.kind === 'agent') {
    assert.equal(decision.action, 'create-proposal');
    assert.equal(decision.skill, 'sdd-plan');
    assert.equal(decision.pr, '9');
  }
});

test('open questions block proposing even when the auto tag is set', () => {
  const decision = decide(
    issue(1, ['sdd:proposing', 'sdd:auto-plan']),
    [],
    [pull(9)],
    change({proposal: true, openQuestions: 2}),
  );
  assert.equal(decision.kind, 'wait');
  if (decision.kind === 'wait') {
    assert.match(decision.reason, /2 open question/);
  }
});

test('auto-plan advances once the proposal has no open questions', () => {
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

test('wait-human holds even when the auto tag is set', () => {
  const held = decide(
    issue(1, ['sdd:specifying', 'sdd:wait-human', 'sdd:auto-spec']),
    [],
    [pull(9)],
    change({proposal: true, delta: true}),
  );
  assert.equal(held.kind, 'wait');
  if (held.kind === 'wait') {
    assert.equal(held.gate, undefined);
  }
});

const gates = [
  {phase: 'proposing', gate: 'proposed', artifact: 'proposal', tag: 'sdd:auto-plan', next: 'specifying'},
  {phase: 'specifying', gate: 'specified', artifact: 'spec', tag: 'sdd:auto-spec', next: 'designing'},
  {phase: 'designing', gate: 'designed', artifact: 'design', tag: 'sdd:auto-design', next: 'tasking'},
] as const;

for (const gate of gates) {
  test(`a published ${gate.artifact} without ${gate.tag} opens the review gate once`, () => {
    const opened = decide(issue(1, [`sdd:${gate.phase}`]), [], [pull(9)], ready);
    assert.equal(opened.kind, 'wait');
    if (opened.kind === 'wait') {
      assert.deepEqual(opened.gate, {artifact: gate.artifact, from: gate.phase, to: gate.gate});
    }

    const held = decide(issue(1, [`sdd:${gate.phase}`, 'sdd:wait-human']), [], [pull(9)], ready);
    assert.equal(held.kind, 'wait');
    if (held.kind === 'wait') {
      assert.equal(held.gate, undefined);
    }

    const auto = decide(issue(1, [`sdd:${gate.phase}`, gate.tag]), [], [pull(9)], ready);
    assert.deepEqual(auto, {kind: 'advance', issue: '1', to: gate.next, reason: gate.tag});
  });

  test(`a person who sets ${gate.gate} on a ready change moves it to ${gate.next}`, () => {
    const labels = [`sdd:${gate.phase}`, `sdd:${gate.gate}`, 'sdd:wait-human'];
    const decision = decide(issue(1, labels), [], [pull(9)], ready);
    assert.deepEqual(decision, {
      kind: 'advance',
      issue: '1',
      to: gate.next,
      reason: `${gate.phase} → ${gate.next}`,
      comment: `sdd:accept ${gate.phase} → ${gate.next}`,
    });
  });
}

test('a gate phase over a missing artifact goes back and names the file', () => {
  const decision = decide(issue(1, ['sdd:specified']), [], [pull(9)], change({proposal: true}));
  assert.equal(decision.kind, 'advance');
  if (decision.kind === 'advance') {
    assert.equal(decision.to, 'specifying');
    assert.match(decision.comment ?? '', /Missing openspec\/changes\/issue-1\/specs/);
  }
});

test('a gate phase over open items goes back, waits without an ask, and asks once they are closed', () => {
  const open = change({proposal: true, delta: true, design: true, openDecisions: 1});
  const reverted = settle(issue(1, ['sdd:cycle', 'sdd:designed']), [], [pull(9)], open);
  assert.deepEqual(
    reverted.transitions.map(transition => transition.to),
    ['designing'],
  );
  assert.match(
    reverted.transitions[0].comment ?? '',
    /open items under ## Open decisions in openspec\/changes\/issue-1\/design\.md/,
  );
  assert.ok(reverted.labels.includes('sdd:designing'));
  assert.equal(reverted.decision.kind, 'wait');
  if (reverted.decision.kind === 'wait') {
    assert.equal(reverted.decision.gate, undefined);
  }

  const closed = settle(issue(1, reverted.labels), [], [pull(9)], ready);
  assert.equal(closed.decision.kind, 'wait');
  if (closed.decision.kind === 'wait') {
    assert.deepEqual(closed.decision.gate, {artifact: 'design', from: 'designing', to: 'designed'});
  }
});

test('an unlabeled thread is classified before the phase moves', () => {
  const decision = decide(
    issue(1, ['sdd:implementing']),
    [],
    [pull(9, {review: {unanswered: true, rollback: null, layers: []}})],
    ready,
  );
  assert.equal(decision.kind, 'agent');
  if (decision.kind === 'agent') {
    assert.equal(decision.action, 'classify-comments');
  }
});

test('a marker for an earlier phase moves the machine there', () => {
  const decision = decide(
    issue(1, ['sdd:implementing']),
    [],
    [pull(9, {review: {unanswered: false, rollback: 'specifying', layers: ['spec', 'code']}})],
    ready,
  );
  assert.deepEqual(decision, {
    kind: 'advance',
    issue: '1',
    to: 'specifying',
    reason: 'review thread sent the change back',
  });
});

test('out does not move the phase, and a code marker fixes implementation', () => {
  const decision = decide(
    issue(1, ['sdd:implementing']),
    [],
    [pull(9, {review: {unanswered: false, rollback: 'implementing', layers: ['out', 'code']}})],
    ready,
  );
  assert.equal(decision.kind, 'agent');
  if (decision.kind === 'agent') {
    assert.equal(decision.action, 'fix-implementation');
    assert.equal(decision.skill, 'sdd-fix');
  }
});

test('specifying restores a missing baseline before writing a delta', () => {
  const decision = decide(
    issue(1, ['sdd:specifying']),
    [],
    [pull(9)],
    change({proposal: true, missingBaseline: ['cache-first']}),
  );
  assert.equal(decision.kind, 'agent');
  if (decision.kind === 'agent') {
    assert.equal(decision.action, 'restore-baseline');
    assert.match(decision.reason, /cache-first/);
  }
});

test('specifying restores a missing baseline before it improves the specs', () => {
  const decision = decide(
    issue(1, ['sdd:specifying']),
    [],
    [pull(9, {review: {unanswered: false, rollback: 'specifying', layers: ['spec']}})],
    change({proposal: true, delta: true, missingBaseline: ['cache-first']}),
  );
  assert.equal(decision.kind, 'agent');
  if (decision.kind === 'agent') {
    assert.equal(decision.action, 'restore-baseline');
    assert.equal(decision.skill, 'sdd-baseline');
  }
});

test('tasking waits for a child that is not specified yet', () => {
  const parent = issue(1, ['sdd:tasking']);
  const child = issue(2, ['sdd:cycle', 'sdd:specifying'], {parent: '1'});
  const decision = decide(parent, [parent, child], [pull(9)], ready);
  assert.equal(decision.kind, 'wait');
  if (decision.kind === 'wait') {
    assert.match(decision.reason, /#2/);
  }
});

test('implementing waits for an open blocker, then verifies when the tasks are done', () => {
  const parent = issue(1, ['sdd:implementing'], {dependsOn: ['8']});
  const blocker = issue(8, ['sdd:cycle', 'sdd:implementing']);
  const waiting = decide(parent, [parent, blocker], [pull(9)], ready);
  assert.equal(waiting.kind, 'wait');
  const done = decide(issue(1, ['sdd:implementing']), [], [pull(9)], ready);
  assert.deepEqual(done, {kind: 'advance', issue: '1', to: 'verifying', reason: 'no open tasks'});
});

test('verifying classifies red checks, and follows a marker once one exists', () => {
  const red = decide(issue(1, ['sdd:verifying']), [], [pull(9, {checks: 'red'})], ready);
  assert.equal(red.kind, 'agent');
  if (red.kind === 'agent') {
    assert.equal(red.action, 'classify-failures');
  }
  const back = decide(
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
  assert.deepEqual(back, {
    kind: 'advance',
    issue: '1',
    to: 'implementing',
    reason: 'review thread sent the change back',
  });
});

test('verifying accepts a pull request once its checks are green', () => {
  const waiting = decide(
    issue(1, ['sdd:verifying']),
    [],
    [pull(9, {checks: 'pending'})],
    ready,
  );
  assert.equal(waiting.kind, 'wait');
  const accepted = decide(
    issue(1, ['sdd:verifying']),
    [],
    [pull(9, {checks: 'green'})],
    ready,
  );
  assert.deepEqual(accepted, {
    kind: 'advance',
    issue: '1',
    to: 'accepting',
    reason: 'checks are green',
  });
});

test('a green pull request with a marker rolls back', () => {
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

test('several open pull requests stop the cycle before any step', () => {
  const decision = decide(
    issue(1, ['sdd:proposing']),
    [],
    [pull(3), pull(4)],
    change({proposal: true}),
  );
  assert.equal(decision.kind, 'wait');
  if (decision.kind === 'wait') {
    assert.equal(decision.reason, severalOpenReason(['3', '4']));
  }
  const accepted = decide(
    issue(1, ['sdd:accepted']),
    [],
    [pull(3), pull(4)],
    change({archived: true}),
  );
  assert.equal(accepted.reason, severalOpenReason(['3', '4']));
  const gate = decide(
    issue(1, ['sdd:proposing', 'sdd:proposed']),
    [],
    [pull(3), pull(4)],
    change({proposal: true}),
  );
  assert.equal(gate.kind, 'wait');
  if (gate.kind === 'wait') {
    assert.equal(gate.reason, severalOpenReason(['3', '4']));
  }
  const entering = decide(issue(1, ['sdd:cycle']), [], [pull(3), pull(4)], change());
  assert.equal(entering.kind, 'wait');
});

test('publish reuses one open pull request and refuses several', () => {
  assert.deepEqual(publishChoice(['9']), {ok: true, id: '9'});
  assert.deepEqual(publishChoice([]), {ok: true, id: null});
  assert.deepEqual(publishChoice(['3', '4']), {ok: false, reason: severalOpenReason(['3', '4'])});
});

test('accepted archives a change that is still open, then closes only a merged pull request', () => {
  const archive = decide(
    issue(1, ['sdd:accepted']),
    [],
    [pull(9, {state: 'MERGED'})],
    change({proposal: true}),
  );
  assert.equal(archive.kind, 'agent');
  if (archive.kind === 'agent') {
    assert.equal(archive.action, 'archive');
  }
  const open = decide(issue(1, ['sdd:accepted']), [], [pull(9)], change({archived: true}));
  assert.deepEqual(open, {
    kind: 'wait',
    issue: '1',
    reason: 'wait for green checks before merge of PR #9',
  });
  const missing = decide(issue(1, ['sdd:accepted']), [], [], change({archived: true}));
  assert.deepEqual(missing, {
    kind: 'wait',
    issue: '1',
    reason: 'accepted needs a merged pull request',
  });
  const close = decide(
    issue(1, ['sdd:accepted']),
    [],
    [pull(9, {state: 'MERGED'})],
    change({archived: true}),
  );
  assert.deepEqual(close, {
    kind: 'advance',
    issue: '1',
    to: 'accepted',
    reason: 'pull request merged',
  });
});

test('a green archived pull request waits for a person to merge, and sdd:auto-merge merges', () => {
  const green = pull(9, {checks: 'green'});
  const ready = change({archived: true});
  assert.deepEqual(decide(issue(1, ['sdd:accepting']), [], [green], ready), {
    kind: 'wait',
    issue: '1',
    reason: 'wait for merge of PR #9',
  });
  assert.deepEqual(decide(issue(1, ['sdd:accepting', 'sdd:auto-merge']), [], [green], ready), {
    kind: 'merge',
    issue: '1',
    pull: '9',
    reason: 'merge PR #9',
  });
  assert.deepEqual(decide(issue(1, ['sdd:accepted']), [], [green], ready), {
    kind: 'wait',
    issue: '1',
    reason: 'wait for merge of PR #9',
  });
  assert.deepEqual(decide(issue(1, ['sdd:accepting']), [], [pull(9, {state: 'MERGED'})], ready), {
    kind: 'advance',
    issue: '1',
    to: 'accepted',
    reason: 'pull request merged',
  });
  const pending = decide(
    issue(1, ['sdd:accepting', 'sdd:auto-merge']),
    [],
    [pull(9, {checks: 'pending'})],
    ready,
  );
  assert.equal(pending.kind, 'wait');
});

test('an accepting pull request rolls back when a conversation layer is open', () => {
  const decision = decide(
    issue(1, ['sdd:accepting']),
    [],
    [
      pull(9, {
        checks: 'green',
        review: {unanswered: false, rollback: 'implementing', layers: ['code']},
      }),
    ],
    change({proposal: true, delta: true, design: true, tasks: true, archived: true}),
  );
  assert.deepEqual(decision, {
    kind: 'advance',
    issue: '1',
    to: 'implementing',
    reason: 'review thread sent the change back',
  });
});

test('the human gate and the auto tag share one writing gate', () => {
  assert.deepEqual(writingGate('proposing', change({proposal: true, openQuestions: 1})), {
    artifact: true,
    open: 1,
  });
  assert.deepEqual(writingGate('specifying', change()), {artifact: false, open: 0});
  assert.deepEqual(writingGate('designing', change({design: true})), {artifact: true, open: 0});
});

test('the human gate advances a reviewed proposal and refuses an open question', () => {
  const issueLabels = ['sdd:cycle', 'sdd:proposing'];
  assert.deepEqual(accept(issue(1, issueLabels), change({proposal: true})), {
    kind: 'advance',
    issue: '1',
    to: 'specifying',
    reason: 'proposing → specifying',
  });
  const blocked = accept(issue(1, issueLabels), change({proposal: true, openQuestions: 1}));
  assert.equal(blocked.kind, 'wait');
  if (blocked.kind === 'wait') {
    assert.match(blocked.reason, /## Open questions in openspec\/changes\/issue-1\/proposal\.md/);
  }
});

test('the human gate refuses accepting', () => {
  const labels = ['sdd:cycle', 'sdd:accepting'];
  const decision = accept(issue(1, labels), change({archived: true}));
  assert.equal(decision.kind, 'wait');
  if (decision.kind === 'wait') {
    assert.match(decision.reason, /accepting/);
  }
});

test('the human gate refuses a phase it does not close', () => {
  const decision = accept(issue(4, ['sdd:cycle', 'sdd:tasking']), ready);
  assert.equal(decision.kind, 'wait');
  if (decision.kind === 'wait') {
    assert.match(decision.reason, /tasking/);
  }
});

test('settle walks mechanical advances on labels and stops to close an accepted issue', () => {
  const walked = settle(
    issue(1, ['sdd:cycle', 'sdd:proposed', 'sdd:auto-spec', 'sdd:auto-design', 'sdd:wait-human']),
    [],
    [pull(9)],
    ready,
  );
  assert.deepEqual(
    walked.transitions.map(transition => transition.to),
    ['specifying', 'designing', 'tasking', 'implementing', 'verifying'],
  );
  assert.equal(walked.decision.kind, 'wait');
  assert.ok(!walked.labels.includes('sdd:wait-human'));
  assert.ok(walked.labels.includes('sdd:verifying'));

  const held = settle(issue(1, ['sdd:accepted']), [], [pull(9)], change({archived: true}));
  assert.deepEqual(held.transitions, []);
  assert.equal(held.decision.kind, 'wait');

  const closing = settle(
    issue(1, ['sdd:accepted']),
    [],
    [pull(9, {state: 'MERGED'})],
    change({archived: true}),
  );
  assert.deepEqual(
    closing.transitions.map(transition => transition.to),
    ['accepted'],
  );
  assert.deepEqual(closing.decision, {kind: 'done', issue: '1', reason: 'pull request merged'});
});
