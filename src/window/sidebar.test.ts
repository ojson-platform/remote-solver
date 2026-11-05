import assert from 'node:assert/strict';
import {rmSync} from 'node:fs';

import {requirement, scenario, spec} from '@ojson/spec-coverage';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

import {
  clampFocusPageIndex,
  FocusBlocks,
  focusIndexAfterSnapshot,
} from './client/sidebar.tsx';
import {renderWindow} from './client/render.ts';
import type {Decision} from '../machine/policy.ts';

import {focusBlockProse, liveFocus} from './focus.ts';
import {bandOf, held, hosted, MANAGER, post} from './page.harness.ts';
import {blocksFor} from './sidebar.ts';
import type {WindowSnapshot} from './snapshot.ts';
import type {BoardTurn, SidebarBlock, WindowTicket} from './types.ts';
import {
  columnCards,
  cycle,
  kinds,
  openSide,
  prepare,
  proveAnOpenCycleWhoseOnlySidebarBlockIsFocusShowsThatBlock113,
  proveTheSidebarFocusPlaqueDoesNotIncludeTheMarkerLine121,
  writeChange,
  yard,
} from './window.harness.ts';

function focusPagerHtml(snapshot: WindowSnapshot, pageIndex: number): string {
  const opened = snapshot.opened;
  if (!opened) {
    return '';
  }
  return renderToStaticMarkup(
    createElement(FocusBlocks, {blocks: opened.blocks, pageIndex}),
  );
}

function manyWrittenFocusPages(count: number) {
  return Array.from({length: count}, (_, index) =>
    focusBlock('sdd:focus:code', `Written page ${count - index}.\n`),
  );
}

function focusBlock(marker: string, body: string) {
  return {
    kind: 'focus' as const,
    marker,
    body,
    display: focusBlockProse(marker as import('../machine/marker.ts').FocusMarkerLine, body),
  };
}

function reviewGateWait(from: 'proposing' | 'specifying' | 'designing'): Decision {
  const gate = {
    proposing: {artifact: 'proposal', from: 'proposing' as const, to: 'proposed' as const},
    specifying: {artifact: 'spec', from: 'specifying' as const, to: 'specified' as const},
    designing: {artifact: 'design', from: 'designing' as const, to: 'designed' as const},
  };
  const row = gate[from];
  return {
    kind: 'wait',
    issue: '1',
    reason: `review the ${row.artifact}`,
    gate: row,
  };
}

function assertWrittenFocusIsOpen(blocks: SidebarBlock[]): void {
  assert.equal(blocks.some(block => block.kind === 'live'), false);
  assert.equal(blocks[0]?.kind, 'focus');
}

function sidebarBlocks(
  item: WindowTicket,
  over: {
    running?: boolean;
    turn?: BoardTurn;
    decision?: Decision;
  } = {},
): SidebarBlock[] {
  return blocksFor(item, {
    inPool: false,
    manager: () => undefined,
    review: () => undefined,
    reading: () => [],
    gathered: () => undefined,
    serviceBroken: () => false,
    cardOf: () => ({checkout: '', reason: ''}),
    running: () => over.running ?? false,
    turn: () => over.turn,
    settledDecision: () => over.decision,
  });
}

function openLivePage(blocks: readonly SidebarBlock[], pageIndex = 0): string {
  return renderToStaticMarkup(createElement(FocusBlocks, {blocks, pageIndex}));
}

async function sidebarHtml(url: string): Promise<string> {
  const response = await fetch(new URL('/snapshot', url));
  assert.equal(response.status, 200);
  return renderWindow((await response.json()) as WindowSnapshot);
}

function poolTicket(key: string, phase: string, over: Parameters<typeof cycle>[2] = {}) {
  return cycle(key, phase, {assignee: '', ...over});
}

function proveASpecifyingCycleWithNoOccasionHasNoReasonBlock(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openSide(home, [cycle('1', 'specifying')]);
  const card = columnCards(window.board(), 'specifying')?.[0];
  assert.equal(card?.icon, undefined);
  assert.equal(card?.reason, undefined);
  window.openCard('1');
  assert.equal(kinds(window.sidebar()).includes('reason'), false);
  rmSync(dir, {recursive: true, force: true});
}

function proveACardWithNoIconHasNoSidebarReasonBlock115(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openSide(
    home,
    [
      cycle('1', 'specifying', {
        labels: ['sdd:cycle', 'sdd:specifying', 'sdd:wait-human'],
        comments: [{body: 'please decide'}],
      }),
    ],
    {leading: key => key === '1'},
  );
  const card = columnCards(window.board(), 'specifying')?.[0];
  assert.equal(card?.icon, undefined);
  assert.equal(card?.reason, 'Ask');
  window.openCard('1');
  const blocks = window.sidebar();
  assert.deepEqual(blocks, [
    {kind: 'reason', line: 'Ask'},
    {kind: 'ask', body: 'please decide'},
  ]);
  rmSync(dir, {recursive: true, force: true});
}

function proveAQuestionOnlyCardHidesTheLineAndTheSidebarStillShowsIt116(): void {
  const {dir, home, arcadia} = yard();
  const checkout = prepare(arcadia, home);
  writeChange(checkout, 'b', 'proposal.md', '## Open questions\n\n- [ ] one\n- [ ] two\n');
  const window = openSide(home, [cycle('b', 'proposing')]);
  const card = columnCards(window.board(), 'proposing')?.[0];
  assert.equal(card?.phaseRow, 2);
  assert.equal(card?.icon, true);
  assert.equal(card?.reason, undefined);
  window.openCard('b');
  assert.deepEqual(window.sidebar(), [{kind: 'reason', line: 'вопросы 2'}]);
  rmSync(dir, {recursive: true, force: true});
}

function proveTheSidebarAskIsTheLatestCommentThatDoesNotStartWithSddFocus118(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openSide(home, [
    cycle('1', 'implementing', {
      labels: ['sdd:cycle', 'sdd:implementing', 'sdd:wait-human'],
      comments: [
        {body: 'older note'},
        {body: 'please decide\nthe rest'},
        {body: 'sdd:focus\nPlan gap\n'},
      ],
    }),
  ]);
  window.openCard('1');
  const ask = window.sidebar().find(block => block.kind === 'ask');
  assert.deepEqual(ask, {kind: 'ask', body: 'please decide\nthe rest'});
  rmSync(dir, {recursive: true, force: true});
}

function proveRemovingSddWaitHumanRemovesTheSidebarAskWhileTheCommentsRemain119(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const labels = ['sdd:cycle', 'sdd:implementing', 'sdd:wait-human'];
  const comments = [{body: 'please decide'}, {body: 'sdd:focus\nPlan gap\n'}];
  const window = openSide(home, [cycle('1', 'implementing', {labels, comments})]);
  window.openCard('1');
  assert.equal(kinds(window.sidebar()).includes('ask'), true);
  labels.splice(labels.indexOf('sdd:wait-human'), 1);
  const blocks = window.sidebar();
  assert.equal(kinds(blocks).includes('ask'), false);
  assert.deepEqual(blocks, [focusBlock('sdd:focus', 'Plan gap\n')]);
  assert.equal(comments.length, 2);
  rmSync(dir, {recursive: true, force: true});
}

