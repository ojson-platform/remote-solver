import assert from 'node:assert/strict';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {stringify} from 'yaml';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {gesture} from './client/gesture.ts';
import {openLiveBoard} from './live.ts';
import {yard as liveYard} from './live.harness.ts';
import {serveBoard} from './page.ts';
import {
  articleOf,
  bandOf,
  bare,
  between,
  held,
  formsOf,
  glineOf,
  held,
  hosted,
  pageHtml,
  post,
  stationOf,
  writeChange as pageWrite,
  writeQueues,
} from './page.harness.ts';
import {
  COLUMN_NAMES,
  MANAGER,
  columnCards,
  cycle,
  openCycles,
  prepare,
  proveACatalogThatRejectsTheRecordedJudgmentIdKeepsItAndStopsTheStep95,
  proveTheServiceConfigGroupHasNoFieldsWhenTheFileDoesNotParseAndOnlyThatCheckoutLosesItsCards106,
  readHome,
  scratch,
  ticket,
  writeChange,
  writeLaunch,
  writeOverlay,
  writeServiceConfig,
  writeServiceYaml,
  yard,
} from './window.harness.ts';
import {openWindow} from './window.ts';

function proveALaunchWithNoHomePathShowsOneRowThatTheFactoryStillNeedsAnAgent0(): void {
  const window = openWindow({});
  const board = window.board();
  assert.equal(board.visible, true);
  assert.deepEqual(board.rows, [{text: 'фабрике ещё нужен агент'}]);
  assert.equal(board.settingsOpen, false);
  assert.equal(board.stepsStart, false);
  assert.equal(board.takeDisabled, true);
  window.take();
  window.spy();
  assert.equal(board.rows.length, 1);
}

function proveAMissingHomeFileShowsTheBoardAndDoesNotStartAStep1(): void {
  const {dir, home} = scratch();
  let started = 0;
  let assignees = 0;
  const window = openWindow(
    {homePath: home},
    {
      startStep: () => {
        started += 1;
      },
      writeAssignee: () => {
        assignees += 1;
      },
    },
  );
  const board = window.board();
  assert.equal(board.visible, true);
  assert.deepEqual(board.rows, [{text: 'фабрике ещё нужен агент'}]);
  assert.equal(board.settingsOpen, false);
  assert.equal(board.stepsStart, false);
  assert.equal(board.takeDisabled, true);
  window.spy();
  window.take();
  assert.equal(started, 0);
  assert.equal(assignees, 0);
  rmSync(dir, {recursive: true, force: true});
}

function proveASilentAgentHidesTheEmptyModelRow17(): void {
  const {dir, home} = scratch();
  const body = [
    'agent: cursor',
    'models:',
    '  mechanical: composer-2.5-fast',
    '  judgment: ""',
    '',
  ].join('\n');
  writeFileSync(home, body);
  const window = openWindow({homePath: home}, {answers: () => false});
  assert.deepEqual(window.board().rows, [{text: 'агент не отвечает'}]);
  assert.equal(readFileSync(home, 'utf8'), body);
  rmSync(dir, {recursive: true, force: true});
}

function proveAnEmptySpecifyingColumnStaysAndTheWindowWritesNoPhase46(): void {
  const window = openWindow({});
  const board = window.board();
  assert.deepEqual(board.pool, []);
  assert.deepEqual(
    board.columns?.map(column => column.name),
    COLUMN_NAMES,
  );
  assert.deepEqual(columnCards(board, 'specifying'), []);
  assert.equal(
    Object.keys(window).some(name => name.toLowerCase().includes('phase')),
    false,
  );
  assert.equal('panel' in board, false);

  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const opened = openCycles(home, [cycle('1', 'implementing')]);
  opened.openCard('1');
  assert.equal(
    Object.keys(opened).some(name => name.toLowerCase().includes('phase')),
    false,
  );
  assert.equal('panel' in opened.board(), false);
  rmSync(dir, {recursive: true, force: true});
}

function proveProposedStandsInProposingAndSpecifiedStandsInSpecifying47(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openCycles(home, [
    cycle('2', 'proposed', {title: 'Propose it'}),
    cycle('1', 'specified', {title: 'Specify it'}),
    cycle('3', 'designed', {title: 'Design it'}),
    ticket({key: '9', queue: 'alpha', sddService: 'services/billing', title: 'Bare'}),
  ]);
  const board = window.board();
  const proposing = columnCards(board, 'proposing');
  const specifying = columnCards(board, 'specifying');
  const designing = columnCards(board, 'designing');
  assert.deepEqual(
    proposing?.map(card => card.key),
    ['2'],
  );
  assert.equal(proposing?.[0]?.title, 'Propose it');
  assert.equal(proposing?.[0]?.icon, true);
  assert.equal(proposing?.[0]?.reason, 'proposed');
  assert.equal(proposing?.[0]?.layers, undefined);
  assert.deepEqual(
    specifying?.map(card => card.key),
    ['1'],
  );
  assert.equal(specifying?.[0]?.reason, 'specified');
  assert.deepEqual(
    designing?.map(card => card.key),
    ['3'],
  );
  assert.equal(designing?.[0]?.reason, 'designed');
  assert.equal(
    board.cards.some(card => card.key === '9'),
    false,
  );
  assert.deepEqual(
    board.pool.map(card => card.key),
    ['9'],
  );
  rmSync(dir, {recursive: true, force: true});
}

function proveAnotherAssigneeIsAbsentAndAPhaseWithNoAssigneeStandsInThePool48(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openCycles(home, [
    cycle('b', 'implementing', {assignee: 'other', title: 'Other'}),
    cycle('c', 'implementing', {assignee: '', title: 'Open seat'}),
    cycle('a', 'tasking', {assignee: undefined, title: 'Also open'}),
    ticket({
      key: '9',
      queue: 'alpha',
      sddService: 'services/billing',
      assignee: 'other',
      title: 'Bare',
    }),
  ]);
  const board = window.board();
  const keys = [
    ...board.cards.map(card => card.key),
    ...(board.pool ?? []).map(card => card.key),
    ...(board.columns ?? []).flatMap(column => column.cards.map(card => card.key)),
  ];
  assert.equal(keys.includes('b'), false);
  assert.equal(keys.includes('9'), false);
  assert.deepEqual(
    (board.pool ?? []).map(card => card.key),
    ['a', 'c'],
  );
  assert.equal(columnCards(board, 'implementing')?.length, 0);
  assert.equal(columnCards(board, 'tasking')?.length, 0);
  assert.deepEqual(
    board.cards.map(card => card.key),
    [],
  );
  rmSync(dir, {recursive: true, force: true});
}

function proveSddCancelledWithAnEarlierPhaseShowsNoCard49(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openCycles(home, [
    cycle('1', 'proposing', {labels: ['sdd:cycle', 'sdd:proposing', 'sdd:cancelled']}),
    cycle('2', 'proposing'),
  ]);
  const board = window.board();
  const keys = [
    ...board.cards.map(card => card.key),
    ...(board.pool ?? []).map(card => card.key),
    ...(board.columns ?? []).flatMap(column => column.cards.map(card => card.key)),
  ];
  assert.equal(keys.includes('1'), false);
  assert.deepEqual(
    columnCards(board, 'proposing')?.map(card => card.key),
    ['2'],
  );
  rmSync(dir, {recursive: true, force: true});
}

function proveAnOpenMergeStandsInAcceptingAndAClosedIssueLeaves50(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openCycles(home, [
    cycle('1', 'verifying', {open: true, mergeAhead: true, title: 'Still open'}),
    cycle('2', 'verifying', {open: false, mergeAhead: true, title: 'Closed'}),
    cycle('3', 'accepted', {open: true, title: 'Accepted'}),
    cycle('4', 'accepted', {open: false, title: 'Accepted closed'}),
  ]);
  const board = window.board();
  const accepting = columnCards(board, 'accepting');
  assert.deepEqual(
    accepting?.map(card => card.key),
    ['1', '3'],
  );
  assert.equal(accepting?.find(card => card.key === '1')?.reason?.includes('мерж'), true);
  assert.equal(columnCards(board, 'verifying')?.length, 0);
  const keys = [
    ...board.cards.map(card => card.key),
    ...(board.pool ?? []).map(card => card.key),
    ...(board.columns ?? []).flatMap(column => column.cards.map(card => card.key)),
  ];
  assert.equal(keys.includes('2'), false);
  assert.equal(keys.includes('4'), false);
  rmSync(dir, {recursive: true, force: true});
}

function proveProposingShowsTwoOpenQuestionsUnderTheHeading51(): void {
  const {dir, home, arcadia} = yard();
  const checkout = prepare(arcadia, home);
  writeChange(
    checkout,
    '1',
    'proposal.md',
    [
      '## Open questions',
      '',
      '- [ ] one',
      '- [x] done',
      '- [ ] two',
      '',
      '## Later',
      '',
      '- [ ] skip',
      '',
    ].join('\n'),
  );
  const window = openCycles(home, [cycle('1', 'proposed')]);
  const card = columnCards(window.board(), 'proposing')?.[0];
  assert.equal(card?.phaseRow, 2);
  rmSync(dir, {recursive: true, force: true});
}

function proveSpecifyingHasNoPhaseRow52(): void {
  const {dir, home, arcadia} = yard();
  const checkout = prepare(arcadia, home);
  writeChange(checkout, '1', 'proposal.md', '## Open questions\n\n- [ ] one\n');
  const window = openCycles(home, [cycle('1', 'specified')]);
  const card = columnCards(window.board(), 'specifying')?.[0];
  assert.ok(card);
  assert.equal(card.phaseRow, undefined);
  rmSync(dir, {recursive: true, force: true});
}

