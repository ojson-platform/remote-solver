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
import {focusBlockProse} from './focus.ts';
import {bandOf, held, hosted, MANAGER, post} from './page.harness.ts';
import type {WindowSnapshot} from './snapshot.ts';
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

function focusBlock(marker: string, body: string) {
  return {
    kind: 'focus' as const,
    marker,
    body,
    display: focusBlockProse(marker as import('../machine/marker.ts').FocusMarkerLine, body),
  };
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
          assert.equal(oldest.includes('data-focus="back"'), false);
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
          assert.equal(towardNow.includes('data-focus="forward"'), false);
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