function proveNoSddFocusCommentLeavesNoSidebarFocusBlock120(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openSide(home, [cycle('1', 'implementing', {comments: [{body: 'just a note'}]})]);
  window.openCard('1');
  assert.deepEqual(window.sidebar(), []);
  rmSync(dir, {recursive: true, force: true});
}

function proveAThreadWithNoMarkerIsInTheSidebarUnansweredBlock122(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  let asked = '';
  const window = openSide(home, [cycle('1', 'implementing')], {
    review: key => {
      asked = key;
      return {
        threads: [
          {marker: null, lines: ['please look', 'at the diff']},
          {marker: 'code', lines: ['already marked']},
        ],
        conversation: {last: {marker: 'note', body: 'answered already'}},
      };
    },
  });
  window.openCard('1');
  const blocks = window.sidebar();
  assert.equal(asked, '1');
  assert.deepEqual(blocks, [
    {kind: 'unanswered', threads: [{lines: ['please look', 'at the diff']}]},
  ]);
  const text = JSON.stringify(blocks);
  assert.equal(text.includes('already marked'), false);
  assert.equal(text.includes('answered already'), false);
  rmSync(dir, {recursive: true, force: true});
}

function proveEveryMarkedThreadAndAMarkedLastCommentLeaveNoSidebarUnansweredBlock123(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openSide(home, [cycle('1', 'implementing')], {
    review: () => ({
      threads: [
        {marker: 'code', lines: ['one']},
        {marker: 'fixed', lines: ['two']},
      ],
      conversation: {last: {marker: 'note', body: 'done'}},
    }),
  });
  window.openCard('1');
  assert.deepEqual(window.sidebar(), []);
  rmSync(dir, {recursive: true, force: true});
}

function proveSddHooksListsArchiveBeforeThenCreateProposalAfterInTheSidebar126(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const item = cycle('1', 'implementing');
  item.sddHooks = [
    {action: 'archive', point: 'before', value: 'keep the archive\nstill here'},
    {action: 'create-proposal', point: 'after', value: 'then propose'},
  ];
  const window = openSide(home, [item]);
  window.openCard('1');
  assert.deepEqual(window.sidebar(), [
    {
      kind: 'hook',
      points: [
        {action: 'archive', point: 'before', paragraph: 'keep the archive\nstill here'},
        {action: 'create-proposal', point: 'after', paragraph: 'then propose'},
      ],
    },
  ]);
  rmSync(dir, {recursive: true, force: true});
}

function proveANestedSddHooksMapKeepsFieldOrderInTheSidebar127(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const item = cycle('1', 'implementing');
  item.sddHooks = {
    archive: {before: 'keep the archive\nstill here'},
    'create-proposal': {after: 'then propose'},
  };
  const window = openSide(home, [item]);
  window.openCard('1');
  assert.deepEqual(window.sidebar(), [
    {
      kind: 'hook',
      points: [
        {action: 'archive', point: 'before', paragraph: 'keep the archive\nstill here'},
        {action: 'create-proposal', point: 'after', paragraph: 'then propose'},
      ],
    },
  ]);
  rmSync(dir, {recursive: true, force: true});
}

function proveASpacePointDropsFromTheSidebarAndTheOtherPointRemains(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const item = cycle('1', 'implementing');
  item.sddHooks = {archive: {before: '   ', after: 'keep'}};
  const window = openSide(home, [item]);
  window.openCard('1');
  assert.deepEqual(window.sidebar(), [
    {
      kind: 'hook',
      points: [{action: 'archive', point: 'after', paragraph: 'keep'}],
    },
  ]);
  rmSync(dir, {recursive: true, force: true});
}

function proveAMissingOrEmptySddHooksLeavesNoSidebarHookBlock128(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const missing = cycle('1', 'implementing', {
    comments: [{body: 'sdd:focus\nPlan gap\n'}],
  });
  const empty = cycle('2', 'implementing', {
    comments: [{body: 'sdd:focus\nPlan gap\n'}],
    sddHooks: '',
  });
  const blank = cycle('3', 'implementing', {
    comments: [{body: 'sdd:focus\nPlan gap\n'}],
    sddHooks: {},
  });
  const noPoints = cycle('4', 'implementing', {
    comments: [{body: 'sdd:focus\nPlan gap\n'}],
    sddHooks: {archive: {}},
  });
  const list = cycle('5', 'implementing', {
    comments: [{body: 'sdd:focus\nPlan gap\n'}],
    sddHooks: [],
  });
  const spaces = cycle('6', 'implementing', {
    comments: [{body: 'sdd:focus\nPlan gap\n'}],
    sddHooks: {archive: {before: '   '}},
  });
  const window = openSide(home, [missing, empty, blank, noPoints, list, spaces]);
  for (const key of ['1', '2', '3', '4', '5', '6']) {
    window.openCard(key);
    const blocks = window.sidebar();
    assert.deepEqual(blocks, [focusBlock('sdd:focus', 'Plan gap\n')]);
    assert.equal(kinds(blocks).includes('hook'), false);
  }
  rmSync(dir, {recursive: true, force: true});
}

function proveASingleStringSddHooksIsTheSidebarLine129(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const item = cycle('1', 'implementing', {sddHooks: 'not a map'});
  const window = openSide(home, [item]);
  window.openCard('1');
  const blocks = window.sidebar();
  assert.deepEqual(blocks, [{kind: 'hook', line: 'поле хука не читается'}]);
  assert.equal(JSON.stringify(blocks).includes('not a map'), false);
  assert.equal('points' in blocks[0], false);
  rmSync(dir, {recursive: true, force: true});
}

function proveACycleInThePoolShowsItsIssueDescriptionInTheSidebar(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const body = 'Choose this work item.\n';
  const window = openSide(home, [poolTicket('1', 'implementing', {body})]);
  assert.equal(
    window.board().pool.some(card => card.key === '1'),
    true,
  );
  window.openCard('1');
  const blocks = window.sidebar();
  assert.equal(blocks[0]?.kind, 'description');
  assert.deepEqual(blocks[0], {kind: 'description', text: body});
  rmSync(dir, {recursive: true, force: true});
}

async function proveThePersonReadsTheIssueDescriptionWhenChoosingATicketAlongWithTheTitle(): Promise<void> {
  await hosted(
    {
      tickets: () => [
        poolTicket('1', 'implementing', {
          title: 'Sidebar title',
          body: 'Issue description for the pool.',
        }),
      ],
    },
    async (page, window) => {
      window.chooseAgent('cursor');
      assert.equal(
        (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString())).status,
        200,
      );
      const html = await sidebarHtml(page.url);
      const side = bandOf(html, '1');
      assert.match(side, /Sidebar title/);
      assert.match(side, /Issue description for the pool\./);
      const titleAt = side.indexOf('Sidebar title');
      const descAt = side.indexOf('Issue description for the pool.');
      const reasonAt = side.indexOf('<h3>повод</h3>');
      assert.ok(titleAt >= 0 && descAt > titleAt);
      assert.ok(reasonAt === -1 || descAt < reasonAt);
    },
  );
}