function proveImplementingCountsTasksMdAndOmitsTheCountWhenTheFileIsAbsent54(): void {
  const {dir, home, arcadia} = yard();
  const checkout = prepare(arcadia, home);
  writeChange(checkout, '1', 'tasks.md', '- [x] one\n- [x] two\n- [ ] three\n');
  const window = openCycles(home, [cycle('1', 'implementing'), cycle('2', 'implementing')]);
  const cards = columnCards(window.board(), 'implementing');
  assert.deepEqual(cards?.find(card => card.key === '1')?.phaseRow, {done: 2, open: 1});
  const missing = cards?.find(card => card.key === '2');
  assert.ok(missing);
  assert.equal(missing.phaseRow, undefined);
  assert.equal('done' in missing, false);
  rmSync(dir, {recursive: true, force: true});
}

function proveVerifyingShowsRedAndNoneLeavesTheCheckRowBlank55(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openCycles(home, [
    cycle('1', 'verifying', {checks: 'red', title: 'Red'}),
    cycle('2', 'verifying', {checks: 'none', title: 'None'}),
  ]);
  const cards = columnCards(window.board(), 'verifying');
  const red = cards?.find(card => card.key === '1');
  const none = cards?.find(card => card.key === '2');
  assert.equal(red?.phaseRow, 'red');
  assert.equal(JSON.stringify(red).includes('lint'), false);
  assert.equal(red && 'checks' in red, false);
  assert.equal(none?.phaseRow, undefined);
  rmSync(dir, {recursive: true, force: true});
}

function proveAFocusGapShowsSpecifyAndHidesASolidPlan56(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openCycles(home, [
    cycle('1', 'implementing', {
      comments: [
        {body: 'hello', manager: true},
        {body: 'sdd:focus\nPlan solid\nSpecify thread 4\nwhy this gap\n'},
        {body: 'sdd:focus\nPlan gap\n', manager: true},
        {body: 'a later note'},
      ],
    }),
    cycle('2', 'implementing', {
      comments: [{body: 'sdd:focus\nCode gap\nChange solid\nPlan gap\n'}],
    }),
  ]);
  const cards = columnCards(window.board(), 'implementing');
  const gap = cards?.find(card => card.key === '1');
  assert.equal(gap?.layers, 'Specify');
  assert.equal(gap?.layers?.includes('Plan'), false);
  assert.equal(JSON.stringify(gap).includes('thread'), false);
  assert.equal(JSON.stringify(gap).includes('why'), false);
  assert.equal(cards?.find(card => card.key === '2')?.layers, 'Code · Plan');
  rmSync(dir, {recursive: true, force: true});
}

function proveEveryRecordedLayerSolidHasNoLayerLine57(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openCycles(home, [
    cycle('1', 'implementing', {
      comments: [{body: 'sdd:focus\nChange solid\nPlan solid\nSpecify solid\n'}],
    }),
  ]);
  const card = columnCards(window.board(), 'implementing')?.[0];
  assert.ok(card);
  assert.equal(card.layers, undefined);
  rmSync(dir, {recursive: true, force: true});
}

function proveARunningStepHidesTheIconWhileTheOccasionStillSortsFirst58(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openCycles(
    home,
    [
      cycle('1', 'specifying'),
      cycle('3', 'specifying', {labels: ['sdd:cycle', 'sdd:specifying', 'sdd:wait-human']}),
      cycle('2', 'specifying', {labels: ['sdd:cycle', 'sdd:specifying', 'sdd:wait-human']}),
      cycle('4', 'specifying', {labels: ['sdd:cycle', 'sdd:specifying', 'sdd:wait-human']}),
    ],
    key => key === '2' || key === '3',
  );
  const cards = columnCards(window.board(), 'specifying');
  assert.deepEqual(
    cards?.map(card => card.key),
    ['2', '3', '4', '1'],
  );
  const hidden = cards?.find(card => card.key === '2');
  const shown = cards?.find(card => card.key === '4');
  assert.equal(hidden?.icon, undefined);
  assert.equal(hidden?.reason, 'Ask');
  assert.equal(shown?.icon, true);
  assert.equal(shown?.reason, 'Ask');
  rmSync(dir, {recursive: true, force: true});
}

function proveAMissingCatalogOutranksAMissingServiceConfigInTheReason60(): void {
  const {dir, home, arcadia} = yard();
  writeLaunch(home, ['alpha'], {arcadia});
  const window = openCycles(home, [cycle('1', 'proposed', {sddService: 'services/missing'})]);
  const card = columnCards(window.board(), 'proposing')?.[0];
  assert.equal(card?.reason?.startsWith('каталога нет'), true);
  assert.equal(card?.reason?.startsWith('конфига сервиса нет'), false);
  assert.equal(card?.reason?.includes('конфига сервиса нет'), false);
  rmSync(dir, {recursive: true, force: true});
}

function proveAQuestionOnlyOccasionWhosePhaseRowShowsTheCountHasNoReasonLine61(): void {
  const {dir, home, arcadia} = yard();
  const checkout = prepare(arcadia, home);
  writeChange(checkout, 'b', 'proposal.md', '## Open questions\n\n- [ ] one\n- [ ] two\n');
  writeChange(checkout, 'c', 'proposal.md', '## Open questions\n\n- [ ] one\n- [ ] two\n');
  const window = openCycles(home, [
    cycle('a', 'proposing'),
    cycle('b', 'proposing'),
    cycle('c', 'specifying'),
  ]);
  const board = window.board();
  const proposing = columnCards(board, 'proposing');
  assert.deepEqual(
    proposing?.map(card => card.key),
    ['b', 'a'],
  );
  const questions = proposing?.find(card => card.key === 'b');
  assert.equal(questions?.phaseRow, 2);
  assert.equal(questions?.icon, true);
  assert.equal(questions?.reason, undefined);
  const elsewhere = columnCards(board, 'specifying')?.find(card => card.key === 'c');
  assert.equal(elsewhere?.phaseRow, undefined);
  assert.equal(elsewhere?.reason, 'вопросы 2');
  rmSync(dir, {recursive: true, force: true});
}

function proveAChildRecordPutsAndThatKeyOnTheReason63(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openCycles(home, [
    cycle('p', 'implementing'),
    ticket({key: 'c-2', parent: 'p', queue: 'other', labels: ['sdd:cycle']}),
    ticket({key: 'c-1', parent: 'p', queue: 'other', labels: ['sdd:cycle']}),
    ticket({key: 'no', parent: 'p', queue: 'other', labels: ['other']}),
  ]);
  const card = columnCards(window.board(), 'implementing')?.[0];
  assert.equal(card?.reason, 'дети c-1 c-2');
  assert.equal(card?.reason?.includes('no'), false);
  rmSync(dir, {recursive: true, force: true});
}

function proveAnOpenWatchListTicketWithSddCycleNoPhaseAndNoAssigneeStandsInThePool67(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openCycles(home, [
    ticket({key: 'b', queue: 'alpha', sddService: 'services/billing', title: 'Second', open: true}),
    ticket({key: 'a', queue: 'alpha', sddService: 'services/billing', title: 'First'}),
    ticket({
      key: 'c',
      queue: 'alpha',
      sddService: 'services/billing',
      title: 'Closed',
      open: false,
    }),
    ticket({key: 'd', queue: 'beta', sddService: 'services/billing', title: 'Other queue'}),
  ]);
  const board = window.board();
  assert.deepEqual(
    board.pool.map(card => card.key),
    ['a', 'b'],
  );
  assert.equal(
    board.pool.some(card => card.key === 'c'),
    false,
  );
  assert.deepEqual(
    board.cards.map(card => card.key),
    ['c'],
  );
  assert.equal(
    board.cards.some(card => card.key === 'a' || card.key === 'b'),
    false,
  );
  rmSync(dir, {recursive: true, force: true});
}

function proveAnOpenTicketOnTheWatchListWithoutSddCycleIsNotInThePool68(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openCycles(home, [
    ticket({
      key: '1',
      queue: 'alpha',
      sddService: 'services/billing',
      title: 'Plain',
      open: true,
      labels: ['alpha'],
    }),
  ]);
  const board = window.board();
  assert.equal(
    board.pool.some(card => card.key === '1'),
    false,
  );
  assert.deepEqual(board.cards, []);
  rmSync(dir, {recursive: true, force: true});
}

function proveAPhaselessTicketAssignedToThisLoginMovesToProposingAfterSpyWhenModelsAreSet70(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const tickets = [
    ticket({
      key: '1',
      queue: 'alpha',
      sddService: 'services/billing',
      assignee: MANAGER,
      title: 'Mine',
      labels: ['sdd:cycle'],
    }),
  ];
  const phases: {key: string; phase: string}[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => tickets,
      writePhase: (key, phase) => {
        phases.push({key, phase});
        const found = tickets.find(item => item.key === key);
        if (found && !found.labels.includes(`sdd:${phase}`)) {
          found.labels = [...found.labels, `sdd:${phase}`];
        }
      },
    },
  );
  window.chooseAgent('cursor');
  assert.deepEqual(
    window.board().pool.map(card => card.key),
    ['1'],
  );
  window.spy();
  assert.deepEqual(phases, [{key: '1', phase: 'proposing'}]);
  const board = window.board();
  assert.deepEqual(board.pool, []);
  assert.deepEqual(
    columnCards(board, 'proposing')?.map(card => card.key),
    ['1'],
  );
  rmSync(dir, {recursive: true, force: true});
}

function proveAPhaselessTicketAssignedToThisLoginStaysInThePoolWhenAModelSlotIsEmpty71(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const tickets = [
    ticket({
      key: '1',
      queue: 'alpha',
      sddService: 'services/billing',
      assignee: MANAGER,
      title: 'Mine',
      labels: ['sdd:cycle'],
    }),
  ];
  const phases: {key: string; phase: string}[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      answers: () => true,
      tickets: () => tickets,
      writePhase: (key, phase) => {
        phases.push({key, phase});
      },
    },
  );
  window.chooseAgent('cursor');
  window.leaveModel('judgment', '');
  window.spy();
  const card = window.board().pool.find(item => item.key === '1');
  assert.ok(card);
  assert.equal(card.takeDisabled, true);
  assert.equal(card.take, true);
  assert.deepEqual(phases, []);
  assert.equal(columnCards(window.board(), 'proposing')?.length, 0);
  rmSync(dir, {recursive: true, force: true});
}

