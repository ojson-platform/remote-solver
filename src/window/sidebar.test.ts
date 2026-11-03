import assert from 'node:assert/strict';
import {rmSync} from 'node:fs';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {renderWindow} from './client/render.ts';
import {bandOf, hosted, post} from './page.harness.ts';
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
  assert.deepEqual(blocks, [{kind: 'focus', body: 'Plan gap\n'}]);
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
    assert.deepEqual(blocks, [{kind: 'focus', body: 'Plan gap\n'}]);
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
  });
});