function proveTheBlockGoesWhenTheCycleLeavesThePool(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const body = 'Still on the ticket after take.\n';
  const pool = poolTicket('pool-1', 'implementing', {body});
  const column = cycle('col-1', 'implementing', {body});
  const window = openSide(home, [pool, column]);
  assert.equal(
    window.board().pool.some(card => card.key === 'pool-1'),
    true,
  );
  assert.equal(columnCards(window.board(), 'implementing')?.some(card => card.key === 'col-1'), true);
  window.openCard('pool-1');
  assert.deepEqual(window.sidebar().find(block => block.kind === 'description'), {
    kind: 'description',
    text: body,
  });
  window.openCard('col-1');
  assert.equal(
    window.sidebar().some(block => block.kind === 'description'),
    false,
  );
  rmSync(dir, {recursive: true, force: true});
}

function proveAnEmptyDescriptionLeavesNoBlock(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const markerOnly = [
    '<!-- sdd:begin -->',
    'Tasks: 0/4',
    '<!-- sdd:end -->',
  ].join('\n');
  const window = openSide(home, [
    poolTicket('1', 'implementing', {body: ''}),
    poolTicket('2', 'implementing', {body: '  \n\t  '}),
    poolTicket('3', 'implementing', {body: markerOnly}),
  ]);
  for (const key of ['1', '2', '3']) {
    window.openCard(key);
    const blocks = window.sidebar();
    assert.equal(
      blocks.some(block => block.kind === 'description'),
      false,
      `pool cycle ${key} must not show a description block`,
    );
  }
  rmSync(dir, {recursive: true, force: true});
}

async function proveTheDescriptionIsTheIssueBodyOutsideTheMarkers(): Promise<void> {
  await hosted(
    {
      tickets: () => [
        poolTicket('1', 'implementing', {
          body: [
            'Author line one',
            '<!-- sdd:begin -->',
            'Mirror line hidden',
            '<!-- sdd:end -->',
            'Author line two',
          ].join('\n'),
        }),
      ],
    },
    async (page, window) => {
      window.chooseAgent('cursor');
      assert.equal(
        (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString())).status,
        200,
      );
      const blocks = window.sidebar();
      const description = blocks.find(block => block.kind === 'description');
      assert.deepEqual(description, {
        kind: 'description',
        text: 'Author line one\n\nAuthor line two',
      });
      const html = await sidebarHtml(page.url);
      const side = bandOf(html, '1');
      assert.match(side, /Author line one/);
      assert.match(side, /Author line two/);
      assert.equal(side.includes('Mirror line hidden'), false);
    },
  );
}

function proveTheWindowDoesNotRewriteTheProse(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const body = 'Specify thread 4\nwhy this gap stays verbatim\n';
  const window = openSide(home, [
    cycle('1', 'implementing', {
      comments: [{body: `sdd:focus\n${body}`}],
    }),
  ]);
  window.openCard('1');
  const focus = window.sidebar().find(block => block.kind === 'focus');
  assert.equal(focus?.body, body);
  assert.equal(focus?.display, body);
  rmSync(dir, {recursive: true, force: true});
}

function proveTheSidebarFocusBlockShowsTheLatestMarkerAsABadgeAndTheProseUnderIt(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openSide(home, [
    cycle('1', 'implementing', {
      comments: [
        {body: 'sdd:focus:plan\nOlder plan note.\n'},
        {body: 'sdd:focus:spec\nSpecify boundaries hold.\n'},
      ],
    }),
  ]);
  window.openCard('1');
  const focus = window.sidebar().find(block => block.kind === 'focus');
  assert.deepEqual(focus, focusBlock('sdd:focus:spec', 'Specify boundaries hold.\n'));
  rmSync(dir, {recursive: true, force: true});
}

function proveTheSpineRowOfThatPhaseKeepsTheFirstSentenceOfItsOwnLatestPhaseComment(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openSide(home, [
    cycle('1', 'implementing', {
      body: ['<!-- sdd:begin -->', 'Plan: Mirror fallback.', '<!-- sdd:end -->'].join('\n'),
      comments: [{body: 'sdd:focus:plan\nPlan produced the outcome. More detail here.\n'}],
    }),
  ]);
  window.openCard('1');
  const plan = window.spine()?.lines.find(line => line.layer === 'Plan');
  assert.equal(plan?.text, 'Plan produced the outcome.');
  rmSync(dir, {recursive: true, force: true});
}

function proveAWholePullRequestCommentBelongsToTheFocusBlockAndToNoSingleRow(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openSide(home, [
    cycle('1', 'implementing', {
      body: ['<!-- sdd:begin -->', 'Plan: Mirror only.', '<!-- sdd:end -->'].join('\n'),
      comments: [{body: 'sdd:focus\nWhole pull request summary.\n'}],
    }),
  ]);
  window.openCard('1');
  const focus = window.sidebar().find(block => block.kind === 'focus');
  assert.deepEqual(focus, focusBlock('sdd:focus', 'Whole pull request summary.\n'));
  const plan = window.spine()?.lines.find(line => line.layer === 'Plan');
  assert.equal(plan?.text, 'Mirror only.');
  rmSync(dir, {recursive: true, force: true});
}

function proveAManagerCommentIsNotTheFocusBlock(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openSide(home, [
    cycle('1', 'implementing', {
      comments: [
        {body: 'sdd:focus:code\nCode slice landed.\n'},
        {body: 'sdd:focus\nManager ledger\n', manager: true},
      ],
    }),
  ]);
  window.openCard('1');
  const focus = window.sidebar().find(block => block.kind === 'focus');
  assert.deepEqual(focus, focusBlock('sdd:focus:code', 'Code slice landed.\n'));
  rmSync(dir, {recursive: true, force: true});
}

function proveTheFocusBlockPagesTheWrittenFocusComments(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openSide(home, [
    cycle('1', 'implementing', {
      comments: [
        {body: 'sdd:focus:plan\nOlder plan note.\n'},
        {body: 'sdd:focus:spec\nSpecify boundaries hold.\n'},
        {body: 'sdd:focus:code\nCode slice landed.\n'},
      ],
    }),
  ]);
  window.openCard('1');
  const pages = window.sidebar().filter(block => block.kind === 'focus');
  assert.deepEqual(pages, [
    focusBlock('sdd:focus:code', 'Code slice landed.\n'),
    focusBlock('sdd:focus:spec', 'Specify boundaries hold.\n'),
    focusBlock('sdd:focus:plan', 'Older plan note.\n'),
  ]);
  rmSync(dir, {recursive: true, force: true});
}

function proveTheBadgeIsTheCommentsMarker(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openSide(home, [
    cycle('1', 'implementing', {
      comments: [{body: 'sdd:focus:design\nDesign boundaries named.\n'}],
    }),
  ]);
  window.openCard('1');
  const focus = window.sidebar().find(block => block.kind === 'focus');
  assert.equal(focus?.kind === 'focus' && focus.marker, 'sdd:focus:design');
  rmSync(dir, {recursive: true, force: true});
}