function proveTwoOpenPullRequestsKeepAnAssignedTicketInThePoolAndSpyDoesNotSetProposing72(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const tickets = [
    ticket({
      key: '1',
      queue: 'alpha',
      sddService: 'services/billing',
      assignee: MANAGER,
      title: 'Split',
      openPullRequests: 2,
      labels: ['sdd:cycle'],
    }),
  ];
  const phases: {key: string; phase: string}[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => tickets,
      writePhase: (key, phase) => {
        phases.push({key, phase});
        const found = tickets.find(item => item.key === key);
        if (found && !found.labels.includes(`sdd:${phase}`)) {
          found.labels = [...found.labels, `sdd:${phase}`];
        }
      },
    },
  );
  window.chooseAgent('cursor');
  window.spy();
  assert.deepEqual(phases, []);
  const card = window.board().pool.find(item => item.key === '1');
  assert.ok(card);
  assert.equal(card.reason, 'несколько pull request');
  assert.equal(columnCards(window.board(), 'proposing')?.length, 0);
  rmSync(dir, {recursive: true, force: true});
}

function proveAMissingCheckoutKeepsAnAssignedTicketInThePoolAndSpyDoesNotSetProposing73(): void {
  const {dir, home, arcadia} = yard();
  writeLaunch(home, ['alpha'], {arcadia});
  const tickets = [
    ticket({
      key: '1',
      queue: 'alpha',
      sddService: 'services/missing',
      assignee: MANAGER,
      title: 'Gone',
      labels: ['sdd:cycle'],
    }),
  ];
  const phases: {key: string; phase: string}[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => tickets,
      writePhase: (key, phase) => {
        phases.push({key, phase});
        const found = tickets.find(item => item.key === key);
        if (found && !found.labels.includes(`sdd:${phase}`)) {
          found.labels = [...found.labels, `sdd:${phase}`];
        }
      },
    },
  );
  window.chooseAgent('cursor');
  window.spy();
  assert.deepEqual(phases, []);
  const card = window.board().pool.find(item => item.key === '1');
  assert.ok(card);
  assert.equal(card.reason, 'каталога нет');
  assert.equal(columnCards(window.board(), 'proposing')?.length, 0);
  rmSync(dir, {recursive: true, force: true});
}

function proveOneOpenPullRequestLetsSpySetProposingForAnAssignedTicket74(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const tickets = [
    ticket({
      key: '1',
      queue: 'alpha',
      sddService: 'services/billing',
      assignee: MANAGER,
      title: 'One',
      openPullRequests: 1,
      labels: ['sdd:cycle'],
    }),
  ];
  const phases: {key: string; phase: string}[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => tickets,
      writePhase: (key, phase) => {
        phases.push({key, phase});
        const found = tickets.find(item => item.key === key);
        if (found && !found.labels.includes(`sdd:${phase}`)) {
          found.labels = [...found.labels, `sdd:${phase}`];
        }
      },
    },
  );
  window.chooseAgent('cursor');
  window.spy();
  assert.deepEqual(phases, [{key: '1', phase: 'proposing'}]);
  const board = window.board();
  assert.deepEqual(board.pool, []);
  assert.deepEqual(
    columnCards(board, 'proposing')?.map(card => card.key),
    ['1'],
  );
  rmSync(dir, {recursive: true, force: true});
}

function proveTakeOnAPhaselessTicketSetsTheAssigneeAndSpyThenSetsProposing75(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const tickets = [
    ticket({
      key: '1',
      queue: 'alpha',
      sddService: 'services/billing',
      title: 'Take me',
      labels: ['sdd:cycle'],
    }),
  ];
  const assignees: {key: string; login: string}[] = [];
  const phases: {key: string; phase: string}[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => tickets,
      writeAssignee: (key, login) => {
        assignees.push({key, login});
        const found = tickets.find(item => item.key === key);
        if (found) {
          found.assignee = login;
        }
      },
      writePhase: (key, phase) => {
        phases.push({key, phase});
        const found = tickets.find(item => item.key === key);
        if (found && !found.labels.includes(`sdd:${phase}`)) {
          found.labels = [...found.labels, `sdd:${phase}`];
        }
      },
    },
  );
  window.chooseAgent('cursor');
  window.take('1');
  assert.deepEqual(assignees, [{key: '1', login: MANAGER}]);
  assert.deepEqual(phases, []);
  assert.equal(tickets[0]?.labels.includes('sdd:proposing'), false);
  assert.deepEqual(
    window.board().pool.map(card => card.key),
    ['1'],
  );
  window.spy();
  assert.deepEqual(phases, [{key: '1', phase: 'proposing'}]);
  assert.equal(tickets[0]?.labels.includes('sdd:proposing'), true);
  const board = window.board();
  assert.deepEqual(board.pool, []);
  assert.deepEqual(
    columnCards(board, 'proposing')?.map(card => card.key),
    ['1'],
  );
  rmSync(dir, {recursive: true, force: true});
}

function proveTakeDoesNotCallWriteAssigneeWhenTheHomePathIsAbsent76(): void {
  let calls = 0;
  const window = openWindow(
    {},
    {
      login: () => MANAGER,
      writeAssignee: () => {
        calls += 1;
      },
      tickets: () => [
        ticket({key: '1', queue: 'alpha', sddService: 'services/billing', title: 'Bare'}),
      ],
    },
  );
  assert.equal(window.board().takeDisabled, true);
  window.take('1');
  assert.equal(calls, 0);
}

function proveTakeOnAnImplementingPoolCycleSetsTheAssigneeAndLeavesThePhase77(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const tickets = [cycle('1', 'implementing', {assignee: '', title: 'Build', openPullRequests: 1})];
  const assignees: {key: string; login: string}[] = [];
  const phases: {key: string; phase: string}[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => tickets,
      writeAssignee: (key, login) => {
        assignees.push({key, login});
        const found = tickets.find(item => item.key === key);
        if (found) {
          found.assignee = login;
        }
      },
      writePhase: (key, phase) => {
        phases.push({key, phase});
      },
    },
  );
  window.chooseAgent('cursor');
  const before = window.board().pool.find(card => card.key === '1');
  assert.equal(before?.take, true);
  assert.equal(before?.icon, undefined);
  assert.equal(before?.takeDisabled, undefined);
  window.take('1');
  assert.deepEqual(assignees, [{key: '1', login: MANAGER}]);
  assert.deepEqual(phases, []);
  assert.deepEqual(tickets[0]?.labels, ['sdd:cycle', 'sdd:implementing']);
  const board = window.board();
  assert.deepEqual(board.pool, []);
  assert.deepEqual(
    columnCards(board, 'implementing')?.map(card => card.key),
    ['1'],
  );
  rmSync(dir, {recursive: true, force: true});
}

function proveTakeOnAnImplementingPoolCycleWritesTheAssigneeWhenAModelSlotIsEmpty78(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const tickets = [cycle('1', 'implementing', {assignee: '', title: 'Build'})];
  const assignees: {key: string; login: string}[] = [];
  const phases: {key: string; phase: string}[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      answers: () => true,
      tickets: () => tickets,
      writeAssignee: (key, login) => {
        assignees.push({key, login});
        const found = tickets.find(item => item.key === key);
        if (found) {
          found.assignee = login;
        }
      },
      writePhase: (key, phase) => {
        phases.push({key, phase});
      },
    },
  );
  window.chooseAgent('cursor');
  window.leaveModel('mechanical', '');
  const before = window.board().pool.find(card => card.key === '1');
  assert.equal(before?.take, true);
  assert.equal(before?.takeDisabled, undefined);
  window.take('1');
  assert.deepEqual(assignees, [{key: '1', login: MANAGER}]);
  assert.deepEqual(phases, []);
  assert.deepEqual(tickets[0]?.labels, ['sdd:cycle', 'sdd:implementing']);
  const board = window.board();
  assert.deepEqual(board.pool, []);
  assert.deepEqual(
    columnCards(board, 'implementing')?.map(card => card.key),
    ['1'],
  );
  rmSync(dir, {recursive: true, force: true});
}

function proveTwoOpenPullRequestsKeepTheCardInThePoolAndDoNotWriteTheAssignee79(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const tickets = [
    ticket({
      key: '1',
      queue: 'alpha',
      sddService: 'services/billing',
      title: 'Split',
      openPullRequests: 2,
    }),
  ];
  const assignees: {key: string; login: string}[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => tickets,
      writeAssignee: (key, login) => {
        assignees.push({key, login});
      },
    },
  );
  window.chooseAgent('cursor');
  const card = window.board().pool.find(item => item.key === '1');
  assert.ok(card);
  assert.equal(card.icon, true);
  assert.equal(card.reason, 'несколько pull request');
  assert.equal(card.takeDisabled, true);
  window.take('1');
  assert.deepEqual(assignees, []);
  assert.deepEqual(
    window.board().pool.map(item => item.key),
    ['1'],
  );
  rmSync(dir, {recursive: true, force: true});
}

function proveOneOpenPullRequestLetsTakeWriteTheAssignee80(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const tickets = [
    ticket({
      key: '1',
      queue: 'alpha',
      sddService: 'services/billing',
      title: 'One',
      openPullRequests: 1,
    }),
  ];
  const assignees: {key: string; login: string}[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => tickets,
      writeAssignee: (key, login) => {
        assignees.push({key, login});
      },
    },
  );
  window.chooseAgent('cursor');
  const card = window.board().pool.find(item => item.key === '1');
  assert.ok(card);
  assert.equal(card.icon, undefined);
  assert.equal(card.take, true);
  assert.equal(card.takeDisabled, undefined);
  window.take('1');
  assert.deepEqual(assignees, [{key: '1', login: MANAGER}]);
  rmSync(dir, {recursive: true, force: true});
}