function proveSddFocusAcceptIsOneOfThesePages(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openSide(home, [
    cycle('1', 'implementing', {
      comments: [
        {body: 'sdd:focus:code\nEarlier code note.\n'},
        {body: 'sdd:focus:accept\nAccept gate is ready.\n'},
      ],
    }),
  ]);
  window.openCard('1');
  const pages = window.sidebar().filter(block => block.kind === 'focus');
  assert.deepEqual(pages[0], focusBlock('sdd:focus:accept', 'Accept gate is ready.\n'));
  assert.equal(pages.some(page => page.kind === 'focus' && page.marker === 'sdd:focus:accept'), true);
  rmSync(dir, {recursive: true, force: true});
}

function proveAWholePullRequestCommentLeavesPhaseLinesOutOfTheProse(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openSide(home, [
    cycle('1', 'implementing', {
      comments: [{body: 'sdd:focus\nPlan\nProse without a phase word.\n'}],
    }),
  ]);
  window.openCard('1');
  const focus = window.sidebar().find(block => block.kind === 'focus');
  assert.deepEqual(focus, focusBlock('sdd:focus', 'Plan\nProse without a phase word.\n'));
  assert.equal(
    focus?.kind === 'focus' && focus.display,
    'Plan\nProse without a phase word.\n',
  );
  rmSync(dir, {recursive: true, force: true});
}

function proveAPhaseCommentKeepsTheProseAfterTheMarker(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openSide(home, [
    cycle('1', 'implementing', {
      comments: [{body: 'sdd:focus:plan\nFirst sentence here.\nSecond sentence stays.\n'}],
    }),
  ]);
  window.openCard('1');
  const focus = window.sidebar().find(block => block.kind === 'focus');
  assert.deepEqual(focus, {
    ...focusBlock('sdd:focus:plan', 'First sentence here.\nSecond sentence stays.\n'),
    display: 'First sentence here.\nSecond sentence stays.\n',
  });
  rmSync(dir, {recursive: true, force: true});
}

function proveAnAcceptCommentKeepsTheProseAfterTheMarker(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openSide(home, [
    cycle('1', 'implementing', {
      comments: [{body: 'sdd:focus:accept\nFirst accept sentence.\nSecond accept sentence.\n'}],
    }),
  ]);
  window.openCard('1');
  const focus = window.sidebar().find(block => block.kind === 'focus');
  assert.deepEqual(focus, {
    ...focusBlock('sdd:focus:accept', 'First accept sentence.\nSecond accept sentence.\n'),
    display: 'First accept sentence.\nSecond accept sentence.\n',
  });
  rmSync(dir, {recursive: true, force: true});
}

function proveAnotherTicketShowsItsOwnLatestFocus(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openSide(home, [
    cycle('1', 'implementing', {
      comments: [{body: 'sdd:focus:plan\nPlan for ticket one.\n'}],
    }),
    cycle('2', 'implementing', {
      comments: [{body: 'sdd:focus:code\nCode for ticket two.\n'}],
    }),
  ]);
  window.openCard('2');
  const focus = window.sidebar().find(block => block.kind === 'focus');
  assert.deepEqual(focus, focusBlock('sdd:focus:code', 'Code for ticket two.\n'));
  rmSync(dir, {recursive: true, force: true});
}

function proveOneNonStringSddHooksPointShowsThatLineInTheSidebarAndTheStringPointRemains130(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const mapped = cycle('1', 'implementing', {
    sddHooks: {
      archive: {before: 4},
      'create-proposal': {after: 'keep this'},
    },
  });
  const listed = cycle('2', 'implementing', {
    sddHooks: [
      {action: 'archive', point: 'before', value: 4},
      {action: 'create-proposal', point: 'after', value: 'keep this'},
    ],
  });
  const window = openSide(home, [mapped, listed]);
  const expected = {
    kind: 'hook',
    points: [
      {action: 'archive', point: 'before', paragraph: 'поле хука не читается'},
      {action: 'create-proposal', point: 'after', paragraph: 'keep this'},
    ],
  };
  window.openCard('1');
  assert.deepEqual(window.sidebar(), [expected]);
  window.openCard('2');
  assert.deepEqual(window.sidebar(), [expected]);
  rmSync(dir, {recursive: true, force: true});
}

spec('sidebar', () => {
  requirement('The open row shows only the blocks that exist', () => {
    scenario('A cycle with only focus shows focus', () => {
      proveAnOpenCycleWhoseOnlySidebarBlockIsFocusShowsThatBlock113();
    });
  });
  requirement("The icon reason block is the card's line", () => {
    scenario('The open row shows the hidden tail', () => {
      proveAQuestionOnlyCardHidesTheLineAndTheSidebarStillShowsIt116();
    });
    scenario('No icon means no reason block', () => {
      proveASpecifyingCycleWithNoOccasionHasNoReasonBlock();
    });
  });
  requirement('Ask shows the latest comment that is not focus', () => {
    scenario('Wait shows the ask', () => {
      proveACardWithNoIconHasNoSidebarReasonBlock115();
    });
    scenario('A focus comment is skipped', () => {
      proveTheSidebarAskIsTheLatestCommentThatDoesNotStartWithSddFocus118();
    });
    scenario('Clearing the label removes the ask', () => {
      proveRemovingSddWaitHumanRemovesTheSidebarAskWhileTheCommentsRemain119();
    });
  });
  requirement('Focus shows the body after the marker line', () => {
    scenario('The plaque drops the marker line', () => {
      proveTheSidebarFocusPlaqueDoesNotIncludeTheMarkerLine121();
    });
    scenario('No focus comment leaves no block', () => {
      proveNoSddFocusCommentLeavesNoSidebarFocusBlock120();
    });
  });
  requirement('The sidebar focus block shows the latest focus prose', () => {
    scenario('The window does not rewrite the prose', () => {
      proveTheWindowDoesNotRewriteTheProse();
    });
    scenario('The sidebar focus block shows the latest marker as a badge and the prose under it', () => {
      proveTheSidebarFocusBlockShowsTheLatestMarkerAsABadgeAndTheProseUnderIt();
    });
    scenario('The spine row of that phase keeps the first sentence of its own latest phase comment', () => {
      proveTheSpineRowOfThatPhaseKeepsTheFirstSentenceOfItsOwnLatestPhaseComment();
    });
    scenario('A whole-pull-request comment belongs to the focus block and to no single row', () => {
      proveAWholePullRequestCommentBelongsToTheFocusBlockAndToNoSingleRow();
    });
    scenario('A manager comment is not the focus block', () => {
      proveAManagerCommentIsNotTheFocusBlock();
    });
  });
  requirement('Unanswered review shows threads the port already gives', () => {
    scenario('An unmarked thread is shown', () => {
      proveAThreadWithNoMarkerIsInTheSidebarUnansweredBlock122();
    });
    scenario('A marked thread is omitted', () => {
      proveEveryMarkedThreadAndAMarkedLastCommentLeaveNoSidebarUnansweredBlock123();
    });
  });
  requirement('The hook block shows sddHooks in field order', () => {
    scenario('Points stay in field order', () => {
      proveSddHooksListsArchiveBeforeThenCreateProposalAfterInTheSidebar126();
      proveANestedSddHooksMapKeepsFieldOrderInTheSidebar127();
      proveASpacePointDropsFromTheSidebarAndTheOtherPointRemains();
    });
    scenario('An empty field leaves no block', () => {
      proveAMissingOrEmptySddHooksLeavesNoSidebarHookBlock128();
    });
    scenario('A non-map is one error line', () => {
      proveASingleStringSddHooksIsTheSidebarLine129();
    });
    scenario('A non-string point keeps the others', () => {
      proveOneNonStringSddHooksPointShowsThatLineInTheSidebarAndTheStringPointRemains130();
    });
  });
});

spec('focus', () => {
  requirement('The sidebar focus block shows the latest focus prose', () => {
    scenario('The window does not rewrite the prose', () => {
      proveTheWindowDoesNotRewriteTheProse();
    });
  });
});

spec('written-focus-page', () => {
  requirement('The focus block shows the latest written focus', () => {
    scenario('The focus block pages the written focus comments', () => {
      proveTheFocusBlockPagesTheWrittenFocusComments();
    });
    scenario("The badge is the comment's marker", () => {
      proveTheBadgeIsTheCommentsMarker();
    });
    scenario('sdd:focus:accept is one of these pages', () => {
      proveSddFocusAcceptIsOneOfThesePages();
    });
    scenario('A manager comment is not the block', () => {
      proveAManagerCommentIsNotTheFocusBlock();
    });
    scenario('A whole-pull-request comment keeps a following Plan line in the prose', () => {
      proveAWholePullRequestCommentLeavesPhaseLinesOutOfTheProse();
    });
    scenario('A phase comment keeps the prose after the marker', () => {
      proveAPhaseCommentKeepsTheProseAfterTheMarker();
    });
    scenario('An accept comment keeps the prose after the marker', () => {
      proveAnAcceptCommentKeepsTheProseAfterTheMarker();
    });
    scenario('No focus comment leaves no block', () => {
      proveNoSddFocusCommentLeavesNoSidebarFocusBlock120();
    });
    scenario('Another ticket shows its own latest focus', () => {
      proveAnotherTicketShowsItsOwnLatestFocus();
    });
    scenario('Back walks the older written comments, newest first, each in full', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [
            held('1', 'implementing', {
              comments: [
                {body: 'sdd:focus:plan\nOlder plan note.\nSecond plan line.\n'},
                {body: 'sdd:focus:spec\nSpecify boundaries hold.\n'},
                {body: 'sdd:focus:code\nCode slice landed.\n'},
              ],
            }),
          ],
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const snapshot = (await (
            await fetch(new URL('/snapshot', page.url))
          ).json()) as import('./snapshot.ts').WindowSnapshot;
          const now = focusPagerHtml(snapshot, 0);
          assert.match(now, />sdd:focus:code</);
          assert.match(now, /Code slice landed\./);
          assert.equal(now.includes('Older plan note'), false);
          const older = focusPagerHtml(snapshot, 1);
          assert.match(older, />sdd:focus:spec</);
          assert.match(older, /Specify boundaries hold\./);
          const oldest = focusPagerHtml(snapshot, 2);
          assert.match(oldest, />sdd:focus:plan</);
          assert.match(oldest, /Older plan note\./);
          assert.match(oldest, /Second plan line\./);
          assert.match(oldest, /data-focus="back" disabled/);
        },
      );
    });
    scenario('Forward returns toward now', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [
            held('1', 'implementing', {
              comments: [
                {body: 'sdd:focus:plan\nOlder plan note.\n'},
                {body: 'sdd:focus:code\nCode slice landed.\n'},
              ],
            }),
          ],
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const snapshot = (await (
            await fetch(new URL('/snapshot', page.url))
          ).json()) as import('./snapshot.ts').WindowSnapshot;
          const onOlder = focusPagerHtml(snapshot, 1);
          assert.match(onOlder, />sdd:focus:plan</);
          assert.match(onOlder, /data-focus="forward"/);
          const towardNow = focusPagerHtml(snapshot, 0);
          assert.match(towardNow, />sdd:focus:code</);
          assert.match(towardNow, /data-focus="forward" disabled/);
        },
      );
    });
    scenario('Switching tickets lands on now for that ticket', () => {
      assert.equal(
        focusIndexAfterSnapshot({
          prevKey: '1',
          nextKey: '2',
          prevLatestBody: 'a',
          nextLatestBody: 'b',
          index: 2,
          pageCount: 3,
        }),
        0,
      );
      assert.equal(clampFocusPageIndex(4, 3), 2);
    });
    scenario(
      'While an older page is open and a new focus comment appears, the block returns to now',
      () => {
        assert.equal(
          focusIndexAfterSnapshot({
            prevKey: '1',
            nextKey: '1',
            prevLatestBody: 'Old code note.\n',
            nextLatestBody: 'Fresh code note.\n',
            index: 2,
            pageCount: 3,
          }),
          0,
        );
      },
    );
  });
});