function proveAPoolTicketWithACheckoutBreakShowsTheIconAndTakeDoesNotWrite81(): void {
  const {dir, home, arcadia} = yard();
  writeLaunch(home, ['alpha'], {arcadia});
  const tickets = [
    ticket({
      key: '1',
      queue: 'alpha',
      sddService: 'services/missing',
      title: 'Gone',
    }),
  ];
  const assignees: {key: string; login: string}[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => tickets,
      writeAssignee: (key, login) => {
        assignees.push({key, login});
      },
    },
  );
  window.chooseAgent('cursor');
  const board = window.board();
  const card = board.pool.find(item => item.key === '1');
  assert.ok(card);
  assert.equal(card.icon, true);
  assert.equal(card.reason, 'каталога нет');
  assert.equal(card.takeDisabled, true);
  assert.equal(
    board.cards.some(item => item.key === '1'),
    false,
  );
  window.take('1');
  assert.deepEqual(assignees, []);
  rmSync(dir, {recursive: true, force: true});
}

function proveASilentAgentDoesNotShowTheCheckoutEmptyModelRow94(): void {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeServiceConfig(checkout, ['alpha']);
  writeLaunch(home, ['alpha'], {arcadia});
  writeOverlay(checkout, [], 'models:\n  mechanical: ""\n');
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      answers: () => false,
      tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})],
    },
  );
  window.chooseAgent('cursor');
  assert.deepEqual(window.board().rows, [{text: 'агент не отвечает'}]);
  assert.equal(readHome(home).agent, 'cursor');
  rmSync(dir, {recursive: true, force: true});
}

function proveHealthyPoolCardsAreOrderedByKeyAndHaveNoIcon97(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const window = openCycles(home, [
    ticket({key: 'c', queue: 'alpha', sddService: 'services/billing', title: 'Third'}),
    cycle('b', 'proposed', {assignee: '', title: 'Gate', openPullRequests: 1}),
    ticket({key: 'a', queue: 'alpha', sddService: 'services/billing', title: 'First'}),
  ]);
  window.chooseAgent('cursor');
  const checkout = path.join(arcadia, 'services', 'billing');
  const place = {
    queue: 'alpha',
    choices: ['services/billing'],
    checkout,
    service: 'services/billing',
  };
  assert.deepEqual(window.board().pool, [
    {key: 'a', title: 'First', take: true, ...place},
    {
      key: 'b',
      title: 'Gate',
      take: true,
      station: 'proposing',
      phaseRow: 0,
      reason: 'proposed',
      ...place,
    },
    {key: 'c', title: 'Third', take: true, ...place},
  ]);
  rmSync(dir, {recursive: true, force: true});
}

function proveBothModelsEmpty135(): void {
  const {dir, home, arcadia} = yard();
  const billing = path.join(arcadia, 'services', 'billing');
  mkdirSync(billing, {recursive: true});
  writeServiceConfig(billing, ['alpha']);
  writeLaunch(home, ['alpha'], {arcadia});
  writeOverlay(billing, [], 'models:\n  mechanical: ""\n  judgment: ""\n');
  const assignees: string[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      answers: () => true,
      tickets: () => [
        ticket({key: '1', queue: 'alpha', sddService: 'services/billing', title: 'Bare'}),
      ],
      writeAssignee: key => {
        assignees.push(key);
      },
    },
  );
  window.chooseAgent('cursor');
  const row = window.board().rows.find(item => item.text.includes(billing));
  assert.ok(row);
  assert.equal(row.text.includes('нужны модели mechanical и judgment'), true);
  window.take('1');
  assert.deepEqual(assignees, []);
  rmSync(dir, {recursive: true, force: true});
}