spec('focus-pager', () => {
  requirement('The focus pager is one control on the focus row, opposite the badge', () => {
    scenario(
      'One control on the focus row, opposite the badge, shows a back chevron, the current page and the count, and a forward chevron, in the form `< 11/12 >`',
      () => {
        const blocks = manyWrittenFocusPages(12);
        const html = renderToStaticMarkup(
          createElement(FocusBlocks, {blocks, pageIndex: 1}),
        );
        assert.match(html, /class="focus-row"/);
        assert.match(html, /class="focus-pager"/);
        assert.match(html, /data-focus="back"/);
        assert.match(html, /data-focus="forward"/);
        assert.match(html, />11\/12</);
        assert.equal(html.includes('назад'), false);
        assert.equal(html.includes('вперёд'), false);
        const badgeAt = html.indexOf('class="badge"');
        const pagerAt = html.indexOf('class="focus-pager"');
        assert.ok(badgeAt >= 0 && pagerAt > badgeAt);
      },
    );
    scenario('The count runs from the oldest page, so the latest page reads `12/12`', () => {
      const blocks = manyWrittenFocusPages(12);
      const latest = renderToStaticMarkup(
        createElement(FocusBlocks, {blocks, pageIndex: 0}),
      );
      assert.match(latest, />12\/12</);
      const oldest = renderToStaticMarkup(
        createElement(FocusBlocks, {blocks, pageIndex: 11}),
      );
      assert.match(oldest, />1\/12</);
    });
    scenario(
      'A chevron that cannot move stays in place and goes quiet, so the number does not jump',
      () => {
        const blocks = manyWrittenFocusPages(3);
        const latest = renderToStaticMarkup(
          createElement(FocusBlocks, {blocks, pageIndex: 0}),
        );
        assert.match(latest, /data-focus="forward" disabled/);
        assert.match(latest, />3\/3</);
        const oldest = renderToStaticMarkup(
          createElement(FocusBlocks, {blocks, pageIndex: 2}),
        );
        assert.match(oldest, /data-focus="back" disabled/);
        assert.match(oldest, />1\/3</);
        assert.match(oldest, /data-focus="forward"/);
      },
    );
    scenario('A single written focus leaves the control out', () => {
      const html = renderToStaticMarkup(
        createElement(FocusBlocks, {
          blocks: [focusBlock('sdd:focus:plan', 'One page.\n')],
          pageIndex: 0,
        }),
      );
      assert.equal(html.includes('focus-pager'), false);
    });
    scenario('The row is the badge and the prose', () => {
      const html = renderToStaticMarkup(
        createElement(FocusBlocks, {
          blocks: [focusBlock('sdd:focus:plan', 'One page.\n')],
          pageIndex: 0,
        }),
      );
      assert.equal(html.includes('focus-row'), false);
      assert.match(html, /class="badge"/);
      assert.match(html, /<pre>/);
    });
    scenario('Back still walks older written comments, newest first', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [
            held('1', 'implementing', {
              comments: [
                {body: 'sdd:focus:plan\nOlder plan note.\n'},
                {body: 'sdd:focus:spec\nSpecify boundaries hold.\n'},
                {body: 'sdd:focus:code\nCode slice landed.\n'},
              ],
            }),
          ],
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const snapshot = (await (
            await fetch(new URL('/snapshot', page.url))
          ).json()) as WindowSnapshot;
          const now = focusPagerHtml(snapshot, 0);
          assert.match(now, />3\/3</);
          assert.match(now, />sdd:focus:code</);
          const older = focusPagerHtml(snapshot, 1);
          assert.match(older, />2\/3</);
          assert.match(older, />sdd:focus:spec</);
          const oldest = focusPagerHtml(snapshot, 2);
          assert.match(oldest, />1\/3</);
          assert.match(oldest, />sdd:focus:plan</);
          assert.match(oldest, /data-focus="back" disabled/);
        },
      );
    });
    scenario('Forward still returns toward now', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [
            held('1', 'implementing', {
              comments: [
                {body: 'sdd:focus:plan\nOlder plan note.\n'},
                {body: 'sdd:focus:code\nCode slice landed.\n'},
              ],
            }),
          ],
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const snapshot = (await (
            await fetch(new URL('/snapshot', page.url))
          ).json()) as WindowSnapshot;
          const onOlder = focusPagerHtml(snapshot, 1);
          assert.match(onOlder, />1\/2</);
          assert.match(onOlder, /data-focus="forward"/);
          assert.equal(onOlder.includes('data-focus="forward" disabled'), false);
          const towardNow = focusPagerHtml(snapshot, 0);
          assert.match(towardNow, />2\/2</);
          assert.match(towardNow, />sdd:focus:code</);
          assert.match(towardNow, /data-focus="forward" disabled/);
        },
      );
    });
    scenario('The badge and the prose stay as they are', () => {
      const blocks = [
        focusBlock('sdd:focus:spec', 'Prose stays verbatim.\n'),
        focusBlock('sdd:focus:plan', 'Older plan.\n'),
      ];
      const html = renderToStaticMarkup(createElement(FocusBlocks, {blocks, pageIndex: 0}));
      assert.match(html, />sdd:focus:spec</);
      assert.match(html, /Prose stays verbatim\./);
    });
  });
});

spec('live-focus-page', () => {
  const written = focusBlock('sdd:focus:code', 'Latest written page.\n');
  const comments = [{body: 'sdd:focus:code\nLatest written page.\n'}];

  requirement('The open page is a live page in four cases', () => {
    scenario("The pager's open page is a live page in four cases", () => {
      for (const turn of [
        {running: true, turn: {phase: 'specifying', action: 'create-initial-specs'}},
        {running: false, turn: {action: 'create-design'}},
        {
          decision: {
            kind: 'wait',
            issue: '1',
            reason: 'wait for children to reach specified: #12',
          } as Decision,
        },
        {checks: 'pending' as const},
      ]) {
        const item = cycle('1', 'implementing', {comments, ...('checks' in turn ? {checks: turn.checks} : {})});
        const blocks = sidebarBlocks(item, turn);
        const html = openLivePage(blocks);
        assert.match(html, /class="badge"/);
        assert.equal(blocks.some(block => block.kind === 'live'), true);
      }
    });
    scenario('The window computes it from the current decision and from whether a worker is on this issue', () => {
      const item = cycle('1', 'implementing', {comments});
      const blocks = sidebarBlocks(item, {
        running: true,
        turn: {phase: 'specifying', action: 'create-initial-specs'},
      });
      assert.equal(blocks[0]?.kind, 'live');
      assert.equal(blocks.some(block => block.kind === 'focus'), true);
    });
    scenario('It is not an issue comment, it is not a history slot, and it disappears when the reason passes', () => {
      const item = cycle('1', 'implementing', {comments});
      const live = sidebarBlocks(item, {running: true, turn: {phase: 'specifying', action: 'create-initial-specs'}});
      assert.deepEqual(live[0], {
        kind: 'live',
        badge: 'working',
        text: 'specifying → create-initial-specs',
      });
      const gone = sidebarBlocks(item, {});
      assert.equal(gone.some(block => block.kind === 'live'), false);
      assert.deepEqual(gone[0], written);
    });
    scenario('Past live reasons are not pages', () => {
      const item = cycle('1', 'implementing', {comments});
      const blocks = sidebarBlocks(item, {running: false, turn: {action: 'create-design'}});
      const html = openLivePage(blocks, 1);
      assert.match(html, />sdd:focus:code</);
      assert.equal(html.includes('create-design'), false);
      assert.match(html, /data-focus="back" disabled/);
    });
  });

  requirement('The live text is the case that holds', () => {
    scenario('A worker on this issue shows the phase and the action', () => {
      const live = liveFocus({
        running: true,
        turn: {phase: 'specifying', action: 'create-initial-specs'},
      });
      assert.match(live?.text, /specifying/);
      assert.match(live?.text, /create-initial-specs/);
    });
    scenario('A full cap shows the next action', () => {
      const live = liveFocus({running: false, turn: {action: 'create-design'}});
      assert.equal(live?.text, 'create-design');
    });
    scenario('A wait on another issue names who and until which phase', () => {
      const live = liveFocus({
        decision: {
          kind: 'wait',
          issue: '1',
          reason: 'wait for children to reach specified: #12',
        },
      });
      assert.match(live?.text, /12/);
      assert.match(live?.text, /specified/);
    });
    scenario('An implementing child is named until accepted', () => {
      const live = liveFocus({
        decision: {
          kind: 'wait',
          issue: '1',
          reason: 'wait for children to be accepted: #12',
        },
      });
      assert.match(live?.text, /12/);
      assert.match(live?.text, /accepted/);
    });
    scenario('A child and a blocker are named the way the decision names them', () => {
      const live = liveFocus({
        decision: {
          kind: 'wait',
          issue: '1',
          reason: 'wait for blockers: #12, #7',
        },
      });
      assert.match(live?.text, /12/);
      assert.match(live?.text, /7/);
    });
    scenario('One number is named once', () => {
      const live = liveFocus({
        decision: {
          kind: 'wait',
          issue: '1',
          reason: 'wait for blockers: #12, wait for children to be accepted: #12',
        },
      });
      assert.equal(live?.text.match(/12/g)?.length, 1);
      assert.match(live?.text, /accepted/);
    });
    scenario('Checks still running', () => {
      const live = liveFocus({checks: 'pending'});
      assert.equal(live?.text, 'checks are still running');
    });
    scenario('Checks are red and the failure has not been handed to a worker yet', () => {
      const live = liveFocus({checks: 'red'});
      assert.equal(live?.text, 'checks are red and the failure has not been handed to a worker yet');
    });
  });

  requirement('The live page is the open page only in that order', () => {
    scenario('A worker on this issue wins', () => {
      const live = liveFocus({
        running: true,
        turn: {phase: 'specifying', action: 'create-initial-specs'},
        decision: {
          kind: 'wait',
          issue: '1',
          reason: 'wait for children to reach specified: #12',
        },
        checks: 'pending',
      });
      assert.match(live?.text, /specifying/);
      assert.match(live?.text, /create-initial-specs/);
      const item = cycle('1', 'implementing', {comments, checks: 'pending'});
      const html = openLivePage(
        sidebarBlocks(item, {
          running: true,
          turn: {phase: 'specifying', action: 'create-initial-specs'},
          decision: {
            kind: 'wait',
            issue: '1',
            reason: 'wait for children to reach specified: #12',
          },
        }),
      );
      assert.match(html, /working/);
      assert.match(html, /create-initial-specs/);
    });
    scenario('A ready action that the cap held back is the open page', () => {
      const live = liveFocus({
        running: false,
        turn: {action: 'create-design'},
        decision: {
          kind: 'wait',
          issue: '1',
          reason: 'wait for children to reach specified: #12',
        },
        checks: 'pending',
      });
      assert.equal(live?.text, 'create-design');
      const html = openLivePage(
        sidebarBlocks(cycle('1', 'implementing', {comments, checks: 'pending'}), {
          running: false,
          turn: {action: 'create-design'},
          decision: {
            kind: 'wait',
            issue: '1',
            reason: 'wait for children to reach specified: #12',
          },
        }),
      );
      assert.match(html, /waiting for a slot/);
      assert.match(html, /create-design/);
    });
    scenario('A wait on another issue is the open page', () => {
      const live = liveFocus({
        decision: {
          kind: 'wait',
          issue: '1',
          reason: 'wait for children to reach specified: #12',
        },
      });
      assert.match(live?.text, /12/);
      assert.match(live?.text, /specified/);
    });
    scenario('Checks are the open page', () => {
      const live = liveFocus({checks: 'pending'});
      assert.equal(live?.text, 'checks are still running');
      const html = openLivePage(
        sidebarBlocks(cycle('1', 'implementing', {comments, checks: 'pending'}), {}),
      );
      assert.match(html, />checks</);
      assert.match(html, /checks are still running/);
    });
    scenario('The latest written page stays open', () => {
      const blocks = sidebarBlocks(cycle('1', 'implementing', {comments}), {});
      assert.equal(blocks[0]?.kind, 'focus');
      const html = openLivePage(blocks);
      assert.match(html, />sdd:focus:code</);
      assert.match(html, /Latest written page\./);
    });
  });

  requirement('The live badge is not a phase marker', () => {
    scenario('The badge is working', () => {
      const html = openLivePage(
        sidebarBlocks(cycle('1', 'implementing', {comments}), {
          running: true,
          turn: {phase: 'specifying', action: 'create-initial-specs'},
        }),
      );
      assert.match(html, />working</);
      assert.equal(html.includes('sdd:focus'), false);
    });
    scenario('The badge is waiting for a slot', () => {
      const html = openLivePage(
        sidebarBlocks(cycle('1', 'implementing', {comments}), {
          running: false,
          turn: {action: 'create-design'},
        }),
      );
      assert.match(html, />waiting for a slot</);
      assert.equal(html.includes('sdd:focus:spec'), false);
    });
    scenario('The badge is waiting on an issue', () => {
      const html = openLivePage(
        sidebarBlocks(cycle('1', 'implementing', {comments}), {
          decision: {
            kind: 'wait',
            issue: '1',
            reason: 'wait for children to reach specified: #12',
          },
        }),
      );
      assert.match(html, />waiting on an issue</);
    });
    scenario('The badge is checks', () => {
      const html = openLivePage(
        sidebarBlocks(cycle('1', 'implementing', {comments, checks: 'pending'}), {}),
      );
      assert.match(html, />checks</);
      assert.equal(html.includes('sdd:focus:spec'), false);
    });
  });

  requirement('A review gate keeps the written focus and the ask', () => {
    scenario(
      'On the review gate for the proposal, the spec, the design, or accepting, the open page stays the written focus of that stop',
      () => {
        const cases = [
          {
            phase: 'proposing',
            marker: 'sdd:focus:plan',
            decision: reviewGateWait('proposing'),
          },
          {
            phase: 'specifying',
            marker: 'sdd:focus:spec',
            decision: reviewGateWait('specifying'),
          },
          {
            phase: 'designing',
            marker: 'sdd:focus:design',
            decision: reviewGateWait('designing'),
          },
          {
            phase: 'accepting',
            marker: 'sdd:focus:accept',
            decision: {kind: 'wait' as const, issue: '1', reason: 'wait for a person'},
          },
        ];
        for (const row of cases) {
          const item = cycle('1', row.phase, {
            comments: [{body: `${row.marker}\nWritten focus of ${row.phase}.\n`}],
          });
          const blocks = sidebarBlocks(item, {
            running: true,
            turn: {phase: 'implementing', action: 'implement-next-task'},
            decision: row.decision,
          });
          assertWrittenFocusIsOpen(blocks);
          const html = openLivePage(blocks);
          assert.match(html, new RegExp(`>${row.marker}<`));
          assert.match(html, new RegExp(`Written focus of ${row.phase}\\.`));
        }
      },
    );
    scenario('Accepting keeps the written focus while checks are still running', () => {
      const item = cycle('1', 'accepting', {
        comments: [{body: 'sdd:focus:accept\nAccepting written focus.\n'}],
        checks: 'pending',
      });
      const blocks = sidebarBlocks(item, {
        decision: {kind: 'wait', issue: '1', reason: 'checks before merge'},
      });
      assertWrittenFocusIsOpen(blocks);
      const html = openLivePage(blocks);
      assert.match(html, />sdd:focus:accept</);
      assert.equal(html.includes('checks are still running'), false);
    });
    scenario('The proposal gate keeps the written focus of that stop', () => {
      const item = cycle('1', 'proposing', {
        comments: [{body: 'sdd:focus:plan\nProposal written focus.\n'}],
      });
      const blocks = sidebarBlocks(item, {
        running: false,
        turn: {action: 'create-design'},
        decision: reviewGateWait('proposing'),
      });
      assertWrittenFocusIsOpen(blocks);
      assert.match(openLivePage(blocks), />sdd:focus:plan</);
      assert.equal(openLivePage(blocks).includes('create-design'), false);
    });
    scenario('The spec gate keeps the written focus of that stop', () => {
      const item = cycle('1', 'specifying', {
        comments: [{body: 'sdd:focus:spec\nSpec written focus.\n'}],
      });
      const blocks = sidebarBlocks(item, {
        decision: reviewGateWait('specifying'),
      });
      assertWrittenFocusIsOpen(blocks);
      assert.match(openLivePage(blocks), />sdd:focus:spec</);
    });
    scenario('The design gate keeps the written focus of that stop', () => {
      const item = cycle('1', 'designing', {
        comments: [{body: 'sdd:focus:design\nDesign written focus.\n'}],
      });
      const blocks = sidebarBlocks(item, {
        running: true,
        turn: {phase: 'designing', action: 'create-design'},
        decision: reviewGateWait('designing'),
      });
      assertWrittenFocusIsOpen(blocks);
      assert.match(openLivePage(blocks), />sdd:focus:design</);
      assert.equal(openLivePage(blocks).includes('create-design'), false);
    });
    scenario('The ask block stays its own block and is not copied into the live page', () => {
      const item = cycle('1', 'implementing', {
        comments: [comments[0]!, {body: 'please decide'}],
        labels: ['sdd:cycle', 'sdd:implementing', 'sdd:wait-human'],
        checks: 'pending',
      });
      const blocks = sidebarBlocks(item, {
        running: true,
        turn: {phase: 'implementing', action: 'implement-next-task'},
      });
      assertWrittenFocusIsOpen(blocks);
      assert.deepEqual(blocks.find(block => block.kind === 'ask'), {
        kind: 'ask',
        body: 'please decide',
      });
      const html = openLivePage(blocks);
      assert.equal(html.includes('please decide'), false);
      assert.equal(html.includes('checks are still running'), false);
    });
    scenario('The live sentence does not replace an ask', () => {
      const item = cycle('1', 'implementing', {
        comments: [comments[0]!, {body: 'please decide'}],
        labels: ['sdd:cycle', 'sdd:implementing', 'sdd:wait-human'],
      });
      const blocks = sidebarBlocks(item, {
        running: true,
        turn: {phase: 'implementing', action: 'implement-next-task'},
      });
      assert.equal(blocks.some(block => block.kind === 'live'), false);
      assert.equal(blocks.some(block => block.kind === 'ask'), true);
      assert.equal(blocks.some(block => block.kind === 'focus'), true);
    });
  });

  requirement('No written page leaves the live page as the only page', () => {
    scenario('While no written page exists, the live page is the only page and Back does nothing', () => {
      const blocks = sidebarBlocks(cycle('1', 'implementing'), {
        running: true,
        turn: {phase: 'specifying', action: 'create-initial-specs'},
      });
      assert.equal(blocks.some(block => block.kind === 'focus'), false);
      assert.equal(blocks.filter(block => block.kind === 'live').length, 1);
      const html = openLivePage(blocks, 0);
      assert.match(html, />working</);
      assert.match(html, /create-initial-specs/);
      assert.equal(html.includes('focus-pager'), false);
      assert.equal(html.includes('data-focus="back"'), false);
    });
  });

  requirement('Opening the sidebar, a worker starting, and a new written comment return the block to now', () => {
    scenario('Opening the sidebar returns the block to now', () => {
      const blocks = sidebarBlocks(cycle('1', 'implementing', {comments}), {
        running: true,
        turn: {phase: 'implementing', action: 'implement-next-task'},
      });
      const index = focusIndexAfterSnapshot({
        prevKey: undefined,
        nextKey: '1',
        prevLatestBody: undefined,
        nextLatestBody: 'Latest written page.\n',
        prevHadLive: true,
        nextHadLive: true,
        index: 2,
        pageCount: 4,
        prevPageCount: 4,
      });
      assert.equal(index, 0);
      const html = openLivePage(blocks, index);
      assert.match(html, />working</);
      assert.match(html, /implement-next-task/);
      assert.equal(html.includes('Older plan note'), false);
    });
    scenario('A worker starting returns the block to now', () => {
      const blocks = sidebarBlocks(cycle('1', 'implementing', {comments}), {
        running: true,
        turn: {phase: 'specifying', action: 'create-initial-specs'},
      });
      const index = focusIndexAfterSnapshot({
        prevKey: '1',
        nextKey: '1',
        prevLatestBody: 'Latest written page.\n',
        nextLatestBody: 'Latest written page.\n',
        prevLiveTurn: undefined,
        nextLiveTurn: 'specifying → create-initial-specs',
        prevHadLive: false,
        nextHadLive: true,
        prevPageCount: 3,
        index: 2,
        pageCount: 4,
      });
      assert.equal(index, 0);
      const html = openLivePage(blocks, index);
      assert.match(html, /specifying/);
      assert.match(html, /create-initial-specs/);
    });
    scenario('A new written comment returns the block to now', () => {
      const blocks = sidebarBlocks(
        cycle('1', 'implementing', {
          comments: [{body: 'sdd:focus:code\nFresh written page.\n'}],
        }),
        {
          running: true,
          turn: {phase: 'implementing', action: 'implement-next-task'},
        },
      );
      const index = focusIndexAfterSnapshot({
        prevKey: '1',
        nextKey: '1',
        prevLatestBody: 'Latest written page.\n',
        nextLatestBody: 'Fresh written page.\n',
        prevHadLive: true,
        nextHadLive: true,
        index: 2,
        pageCount: 4,
        prevPageCount: 4,
      });
      assert.equal(index, 0);
      const html = openLivePage(blocks, index);
      assert.match(html, />working</);
      assert.match(html, /implement-next-task/);
      const older = openLivePage(blocks, 1);
      assert.match(older, /Fresh written page\./);
    });
  });
});

spec('issue-description', () => {
  requirement('A pool cycle shows its issue description in the sidebar', () => {
    scenario('A cycle in the pool shows its issue description in the sidebar', () => {
      proveACycleInThePoolShowsItsIssueDescriptionInTheSidebar();
    });
    scenario('The person reads the issue description when choosing a ticket, along with the title', async () => {
      await proveThePersonReadsTheIssueDescriptionWhenChoosingATicketAlongWithTheTitle();
    });
    scenario(
      "The description is the issue body the tracker already returned, the author's text outside the markers",
      async () => {
        await proveTheDescriptionIsTheIssueBodyOutsideTheMarkers();
      },
    );
    scenario('An empty description leaves no block', () => {
      proveAnEmptyDescriptionLeavesNoBlock();
    });
    scenario('The block goes when the cycle leaves the pool', () => {
      proveTheBlockGoesWhenTheCycleLeavesThePool();
    });
  });
});