async function proveAnUnnamedServiceIsAField(): Promise<void> {
  const dir = mkdtempSync(path.join(tmpdir(), 'ai-factory-page-'));
  const github = path.join(dir, 'github');
  const home = path.join(dir, 'home.yaml');
  const repo = path.join(github, 'acme', 'many');
  try {
    mkdirSync(path.join(repo, 'services', 'api'), {recursive: true});
    writeQueues(repo, ['alpha']);
    writeQueues(path.join(repo, 'services', 'api'), ['alpha']);
    writeFileSync(home, `watch:\n  - acme/many\nroots:\n  github: ${github}\n`);
    const tickets = [
      ticket({key: '2', repo: 'acme/many', title: 'Root', labels: ['alpha', 'sdd:cycle']}),
    ];
    const writes: {key: string; service: string}[] = [];
    const window = openWindow(
      {homePath: home, adapter: 'github'},
      {
        tickets: () => tickets,
        writeService: (key, service) => {
          writes.push({key, service});
          const found = tickets.find(item => item.key === key);
          if (found) {
            found.sddService = service;
          }
        },
      },
    );
    const page = await serveBoard(window);
    try {
      const first = await pageHtml(page.url);
      assert.match(articleOf(first, '2'), /aria-label="Поломка"/);
      assert.equal(first.includes('<select'), false);
      assert.equal(first.includes('role="dialog"'), false);
      assert.equal(
        (await post(page.url, 'act', new URLSearchParams({act: 'repair', key: '2'}).toString()))
          .status,
        200,
      );
      const popup = await pageHtml(page.url);
      const dialog = between(popup, '<div class="popup repair"', '</div></div>');
      assert.match(dialog, /aria-label="Поломка"/);
      assert.equal(popup.includes('role="dialog" aria-label="Настройки"'), false);
      assert.match(dialog, /<option disabled(?:="")?>—<\/option>/);
      assert.equal(/<option disabled(?:="")? value=/.test(dialog), false);
      assert.match(dialog, /<option value="" selected="">/);
      assert.match(dialog, /<option value="services\/api">/);
      assert.equal(articleOf(popup, '2').includes('<select'), false);
      const missing = await post(
        page.url,
        'act',
        new URLSearchParams({act: 'choose-service', key: '2'}).toString(),
      );
      assert.equal(missing.status, 409);
      assert.ok(missing.body.length > 0);
      assert.deepEqual(writes, []);
      const root = await post(
        page.url,
        'act',
        new URLSearchParams({act: 'choose-service', key: '2', service: ''}).toString(),
      );
      assert.equal(root.status, 200);
      assert.deepEqual(writes, [{key: '2', service: ''}]);
      const cleared = await pageHtml(page.url);
      assert.equal(cleared.includes('<select'), false);
      assert.equal(cleared.includes('role="dialog"'), false);
      const nested = await post(
        page.url,
        'act',
        new URLSearchParams({act: 'choose-service', key: '2', service: 'services/api'}).toString(),
      );
      assert.equal(nested.status, 200);
      assert.deepEqual(writes, [
        {key: '2', service: ''},
        {key: '2', service: 'services/api'},
      ]);
    } finally {
      await page.close();
    }
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
}

spec('board', () => {
  requirement('The board is a column of keys and seven stations', () => {
    scenario('An empty station stays the same width', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [bare('1', 'Take me')]},
        async (page, window) => {
          window.chooseAgent('cursor');
          const html = await pageHtml(page.url);
          assert.match(html, /grid-template-columns:\s*252px repeat\(7, minmax\(0, 1fr\)\)/);
          for (const name of COLUMN_NAMES) {
            assert.match(stationOf(html, '1', name), /data-station="/);
          }
          assert.match(stationOf(html, '1', 'specifying'), /aria-label="Снять гейт specifying"/);
          assert.match(stationOf(html, '1', 'tasking'), /<span class="dot"/);
          assert.equal(stationOf(html, '1', 'specifying').includes('class="plaque"'), false);
        },
      );
    });
    scenario('The window adds no phase control', async () => {
      const phases: string[] = [];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [bare('1', 'Take me')],
          writePhase: (_key, phase) => {
            phases.push(phase);
          },
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const opened = await post(
            page.url,
            'act',
            new URLSearchParams({act: 'open', key: '1'}).toString(),
          );
          assert.equal(opened.status, 200);
          const html = await pageHtml(page.url);
          assert.match(html, /class="ticket pool is-open"/);
          assert.equal(html.includes('name="phase"'), false);
          assert.deepEqual(phases, []);
        },
      );
    });
    scenario('An empty pool draws no tile', async () => {
      await hosted({login: () => MANAGER, tickets: () => []}, async (page, window) => {
        window.chooseAgent('cursor');
        const html = await pageHtml(page.url);
        assert.match(html, /class="head"/);
        for (const name of COLUMN_NAMES) {
          assert.match(html, new RegExp(`<span class="phase">${name}</span>`));
        }
        assert.equal(html.includes('<article'), false);
        assert.equal(html.includes('aria-label="Взять"'), false);
      });
    });
  });
  requirement('Take writes this process login', () => {
    scenario('Play is named Take and is not the button text', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [bare('1', 'Take me')]},
        async (page, window) => {
          window.chooseAgent('cursor');
          const html = await pageHtml(page.url);
          assert.match(html, /<button class="round play" type="submit" aria-label="Взять">/);
          assert.equal(/<button[^>]*>\s*Взять\s*<\/button>/.test(html), false);
        },
      );
    });
    scenario('A drop on a station does not write the phase', async () => {
      const phases: string[] = [];
      const assignees: string[] = [];
      const tickets = [bare('1', 'Take me')];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => tickets,
          writeAssignee: (key, login) => {
            assignees.push(key);
            const found = tickets.find(item => item.key === key);
            if (found) {
              found.assignee = login;
            }
          },
          writePhase: (key, phase) => {
            phases.push(phase);
            const found = tickets.find(item => item.key === key);
            if (found && !found.labels.includes(`sdd:${phase}`)) {
              found.labels = [...found.labels, `sdd:${phase}`];
            }
          },
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          assert.equal(gesture('pool', '1', 'station'), 'take');
          assert.equal(gesture('pool', '1', 'card'), '');
          const taken = await post(page.url, 'take', new URLSearchParams({key: '1'}).toString());
          assert.equal(taken.status, 200);
          assert.deepEqual(assignees, ['1']);
          assert.deepEqual(phases, ['proposing']);
          assert.equal(phases.includes('implementing'), false);
        },
      );
    });
    scenario("An exclamation replaces play on this cycle's break", async () => {
      const assignees: string[] = [];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [ticket({key: '1', queue: 'alpha', title: 'Bare'})],
          writeAssignee: key => {
            assignees.push(key);
          },
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const html = await pageHtml(page.url);
          const row = articleOf(html, '1');
          assert.match(row, /aria-label="Поломка"/);
          assert.equal(row.includes('aria-label="Взять"'), false);
          assert.equal(row.includes('не назван сервис'), false);
          const taken = await post(page.url, 'take', new URLSearchParams({key: '1'}).toString());
          assert.equal(taken.status, 409);
          assert.deepEqual(assignees, []);
        },
      );
    });
    scenario('A board-wide silence leaves play disabled', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [bare('1', 'Quiet')]},
        async (page, window) => {
          window.chooseAgent('cursor');
          window.leaveModel('judgment', '');
          const html = await pageHtml(page.url);
          const row = articleOf(html, '1');
          assert.match(
            row,
            /<button class="round play off" type="submit" disabled(?:="")? aria-label="Взять">/,
          );
          assert.equal(row.includes('aria-label="Поломка"'), false);
          assert.match(html, /нужна модель judgment/);
        },
      );
    });
  });
  requirement('The icon is hidden while a step runs or checks are waited', () => {
    scenario('A gate shows the icon', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [
            ticket({
              key: '2',
              queue: 'alpha',
              sddService: 'services/billing',
              assignee: MANAGER,
              title: 'Propose it',
              labels: ['sdd:cycle', 'sdd:proposed'],
            }),
          ],
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const html = await pageHtml(page.url);
          assert.equal(html.includes('class="mark"'), false);
          assert.match(stationOf(html, '2', 'proposing'), /class="plaque"/);
          assert.equal(articleOf(html, '2').includes('aria-label="Взять"'), false);
        },
      );
    });
    scenario('A running step keeps the reason line', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [
            held('1', 'specifying', {dependsOn: ['9']}),
            ticket({key: '9', title: 'blocker', labels: ['note']}),
          ],
          leading: () => true,
          turn: () => 'restore-baseline',
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const html = await pageHtml(page.url);
          const plaque = stationOf(html, '1', 'specifying');
          assert.match(plaque, /блокеры 9/);
          assert.equal(plaque.includes('restore-baseline'), false);
          assert.equal(plaque.includes('class="mark"'), false);
          const card = window
            .board()
            .columns.find(column => column.name === 'specifying')
            ?.cards.find(item => item.key === '1');
          assert.equal(card?.icon, undefined);
          assert.equal(card?.reason, 'блокеры 9');
        },
      );
    });
  });
  requirement('A station door opens the port and does not write a phase', () => {
    scenario('A file ahead of the plaque is a door', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'specifying')],
          reviewPlace: place => `https://review.example/${place.file}?line=${place.line}`,
        },
        async (page, window, paths) => {
          pageWrite(paths.arcadia, '1', 'proposal.md', '# proposal\n');
          window.chooseAgent('cursor');
          const html = await pageHtml(page.url);
          assert.match(stationOf(html, '1', 'proposing'), /aria-label="plan"/);
          assert.match(stationOf(html, '1', 'specifying'), /class="plaque"/);
        },
      );
    });
    scenario('A door opens the port and does not write a phase', async () => {
      const phases: string[] = [];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'specifying')],
          writePhase: (_key, phase) => {
            phases.push(phase);
          },
          reviewPlace: place => `https://review.example/${place.file}?line=${place.line}`,
        },
        async (page, window, paths) => {
          pageWrite(paths.arcadia, '1', 'proposal.md', '# proposal\n');
          window.chooseAgent('cursor');
          const html = await pageHtml(page.url);
          const door = stationOf(html, '1', 'proposing');
          assert.match(
            door,
            /<a class="big" href="https:\/\/review\.example\/openspec\/changes\/issue-1\/proposal\.md\?line=1" aria-label="plan">/,
          );
          assert.equal(door.includes('name="phase"'), false);
          assert.deepEqual(phases, []);
        },
      );
    });
    scenario('An empty port leaves the circle without a navigation', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'specifying')],
          reviewPlace: () => '',
        },
        async (page, window, paths) => {
          pageWrite(paths.arcadia, '1', 'proposal.md', '# proposal\n');
          window.chooseAgent('cursor');
          const door = stationOf(await pageHtml(page.url), '1', 'proposing');
          assert.match(door, /<button class="big" type="button" aria-label="plan">/);
          assert.equal(door.includes('href='), false);
        },
      );
    });
    scenario('Several specs open one list of capabilities', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'implementing')],
          reviewPlace: place => `https://review.example/${place.file}?line=${place.line}`,
        },
        async (page, window, paths) => {
          pageWrite(paths.arcadia, '1', 'specs/beta/spec.md', '# beta\n');
          pageWrite(paths.arcadia, '1', 'specs/alpha/spec.md', '# alpha\n');
          window.chooseAgent('cursor');
          const closed = await pageHtml(page.url);
          const station = stationOf(closed, '1', 'specifying');
          assert.equal(station.match(/aria-label="spec"/g)?.length, 1);
          assert.match(station, /name="act" value="open"/);
          assert.equal(station.includes('alpha'), false);
          assert.equal(station.includes('beta'), false);
          assert.equal(closed.includes('class="caps"'), false);
          const opened = await post(
            page.url,
            'act',
            new URLSearchParams({act: 'open', key: '1'}).toString(),
          );
          assert.equal(opened.status, 200);
          const html = await pageHtml(page.url);
          assert.equal(stationOf(html, '1', 'specifying').match(/aria-label="spec"/g)?.length, 1);
          assert.equal(articleOf(html, '1').includes('class="caps"'), false);
          assert.match(html, /id="cap-alpha"/);
          assert.match(html, /id="cap-beta"/);
        },
      );
    });
    scenario('The current station is the plaque', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'designing')]},
        async (page, window, paths) => {
          pageWrite(paths.arcadia, '1', 'design.md', '# design\n');
          window.chooseAgent('cursor');
          const html = await pageHtml(page.url);
          const station = stationOf(html, '1', 'designing');
          assert.match(station, /class="plaque"/);
          assert.equal(station.includes('aria-label="design"'), false);
        },
      );
    });
    scenario('A note does not move the plaque', async () => {
      const phases: string[] = [];
      const tickets = [held('1', 'implementing')];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => tickets,
          writePhase: (_key, phase) => {
            phases.push(phase);
          },
          review: () => ({
            threads: [{marker: 'note', file: 'design.md', lines: ['look']}],
          }),
        },
        async (page, window, paths) => {
          pageWrite(paths.arcadia, '1', 'design.md', '# design\n');
          window.chooseAgent('cursor');
          const html = await pageHtml(page.url);
          assert.match(stationOf(html, '1', 'implementing'), /class="plaque"/);
          assert.match(stationOf(html, '1', 'designing'), /aria-label="design"/);
          assert.match(stationOf(html, '1', 'designing'), /class="pip"/);
          assert.deepEqual(phases, []);
          assert.deepEqual(tickets[0]?.labels, ['sdd:cycle', 'sdd:implementing']);
        },
      );
    });
  });
});

spec('board', () => {
  requirement('A plaque shows the top and the bottom in order', () => {
    scenario('Ask is the top while the cycle waits', async () => {
      const tickets = [
        held('1', 'proposing', {
          labels: ['sdd:cycle', 'sdd:proposing', 'sdd:wait-human'],
          comments: [{body: 'Review the proposal and accept it.'}],
        }),
      ];
      await hosted({login: () => MANAGER, tickets: () => tickets}, async (page, window) => {
        window.chooseAgent('cursor');
        const waiting = stationOf(await pageHtml(page.url), '1', 'proposing');
        assert.match(waiting, /<span class="kicker">ask<\/span>/);
        assert.match(waiting, /Review the proposal and accept it\./);
        assert.equal(waiting.includes('class="stat"'), false);
        tickets[0]?.labels.splice(tickets[0].labels.indexOf('sdd:wait-human'), 1);
        const cleared = stationOf(await pageHtml(page.url), '1', 'proposing');
        assert.equal(cleared.includes('>ask<'), false);
        assert.match(cleared, /<div class="stat">0<\/div>/);
      });
    });
    scenario('A focus gap is the top when there is no ask', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [
            held('1', 'specifying', {
              comments: [{body: 'sdd:focus\nPlan solid\nSpecify src/a.ts:1\n'}],
            }),
          ],
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const plaque = stationOf(await pageHtml(page.url), '1', 'specifying');
          assert.match(plaque, /<span class="kicker">Specify<\/span>/);
          assert.equal(plaque.includes('Plan'), false);
        },
      );
    });
    scenario('A solid focus adds no gap line', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [
            held('1', 'proposing', {
              comments: [{body: 'sdd:focus\nChange solid\nPlan solid\nSpecify solid\n'}],
            }),
          ],
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const plaque = stationOf(await pageHtml(page.url), '1', 'proposing');
          assert.equal(plaque.includes('class="kicker"'), false);
          assert.equal(plaque.includes('Plan'), false);
          assert.match(plaque, /<div class="stat">0<\/div>/);
        },
      );
    });
    scenario('Review is the top when text is unanswered', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'specifying')],
          review: () => ({threads: [{lines: ['please look']}]}),
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const plaque = stationOf(await pageHtml(page.url), '1', 'specifying');
          assert.match(plaque, /<span class="kicker">ревью<\/span>/);
          assert.match(plaque, /please look/);
        },
      );
    });
    scenario('The check state is the top on verifying', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'verifying', {checks: 'red'})],
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const plaque = stationOf(await pageHtml(page.url), '1', 'verifying');
          assert.match(plaque, /<span class="kicker red">red<\/span>/);
          assert.equal(plaque.includes('lint'), false);
          assert.equal(plaque.includes('class="stat"'), false);
        },
      );
    });
    scenario('A click opens the row and does not write a phase', async () => {
      const phases: string[] = [];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'implementing')],
          writePhase: (_key, phase) => {
            phases.push(phase);
          },
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const opened = await post(
            page.url,
            'act',
            new URLSearchParams({act: 'open', key: '1'}).toString(),
          );
          assert.equal(opened.status, 200);
          const html = await pageHtml(page.url);
          assert.match(html, /class="ticket is-open"/);
          assert.equal(html.includes('name="phase"'), false);
          assert.deepEqual(phases, []);
        },
      );
    });
    scenario('The closed plaque hides the tail of the ask', async () => {
      const body =
        'Review the proposal. To accept it, replace the label sdd:proposing with sdd:proposed on this issue, or run sdd accept 5.';
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [
            held('1', 'proposing', {
              labels: ['sdd:cycle', 'sdd:proposing', 'sdd:wait-human'],
              comments: [{body}],
            }),
          ],
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const closed = await pageHtml(page.url);
          const plaque = stationOf(closed, '1', 'proposing');
          assert.equal(plaque.match(/<span class="reason">/g)?.length, 1);
          assert.match(plaque, /text-overflow:\s*ellipsis|class="reason"/);
          assert.match(closed, /\.plaque \.reason[\s\S]*white-space:\s*nowrap[\s\S]*ellipsis/);
          assert.match(closed, /\.station > form:has\(\.plaque\) \{ min-width: 0; width: 100%; \}/);
          const opened = await post(
            page.url,
            'act',
            new URLSearchParams({act: 'open', key: '1'}).toString(),
          );
          assert.equal(opened.status, 200);
          const html = await pageHtml(page.url);
          const side = bandOf(html, '1');
          assert.match(side, /Review the proposal\. To accept it, replace the label sdd:proposing/);
          assert.match(side, /run sdd accept 5\./);
        },
      );
    });
    scenario('A running turn fills an empty plaque', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'specifying'), held('2', 'tasking')],
          turn: key => {
            if (key === '1') {
              return 'restore-baseline';
            }
            if (key === '2') {
              return 'create-tasks';
            }
            return undefined;
          },
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const html = await pageHtml(page.url);
          const specifying = stationOf(html, '1', 'specifying');
          const tasking = stationOf(html, '2', 'tasking');
          assert.match(specifying, /<span class="reason">restore-baseline<\/span>/);
          assert.equal(specifying.includes('class="kicker"'), false);
          assert.equal(specifying.includes('class="mark"'), false);
          assert.match(tasking, /<span class="reason">create-tasks<\/span>/);
          assert.equal(tasking.includes('class="kicker"'), false);
          assert.equal(tasking.includes('class="mark"'), false);
        },
      );
    });
    scenario('A running turn does not replace plaque text', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [
            held('1', 'specifying', {
              labels: ['sdd:cycle', 'sdd:specifying', 'sdd:wait-human'],
              comments: [{body: 'please decide'}],
            }),
          ],
          turn: () => 'restore-baseline',
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const plaque = stationOf(await pageHtml(page.url), '1', 'specifying');
          assert.match(plaque, /<span class="kicker">ask<\/span>/);
          assert.match(plaque, /please decide/);
          assert.equal(plaque.includes('restore-baseline'), false);
        },
      );
    });
  });
  requirement('A break opens one repair field', () => {
    scenario('An unnamed service is a field in the exclamation popup', () =>
      proveAnUnnamedServiceIsAField(),
    );
    scenario('A missing catalog shows the reason and no field', async () => {
      const gone = 'services/gone';
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [ticket({key: '1', queue: 'alpha', sddService: gone, title: 'Gone'})],
        },
        async (page, window, paths) => {
          window.chooseAgent('cursor');
          const catalog = path.join(paths.arcadia, gone);
          assert.equal(existsSync(catalog), false);
          const face = await pageHtml(page.url);
          assert.match(articleOf(face, '1'), /aria-label="Поломка"/);
          assert.equal(face.includes('role="dialog"'), false);
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'repair', key: '1'}).toString()))
              .status,
            200,
          );
          const html = await pageHtml(page.url);
          const dialog = between(html, '<div class="popup repair"', '</div></div>');
          assert.match(dialog, /каталога нет/);
          assert.equal(dialog.includes('<select'), false);
          assert.equal(dialog.includes('name="name"'), false);
          assert.equal(html.includes('role="dialog" aria-label="Настройки"'), false);
          assert.equal(existsSync(catalog), false);
        },
      );
    });
    scenario('An empty model is a board row', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [bare('1', 'Quiet')]},
        async (page, window) => {
          window.chooseAgent('cursor');
          window.leaveModel('judgment', '');
          const html = await pageHtml(page.url);
          const row = articleOf(html, '1');
          assert.match(html, /нужна модель judgment/);
          assert.match(
            row,
            /<button class="round play off" type="submit" disabled(?:="")? aria-label="Взять">/,
          );
          assert.equal(row.includes('aria-label="Поломка"'), false);
          assert.equal(html.includes('role="dialog"'), false);
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'repair', key: '1'}).toString()))
              .status,
            200,
          );
          const after = await pageHtml(page.url);
          assert.equal(after.includes('aria-label="Поломка"'), false);
          assert.equal(after.includes('role="dialog"'), false);
          assert.match(after, /нужна модель judgment/);
        },
      );
    });
    scenario('Several pull requests are not closed by the window', async () => {
      const tickets = [
        ticket({
          key: '1',
          queue: 'alpha',
          sddService: 'services/billing',
          title: 'Pair',
          labels: ['sdd:cycle'],
          openPullRequests: 2,
        }),
      ];
      await hosted({login: () => MANAGER, tickets: () => tickets}, async (page, window) => {
        window.chooseAgent('cursor');
        const face = await pageHtml(page.url);
        assert.match(articleOf(face, '1'), /aria-label="Поломка"/);
        assert.equal(
          (await post(page.url, 'act', new URLSearchParams({act: 'repair', key: '1'}).toString()))
            .status,
          200,
        );
        const html = await pageHtml(page.url);
        const dialog = between(html, '<div class="popup repair"', '</div></div>');
        assert.match(dialog, /несколько pull request/);
        assert.equal(dialog.includes('<select'), false);
        assert.equal(dialog.includes('name="name"'), false);
        const forms = formsOf(dialog);
        assert.equal(forms.length, 1);
        assert.match(forms[0] ?? '', /close-repair/);
        assert.equal(tickets[0]?.openPullRequests, 2);
      });
    });
  });

});

spec('board', () => {
  requirement('The board is a column of keys and seven stations', () => {
    scenario('An empty station stays the same width', () => {
      proveAnEmptySpecifyingColumnStaysAndTheWindowWritesNoPhase46();
    });
    scenario('The window adds no phase control', () => {
      proveAnEmptySpecifyingColumnStaysAndTheWindowWritesNoPhase46();
    });
  });
  requirement('A gate shares the column of the phase it closes', () => {
    scenario('Proposed stands in proposing', () => {
      proveProposedStandsInProposingAndSpecifiedStandsInSpecifying47();
    });
    scenario('Specified stands in specifying', () => {
      proveProposedStandsInProposingAndSpecifiedStandsInSpecifying47();
    });
  });
  requirement("A column shows this manager's cycles", () => {
    scenario('Another assignee is hidden', () => {
      proveAnotherAssigneeIsAbsentAndAPhaseWithNoAssigneeStandsInThePool48();
    });
    scenario('A phase without an assignee stands in the pool', () => {
      proveAnotherAssigneeIsAbsentAndAPhaseWithNoAssigneeStandsInThePool48();
    });
    scenario('Accepting shows the merge while the issue is open', () => {
      proveAnOpenMergeStandsInAcceptingAndAClosedIssueLeaves50();
    });
    scenario('Cancelled leaves the board', () => {
      proveSddCancelledWithAnEarlierPhaseShowsNoCard49();
    });
  });
  requirement('The pool holds cycles the manager can take', () => {
    scenario('A bare cycle label with no assignee is in the pool', () => {
      proveAnOpenWatchListTicketWithSddCycleNoPhaseAndNoAssigneeStandsInThePool67();
    });
    scenario('An issue without the cycle label is absent', () => {
      proveAnOpenTicketOnTheWatchListWithoutSddCycleIsNotInThePool68();
    });
    scenario("This manager's cycle enters proposing when a step can start", () => {
      proveAPhaselessTicketAssignedToThisLoginMovesToProposingAfterSpyWhenModelsAreSet70();
      proveOneOpenPullRequestLetsSpySetProposingForAnAssignedTicket74();
    });
    scenario("This manager's cycle stays when a step cannot start", () => {
      proveAPhaselessTicketAssignedToThisLoginStaysInThePoolWhenAModelSlotIsEmpty71();
    });
    scenario('Two pull requests keep an assigned cycle in the pool', () => {
      proveTwoOpenPullRequestsKeepAnAssignedTicketInThePoolAndSpyDoesNotSetProposing72();
    });
    scenario('A checkout break keeps an assigned cycle in the pool', () => {
      proveAMissingCheckoutKeepsAnAssignedTicketInThePoolAndSpyDoesNotSetProposing73();
    });
  });
  requirement('Take writes this process login', () => {
    scenario('Take on a phaseless cycle writes the login only', () => {
      proveTakeOnAPhaselessTicketSetsTheAssigneeAndSpyThenSetsProposing75();
    });
    scenario('Take does nothing without a home config', () => {
      proveTakeDoesNotCallWriteAssigneeWhenTheHomePathIsAbsent76();
    });
  });
  requirement('Take on a cycle that has a phase keeps the phase', () => {
    scenario('Take keeps the phase', () => {
      proveTakeOnAnImplementingPoolCycleSetsTheAssigneeAndLeavesThePhase77();
    });
    scenario('An empty model still allows Take on a phased cycle', () => {
      proveTakeOnAnImplementingPoolCycleWritesTheAssigneeWhenAModelSlotIsEmpty78();
    });
  });
  requirement('Two open pull requests block Take', () => {
    scenario('Two pull requests leave the card in the pool', () => {
      proveTwoOpenPullRequestsKeepTheCardInThePoolAndDoNotWriteTheAssignee79();
    });
    scenario('One pull request allows Take', () => {
      proveOneOpenPullRequestLetsTakeWriteTheAssignee80();
    });
  });
  requirement('A plaque shows the top and the bottom in order', () => {
    scenario('A focus gap is the top when there is no ask', () => {
      proveAFocusGapShowsSpecifyAndHidesASolidPlan56();
    });
    scenario('A solid focus adds no gap line', () => {
      proveEveryRecordedLayerSolidHasNoLayerLine57();
    });
  });
  requirement('The phase row is read from the cycle', () => {
    scenario('Proposing shows the open-question count', () => {
      proveProposingShowsTwoOpenQuestionsUnderTheHeading51();
    });
    scenario('Specifying has no phase row', () => {
      proveSpecifyingHasNoPhaseRow52();
    });
    scenario('Implementing without tasks.md has no count', () => {
      proveImplementingCountsTasksMdAndOmitsTheCountWhenTheFileIsAbsent54();
    });
    scenario('Verifying shows one check state', () => {
      proveVerifyingShowsRedAndNoneLeavesTheCheckRowBlank55();
    });
    scenario('None leaves the check row blank', () => {
      proveVerifyingShowsRedAndNoneLeavesTheCheckRowBlank55();
    });
  });
  requirement('Column order follows the icon occasion', () => {
    scenario('A hidden icon still sorts first', () => {
      proveARunningStepHidesTheIconWhileTheOccasionStillSortsFirst58();
    });
  });
  requirement('The icon is hidden while a step runs or checks are waited', () => {
    scenario('A gate shows the icon', () => {
      proveProposedStandsInProposingAndSpecifiedStandsInSpecifying47();
    });
    scenario('A running step hides the icon', () => {
      proveARunningStepHidesTheIconWhileTheOccasionStillSortsFirst58();
    });
  });
  requirement('The icon reason is one line', () => {
    scenario('A missing catalog outranks a missing service config', () => {
      proveAMissingCatalogOutranksAMissingServiceConfigInTheReason60();
    });
    scenario('The card hides a question-only reason', () => {
      proveAQuestionOnlyOccasionWhosePhaseRowShowsTheCountHasNoReasonLine61();
    });
    scenario('Children are keys from parent', () => {
      proveAChildRecordPutsAndThatKeyOnTheReason63();
    });
  });
  requirement('A healthy pool card shows Take', () => {
    scenario('A healthy pool card has no icon', () => {
      proveHealthyPoolCardsAreOrderedByKeyAndHaveNoIcon97();
    });
    scenario('A broken pool card disables Take', () => {
      proveAPoolTicketWithACheckoutBreakShowsTheIconAndTakeDoesNotWrite81();
    });
  });
  requirement('No home config leaves one row', () => {
    scenario('The board asks for an agent', () => {
      proveALaunchWithNoHomePathShowsOneRowThatTheFactoryStillNeedsAnAgent0();
      proveAMissingHomeFileShowsTheBoardAndDoesNotStartAStep1();
    });
  });
  requirement('A silent agent leaves one row', () => {
    scenario('A silent agent hides the empty-model row', () => {
      proveASilentAgentHidesTheEmptyModelRow17();
      proveASilentAgentDoesNotShowTheCheckoutEmptyModelRow94();
    });
  });
  requirement('An empty or rejected model names the checkout', () => {
    scenario('Both models empty', () => {
      proveBothModelsEmpty135();
    });
    scenario('A rejected id names the slot', () => {
      proveACatalogThatRejectsTheRecordedJudgmentIdKeepsItAndStopsTheStep95();
    });
    scenario('The factory row comes before the service-config row', () => {
      proveTheServiceConfigGroupHasNoFieldsWhenTheFileDoesNotParseAndOnlyThatCheckoutLosesItsCards106();
    });
  });
});

spec('board', () => {
  requirement("A column shows this manager's cycles", () => {
    scenario('One open pull request leaves proposing in place', async () => {
      const staged = liveYard();
      staged.cycle.labels = ['sdd:cycle', 'remote-solver', 'sdd:proposing'];
      staged.cycle.assignee = MANAGER;
      staged.review.pulls = async () => [
        {id: '11', title: '#6: Show the whole Plan', state: 'OPEN', checks: 'green'},
      ];
      const live = openLiveBoard({
        homePath: staged.homePath,
        repo: 'acme/billing',
        tracker: staged.tracker,
        review: staged.review,
        githubRoot: staged.github,
      });
      try {
        await live.refresh();
        const board = live.window.board();
        const proposing = board.columns.find(column => column.name === 'proposing');
        const card = proposing?.cards.find(item => item.key === '6');
        assert.ok(card);
        assert.equal(card.reason?.includes('мерж') ?? false, false);
        assert.equal(
          board.columns.some(
            column => column.name === 'accepting' && column.cards.some(item => item.key === '6'),
          ),
          false,
        );
      } finally {
        rmSync(staged.dir, {recursive: true, force: true});
      }
    });
  });

  requirement('A station door opens the port and does not write a phase', () => {
    scenario('A door opens the port and does not write a phase', async () => {
      const staged = liveYard();
      staged.cycle.labels = ['sdd:cycle', 'remote-solver', 'sdd:specifying'];
      staged.review.pulls = async () => [
        {id: '11', title: '#6: Show the whole Plan', state: 'OPEN', checks: 'green'},
      ];
      const live = openLiveBoard({
        homePath: staged.homePath,
        repo: 'acme/billing',
        tracker: staged.tracker,
        review: staged.review,
        githubRoot: staged.github,
      });
      try {
        await live.refresh();
        assert.equal(
          live.window.doorPlace('openspec/changes/issue-6/proposal.md'),
          'https://github.com/acme/billing/blob/refs/pull/11/head/openspec/changes/issue-6/proposal.md#L1',
        );
      } finally {
        rmSync(staged.dir, {recursive: true, force: true});
      }
    });
  });
});

spec('phase-header', () => {
  requirement('The phase header stays at the top of the board', () => {
    scenario('The phase header stays at the top of the board while the board scrolls', async () => {
      await hosted({login: () => MANAGER, tickets: () => [held('1', 'proposing')]}, async (page, window) => {
        window.chooseAgent('cursor');
        const html = await pageHtml(page.url);
        assert.match(html, /\.board\s*\{[^}]*overflow-y:\s*auto/);
        assert.match(html, /\.head\s*\{[^}]*position:\s*absolute[^}]*top:\s*0/);
        assert.match(html, /class="board-frame"[\s\S]*class="head"[\s\S]*<main class="board"/);
        assert.equal(between(html, '<main class="board"', '</main>').includes('class="head"'), false);
        assert.equal(html.indexOf('class="top"') < html.indexOf('class="head"'), true);
      });
    });
    scenario('The seven phase names stay aligned with the station columns under them', async () => {
      await hosted({login: () => MANAGER, tickets: () => [held('1', 'proposing')]}, async (page, window) => {
        window.chooseAgent('cursor');
        const html = await pageHtml(page.url);
        assert.match(
          html,
          /\.head, \.stations\s*\{[^}]*grid-template-columns:\s*252px repeat\(7, minmax\(0, 1fr\)\)/,
        );
        const head = between(html, '<div class="head"', '</div>');
        for (const name of COLUMN_NAMES) {
          assert.match(head, new RegExp(`<span class="phase">${name}</span>`));
        }
        assert.match(html, /class="head"[\s\S]*class="stations"/);
        assert.match(articleOf(html, '1'), /class="stations"/);
      });
    });
    scenario('A row that scrolls up fades out under the names and the names stay readable', async () => {
      await hosted({login: () => MANAGER, tickets: () => [held('1', 'proposing')]}, async (page, window) => {
        window.chooseAgent('cursor');
        const html = await pageHtml(page.url);
        assert.match(html, /<article[\s\S]*class="stations"/);
        assert.match(
          html,
          /\.board\s*\{[^}]*-webkit-mask-image:\s*linear-gradient\(to bottom, transparent 0 20\.75px, #000 28px, #000 100%\)/,
        );
        assert.match(
          html,
          /\.board\s*\{[^}]*mask-image:\s*linear-gradient\(to bottom, transparent 0 20\.75px, #000 28px, #000 100%\)/,
        );
        assert.match(html, /\.board\s*\{[^}]*padding-top:\s*28px/);
        assert.match(html, /\.head\s*\{[^}]*background:\s*transparent/);
        assert.match(html, /\.head\s*\{[^}]*z-index:\s*[1-9]/);
      });
    });
    scenario(
      'The phase names stay over the board on a transparent header and a row that scrolls up fades out before it covers the letters',
      async () => {
        await hosted({login: () => MANAGER, tickets: () => [held('1', 'proposing')]}, async (page, window) => {
          window.chooseAgent('cursor');
          const html = await pageHtml(page.url);
          assert.match(html, /\.head\s*\{[^}]*background:\s*transparent/);
          assert.match(
            html,
            /\.board\s*\{[^}]*mask-image:\s*linear-gradient\(to bottom, transparent 0 20\.75px, #000 28px, #000 100%\)/,
          );
          assert.equal(between(html, '<main class="board"', '</main>').includes('class="phase"'), false);
        });
      },
    );
    scenario('The empty band under the names goes away', async () => {
      await hosted({login: () => MANAGER, tickets: () => [held('1', 'proposing')]}, async (page, window) => {
        window.chooseAgent('cursor');
        const html = await pageHtml(page.url);
        assert.match(html, /\.board\s*\{[^}]*padding-top:\s*28px/);
        assert.equal(/\.board\s*\{[^}]*padding-top:\s*88px/.test(html), false);
      });
    });
    scenario(
      'At rest the first row starts at the bottom edge of the header and stays fully readable',
      async () => {
        await hosted({login: () => MANAGER, tickets: () => [held('1', 'proposing')]}, async (page, window) => {
          window.chooseAgent('cursor');
          const html = await pageHtml(page.url);
          const board = between(html, '<main class="board"', '</main>');
          assert.match(board, /^[\s\S]*<article class="ticket"/);
          assert.match(html, /\.board\s*\{[^}]*padding-top:\s*28px/);
          assert.match(html, /\.head\s*\{[^}]*height:\s*28px/);
        });
      },
    );
    scenario('The fade is the header\'s lower padding and nowhere below it', async () => {
      await hosted({login: () => MANAGER, tickets: () => [held('1', 'proposing')]}, async (page, window) => {
        window.chooseAgent('cursor');
        const html = await pageHtml(page.url);
        assert.match(
          html,
          /\.board\s*\{[^}]*mask-image:\s*linear-gradient\(to bottom, transparent 0 20\.75px, #000 28px, #000 100%\)/,
        );
        assert.equal(/transparent 0 28px, #000 68px/.test(html), false);
      });
    });
    scenario(
      'Content is gone through the letters, fades only across the padding under them, and is fully opaque from the bottom edge of the header',
      async () => {
        await hosted({login: () => MANAGER, tickets: () => [held('1', 'proposing')]}, async (page, window) => {
          window.chooseAgent('cursor');
          const html = await pageHtml(page.url);
          assert.match(
            html,
            /linear-gradient\(to bottom, transparent 0 20\.75px, #000 28px, #000 100%\)/,
          );
        });
      },
    );
    scenario(
      'Scrolling a row up fades it inside those 7px and hides it before it reaches the letters',
      async () => {
        await hosted({login: () => MANAGER, tickets: () => [held('1', 'proposing')]}, async (page, window) => {
          window.chooseAgent('cursor');
          const html = await pageHtml(page.url);
          assert.match(html, /transparent 0 20\.75px, #000 28px/);
        });
      },
    );
    scenario('At rest the first row is not inside the fade', async () => {
      await hosted({login: () => MANAGER, tickets: () => [held('1', 'proposing')]}, async (page, window) => {
        window.chooseAgent('cursor');
        const html = await pageHtml(page.url);
        assert.match(html, /\.board\s*\{[^}]*padding-top:\s*28px/);
        assert.match(html, /#000 28px, #000 100%/);
      });
    });
    scenario('The header is 28px tall', async () => {
      await hosted({login: () => MANAGER, tickets: () => [held('1', 'proposing')]}, async (page, window) => {
        window.chooseAgent('cursor');
        const html = await pageHtml(page.url);
        assert.match(html, /\.head\s*\{[^}]*height:\s*28px/);
      });
    });
    scenario('The names are 10px type on a 1.35 line, centered in that 28px', async () => {
      await hosted({login: () => MANAGER, tickets: () => [held('1', 'proposing')]}, async (page, window) => {
        window.chooseAgent('cursor');
        const html = await pageHtml(page.url);
        assert.match(html, /\.phase\s*\{[^}]*font-size:\s*10px/);
        assert.match(html, /\.head\s*\{[^}]*height:\s*28px/);
        assert.match(html, /\.head, \.stations\s*\{[^}]*align-items:\s*center/);
      });
    });
    scenario(
      'The letters run from about 7px to 21px and the padding under them is the last 7px',
      async () => {
        await hosted({login: () => MANAGER, tickets: () => [held('1', 'proposing')]}, async (page, window) => {
          window.chooseAgent('cursor');
          const html = await pageHtml(page.url);
          assert.match(html, /transparent 0 20\.75px, #000 28px/);
          assert.match(html, /\.head\s*\{[^}]*height:\s*28px/);
        });
      },
    );
    scenario('The fade belongs in that lower padding and nowhere below it', async () => {
      await hosted({login: () => MANAGER, tickets: () => [held('1', 'proposing')]}, async (page, window) => {
        window.chooseAgent('cursor');
        const html = await pageHtml(page.url);
        assert.match(html, /transparent 0 20\.75px, #000 28px, #000 100%/);
        assert.equal(/#000 68px/.test(html), false);
      });
    });
    scenario('The mask stays on the scrolling board', async () => {
      await hosted({login: () => MANAGER, tickets: () => [held('1', 'proposing')]}, async (page, window) => {
        window.chooseAgent('cursor');
        const html = await pageHtml(page.url);
        assert.match(html, /\.board\s*\{[^}]*mask-image:/);
        assert.equal(/\.head\s*\{[^}]*mask-image:/.test(html), false);
      });
    });
    scenario(
      'The names stay outside the mask, transparent, 28px tall, and aligned with the station columns',
      async () => {
        await hosted({login: () => MANAGER, tickets: () => [held('1', 'proposing')]}, async (page, window) => {
          window.chooseAgent('cursor');
          const html = await pageHtml(page.url);
          assert.match(html, /class="board-frame"[\s\S]*class="head"[\s\S]*<main class="board"/);
          assert.match(html, /\.head\s*\{[^}]*background:\s*transparent/);
          assert.match(html, /\.head\s*\{[^}]*height:\s*28px/);
          assert.match(
            html,
            /\.head, \.stations\s*\{[^}]*grid-template-columns:\s*252px repeat\(7, minmax\(0, 1fr\)\)/,
          );
        });
      },
    );
    scenario('The mask fades from 20.75px to 28px', async () => {
      await hosted({login: () => MANAGER, tickets: () => [held('1', 'proposing')]}, async (page, window) => {
        window.chooseAgent('cursor');
        const html = await pageHtml(page.url);
        assert.match(html, /transparent 0 20\.75px, #000 28px/);
      });
    });
    scenario('padding-top is 28px, the header height', async () => {
      await hosted({login: () => MANAGER, tickets: () => [held('1', 'proposing')]}, async (page, window) => {
        window.chooseAgent('cursor');
        const html = await pageHtml(page.url);
        assert.match(html, /\.board\s*\{[^}]*padding-top:\s*28px/);
        assert.match(html, /\.head\s*\{[^}]*height:\s*28px/);
      });
    });
    scenario('The first row starts on that edge', async () => {
      await hosted({login: () => MANAGER, tickets: () => [held('1', 'proposing')]}, async (page, window) => {
        window.chooseAgent('cursor');
        const html = await pageHtml(page.url);
        const board = between(html, '<main class="board"', '</main>');
        assert.match(board, /<main class="board"><article class="ticket"/);
        assert.match(html, /\.board\s*\{[^}]*padding-top:\s*28px/);
      });
    });
    scenario('The only air between the letters and the row is the header\'s own lower padding', async () => {
      await hosted({login: () => MANAGER, tickets: () => [held('1', 'proposing')]}, async (page, window) => {
        window.chooseAgent('cursor');
        const html = await pageHtml(page.url);
        assert.match(html, /\.board\s*\{[^}]*padding-top:\s*28px/);
        assert.match(html, /transparent 0 20\.75px, #000 28px/);
        assert.equal(/padding-top:\s*88px/.test(html), false);
      });
    });
    scenario('The page bar above the board is not the phase header', async () => {
      await hosted({login: () => MANAGER, tickets: () => [held('1', 'proposing')]}, async (page, window) => {
        window.chooseAgent('cursor');
        const html = await pageHtml(page.url);
        const top = between(html, '<header class="top"', '</header>');
        const board = between(html, '<main class="board"', '</main>');
        const head = between(html, '<div class="head"', '</div>');
        assert.equal(top.includes('class="phase"'), false);
        for (const name of COLUMN_NAMES) {
          assert.match(head, new RegExp(`<span class="phase">${name}</span>`));
        }
        assert.equal(board.includes('<header class="top"'), false);
        assert.equal(top.includes('<div class="head"'), false);
        assert.equal(/\.top\s*\{[^}]*position:\s*sticky/.test(html), false);
      });
    });
    scenario(
      'Scrolling the sidebar does not move the header and scrolling the board does not move the sidebar',
      async () => {
        await hosted(
          {login: () => MANAGER, tickets: () => [held('1', 'proposing')]},
          async (page, window) => {
            window.chooseAgent('cursor');
            assert.equal(
              (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
                .status,
              200,
            );
            const html = await pageHtml(page.url);
            assert.match(html, /\.board\s*\{[^}]*overflow-y:\s*auto/);
            assert.match(html, /\.side-scroll\s*\{[^}]*overflow:\s*auto/);
            assert.match(html, /\.sidebar\s*\{[^}]*position:\s*fixed/);
            const board = between(html, '<main class="board"', '</main>');
            assert.match(html, /class="board-frame"[\s\S]*class="head"[\s\S]*<main class="board"/);
            assert.equal(board.includes('class="head"'), false);
            assert.equal(board.includes('class="sidebar"'), false);
            const sidebar = bandOf(html, '1');
            assert.equal(sidebar.includes('class="head"'), false);
            assert.match(sidebar, /<div class="side-scroll">/);
          },
        );
      },
    );
  });
});
