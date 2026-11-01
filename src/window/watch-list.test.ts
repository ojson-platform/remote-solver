import assert from 'node:assert/strict';
import {existsSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import path from 'node:path';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {openWindow} from './window.ts';
import {
  MANAGER,
  columnCards,
  cycle,
  proveTheMachineSpyLeavesABareCycleOutAndDoesNotReadAifactory45,
  readHome,
  ticket,
  writeLaunch,
  writeOverlay,
  writeServiceConfig,
  yard,
} from './window.harness.ts';

function proveAnEmptyRootLeavesArcadiaOrGithub21(): void {
  const {dir, home, github} = yard();
  writeLaunch(home, ['alpha'], {arcadia: '', github});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})],
    },
  );
  window.leaveRoots({arcadia: '   ', github: ''});
  const doc = readHome(home);
  assert.equal(doc.roots?.arcadia, undefined);
  assert.equal(doc.roots?.github, undefined);
  assert.equal(window.settings().roots.arcadia, '~/arcadia');
  assert.equal(window.settings().roots.github, '~/github');
  const card = window.board().pool.find(item => item.key === '1');
  assert.ok(card);
  assert.equal(card.checkout, path.join(homedir(), 'arcadia', 'services', 'billing'));
  assert.equal(card.queue, 'alpha');
  assert.deepEqual(card.choices, []);
  assert.equal(
    window.board().cards.some(item => item.key === '1'),
    false,
  );
  rmSync(dir, {recursive: true, force: true});
}

function proveTrackerGathersTheCheckoutUnderTheArcadiaRoot23(): void {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  writeLaunch(home, ['alpha'], {arcadia});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})],
    },
  );
  const card = window.board().pool.find(item => item.key === '1');
  assert.ok(card);
  assert.equal(card.checkout, checkout);
  assert.equal(card.queue, 'alpha');
  assert.deepEqual(card.choices, []);
  assert.equal(card.reason, 'каталога нет');
  assert.equal(
    window.board().cards.some(item => item.key === '1'),
    false,
  );
  assert.equal(existsSync(checkout), false);
  rmSync(dir, {recursive: true, force: true});
}

function proveGithubGathersUnderTheRepositoryAndAnEmptySddServiceIsThatRoot24(): void {
  const {dir, home, github} = yard();
  const repo = path.join(github, 'acme', 'billing');
  const nested = path.join(repo, 'services', 'api');
  mkdirSync(nested, {recursive: true});
  writeServiceConfig(nested, ['alpha']);
  writeServiceConfig(repo, ['alpha']);
  writeLaunch(home, ['acme/billing'], {github});
  const tickets = [
    ticket({
      key: '1',
      repo: 'acme/billing',
      sddService: 'services/api',
      labels: ['alpha', 'sdd:cycle'],
    }),
    ticket({
      key: '2',
      repo: 'acme/billing',
      sddService: '',
      labels: ['alpha', 'sdd:cycle'],
    }),
  ];
  const window = openWindow({homePath: home, adapter: 'github'}, {tickets: () => tickets});
  const board = window.board();
  const nestedCard = board.pool.find(item => item.key === '1');
  const rootCard = board.pool.find(item => item.key === '2');
  assert.ok(nestedCard);
  assert.ok(rootCard);
  assert.equal(nestedCard.checkout, nested);
  assert.equal(nestedCard.queue, 'alpha');
  assert.deepEqual(nestedCard.choices, ['', 'services/api']);
  assert.equal(rootCard.checkout, repo);
  assert.equal(rootCard.queue, 'alpha');
  assert.deepEqual(rootCard.choices, ['', 'services/api']);
  assert.equal(rootCard.reason, undefined);
  assert.equal(rootCard.icon, undefined);
  assert.deepEqual(board.cards, []);
  rmSync(dir, {recursive: true, force: true});
}

function proveAPathWithOrOutsideTheRootIsAMissingCatalog25(): void {
  const {dir, home, arcadia} = yard();
  const inside = path.join(arcadia, 'billing');
  mkdirSync(inside, {recursive: true});
  writeServiceConfig(inside, ['alpha']);
  writeLaunch(home, ['alpha'], {arcadia});
  const tickets = [
    ticket({key: '1', queue: 'alpha', sddService: '../outside'}),
    ticket({key: '2', queue: 'alpha', sddService: 'services/../billing'}),
  ];
  const window = openWindow({homePath: home, adapter: 'tracker'}, {tickets: () => tickets});
  const board = window.board();
  const broken = (key: string) => board.pool.find(item => item.key === key);
  assert.equal(broken('1')?.reason, 'каталога нет');
  assert.equal(broken('2')?.reason, 'каталога нет');
  assert.equal(
    board.cards.some(item => item.key === '1' || item.key === '2'),
    false,
  );
  assert.equal(existsSync(path.resolve(arcadia, '../outside')), false);
  assert.equal(existsSync(inside), true);
  rmSync(dir, {recursive: true, force: true});
}

function proveAnOverlayWatchNameJoinsTheHomeListAndARepeatedNameIsOne26(): void {
  const {dir, home, arcadia} = yard();
  const billing = path.join(arcadia, 'services', 'billing');
  const other = path.join(arcadia, 'services', 'other');
  mkdirSync(billing, {recursive: true});
  mkdirSync(other, {recursive: true});
  writeOverlay(billing, ['beta', 'alpha']);
  writeServiceConfig(billing, ['alpha']);
  writeServiceConfig(other, ['beta']);
  writeLaunch(home, ['alpha', 'alpha'], {arcadia});
  const tickets = [
    ticket({key: '1', queue: 'alpha', sddService: 'services/billing'}),
    ticket({key: '2', queue: 'beta', sddService: 'services/other'}),
  ];
  const window = openWindow({homePath: home, adapter: 'tracker'}, {tickets: () => tickets});
  const board = window.board();
  assert.deepEqual(board.watch, ['alpha', 'beta']);
  assert.deepEqual(
    board.pool.map(item => item.key),
    ['1', '2'],
  );
  assert.deepEqual(board.cards, []);
  rmSync(dir, {recursive: true, force: true});
}

function proveANameRemovedFromOneFileStaysWhileTheOtherFileStillHasIt27(): void {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeOverlay(checkout, ['alpha']);
  writeServiceConfig(checkout, ['alpha']);
  writeLaunch(home, ['alpha'], {arcadia});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})]},
  );
  assert.deepEqual(window.board().watch, ['alpha']);
  window.leaveWatch([]);
  assert.deepEqual(window.board().watch, ['alpha']);
  window.openCard('1');
  window.leaveOverlayWatch(['beta']);
  assert.deepEqual(window.board().watch, ['beta']);
  assert.deepEqual(readHome(path.join(checkout, '.aifactory', 'config.yaml')).watch, ['beta']);
  writeOverlay(checkout, []);
  assert.deepEqual(window.board().watch, []);
  assert.deepEqual(window.board().cards, []);
  rmSync(dir, {recursive: true, force: true});
}

function proveEmptyWatchListsLeaveTheBoardWithNoCards30(): void {
  const {dir, home, arcadia} = yard();
  writeLaunch(home, [], {arcadia});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})]},
  );
  const board = window.board();
  assert.deepEqual(board.watch, []);
  assert.deepEqual(board.cards, []);
  rmSync(dir, {recursive: true, force: true});
}

function proveServiceQueuesDoNotJoinTheWatchList31(): void {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeServiceConfig(checkout, ['alpha', 'gamma']);
  writeLaunch(home, ['alpha'], {arcadia});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      tickets: () => [
        ticket({key: '1', queue: 'alpha', sddService: 'services/billing'}),
        ticket({key: '2', queue: 'gamma', sddService: 'services/billing'}),
      ],
    },
  );
  const board = window.board();
  assert.deepEqual(board.watch, ['alpha']);
  assert.deepEqual(
    board.pool.map(item => item.key),
    ['1'],
  );
  assert.deepEqual(board.cards, []);
  rmSync(dir, {recursive: true, force: true});
}

function proveATrackerTicketIsSelectedByThePortQueueAndALabelDoesNotReplaceIt32(): void {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeServiceConfig(checkout, ['alpha', 'beta']);
  writeLaunch(home, ['beta', 'alpha'], {arcadia});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      tickets: () => [
        ticket({
          key: '1',
          queue: 'alpha',
          labels: ['beta', 'sdd:cycle'],
          sddService: 'services/billing',
        }),
        ticket({
          key: '2',
          queue: 'beta',
          labels: ['alpha', 'sdd:cycle'],
          sddService: 'services/billing',
        }),
      ],
    },
  );
  const board = window.board();
  const alpha = board.pool.find(item => item.key === '1');
  const beta = board.pool.find(item => item.key === '2');
  assert.ok(alpha);
  assert.ok(beta);
  assert.equal(alpha.queue, 'alpha');
  assert.equal(alpha.checkout, checkout);
  assert.deepEqual(alpha.choices, ['services/billing']);
  assert.equal(beta.queue, 'beta');
  assert.equal(beta.checkout, checkout);
  assert.deepEqual(beta.choices, ['services/billing']);
  assert.deepEqual(board.cards, []);
  rmSync(dir, {recursive: true, force: true});
}

function proveAGithubQueueIsTheFirstSddQueuesNameOnTheIssueAndTheKeyIsOwnerRepo33(): void {
  const {dir, home, github} = yard();
  const repo = path.join(github, 'acme', 'billing');
  mkdirSync(repo, {recursive: true});
  writeServiceConfig(repo, ['alpha', 'beta']);
  writeLaunch(home, ['beta', 'acme/billing'], {github});
  const window = openWindow(
    {homePath: home, adapter: 'github'},
    {
      tickets: () => [
        ticket({
          key: '1',
          repo: 'acme/billing',
          sddService: '',
          labels: ['beta', 'alpha', 'sdd:cycle'],
        }),
        ticket({
          key: '2',
          repo: 'other/billing',
          sddService: '',
          labels: ['alpha', 'sdd:cycle'],
        }),
        ticket({
          key: '3',
          repo: 'acme/billing',
          sddService: '',
          labels: ['sdd:cycle'],
        }),
      ],
    },
  );
  const board = window.board();
  const matched = board.pool.find(item => item.key === '1');
  const missing = board.pool.find(item => item.key === '3');
  assert.ok(matched);
  assert.equal(matched.queue, 'alpha');
  assert.equal(matched.checkout, repo);
  assert.deepEqual(matched.choices, ['']);
  assert.equal(
    board.pool.some(item => item.key === '2'),
    false,
  );
  assert.equal(
    board.cards.some(item => item.key === '2'),
    false,
  );
  assert.ok(missing);
  assert.equal(missing.queue, '');
  assert.equal(missing.checkout, repo);
  assert.deepEqual(missing.choices, ['']);
  assert.equal(missing.reason, 'очереди нет в конфиге сервиса');
  assert.equal(missing.takeDisabled, true);
  rmSync(dir, {recursive: true, force: true});
}

function proveTheFirstCheckoutBreakIsTheOnlyReasonAndTakeDoesNotWriteTheAssignee35(): void {
  const {dir, home, arcadia} = yard();
  const bare = path.join(arcadia, 'services', 'bare');
  const other = path.join(arcadia, 'services', 'other');
  mkdirSync(bare, {recursive: true});
  mkdirSync(other, {recursive: true});
  writeServiceConfig(other, ['elsewhere']);
  writeLaunch(home, ['alpha'], {arcadia});
  let assignees = 0;
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      answers: () => true,
      writeAssignee: () => {
        assignees += 1;
      },
      tickets: () => [
        ticket({key: '1', queue: 'alpha', sddService: 'services/missing'}),
        ticket({key: '2', queue: 'alpha', sddService: ''}),
        ticket({key: '3', queue: 'alpha'}),
        ticket({key: '4', queue: 'alpha', sddService: 'services/bare'}),
        ticket({key: '5', queue: 'alpha', sddService: 'services/other'}),
      ],
    },
  );
  window.chooseAgent('cursor');
  const board = window.board();
  const reason = (key: string) => board.pool.find(item => item.key === key);
  assert.equal(reason('1')?.reason, 'каталога нет');
  assert.equal(reason('1')?.reason?.startsWith('конфига сервиса нет'), false);
  assert.equal(reason('2')?.reason, 'не назван сервис');
  assert.equal(reason('3')?.reason, 'не назван сервис');
  assert.equal(reason('4')?.reason, 'конфига сервиса нет');
  assert.equal(reason('5')?.reason, 'очереди нет в конфиге сервиса');
  assert.deepEqual(board.cards, []);
  for (const card of board.pool) {
    assert.equal(card.takeDisabled, true);
    window.take(card.key);
  }
  assert.equal(assignees, 0);
  assert.equal(window.board().takeDisabled, false);
  rmSync(dir, {recursive: true, force: true});
}

function proveAMissingCatalogKeepsTheCardAndTheChoiceAndDoesNotStartAStep36(): void {
  const {dir, home, arcadia} = yard();
  const billing = path.join(arcadia, 'services', 'billing');
  mkdirSync(billing, {recursive: true});
  writeServiceConfig(billing, ['alpha', 'beta']);
  writeLaunch(home, ['alpha', 'beta'], {arcadia});
  let started = 0;
  let assignees = 0;
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      answers: () => true,
      startStep: () => {
        started += 1;
      },
      writeAssignee: () => {
        assignees += 1;
      },
      tickets: () => [
        ticket({key: '1', queue: 'alpha', sddService: 'services/billing'}),
        ticket({key: '2', queue: 'beta', sddService: 'services/gone'}),
      ],
    },
  );
  window.chooseAgent('cursor');
  const board = window.board();
  const gone = board.pool.find(item => item.key === '2');
  assert.ok(gone);
  assert.equal(gone.checkout, path.join(arcadia, 'services', 'gone'));
  assert.equal(gone.queue, 'beta');
  assert.equal(gone.reason, 'каталога нет');
  assert.deepEqual(gone.choices, ['services/billing']);
  assert.equal(
    board.cards.some(item => item.key === '2'),
    false,
  );
  assert.equal(existsSync(path.join(arcadia, 'services', 'gone')), false);
  window.take('2');
  window.spy();
  assert.equal(assignees, 0);
  assert.equal(started, 1);
  rmSync(dir, {recursive: true, force: true});
}

function proveOneTrackerServiceThatAlreadyListsTheQueueWritesItself37(): void {
  const {dir, home, arcadia} = yard();
  const billing = path.join(arcadia, 'services', 'billing');
  const other = path.join(arcadia, 'services', 'other');
  mkdirSync(billing, {recursive: true});
  mkdirSync(other, {recursive: true});
  writeServiceConfig(billing, ['alpha']);
  writeServiceConfig(other, ['beta']);
  writeLaunch(home, ['alpha'], {arcadia});
  const tickets = [
    ticket({key: '1', queue: 'alpha', sddService: 'services/billing'}),
    ticket({key: '2', queue: 'alpha', sddService: 'services/other'}),
    ticket({key: '3', queue: 'alpha'}),
  ];
  const writes: {key: string; service: string}[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
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
  const board = window.board();
  const card = board.pool.find(item => item.key === '3');
  assert.ok(card);
  assert.deepEqual(writes, [{key: '3', service: 'services/billing'}]);
  assert.equal(card.checkout, billing);
  assert.equal(card.queue, 'alpha');
  assert.deepEqual(card.choices, ['services/billing']);
  assert.equal(card.reason, undefined);
  assert.equal(card.icon, undefined);
  assert.equal(
    board.cards.some(item => item.key === '3'),
    false,
  );
  rmSync(dir, {recursive: true, force: true});
}

function proveABlankTrackerSddServiceWritesTheSingleServiceThatListsTheQueue38(): void {
  const {dir, home, arcadia} = yard();
  const billing = path.join(arcadia, 'services', 'billing');
  mkdirSync(billing, {recursive: true});
  writeServiceConfig(billing, ['alpha']);
  writeLaunch(home, ['alpha'], {arcadia});
  const tickets = [
    ticket({key: '1', queue: 'alpha', sddService: 'services/billing'}),
    ticket({key: '2', queue: 'alpha', sddService: ''}),
  ];
  const writes: {key: string; service: string}[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
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
  const board = window.board();
  const card = board.pool.find(item => item.key === '2');
  assert.ok(card);
  assert.deepEqual(writes, [{key: '2', service: 'services/billing'}]);
  assert.equal(card.checkout, billing);
  assert.equal(card.queue, 'alpha');
  assert.deepEqual(card.choices, ['services/billing']);
  assert.equal(card.reason, undefined);
  assert.equal(card.icon, undefined);
  assert.equal(
    board.cards.some(item => item.key === '2'),
    false,
  );
  rmSync(dir, {recursive: true, force: true});
}

function proveSeveralTrackerServicesThatListTheQueueStayAChoice39(): void {
  const {dir, home, arcadia} = yard();
  const billing = path.join(arcadia, 'services', 'billing');
  const other = path.join(arcadia, 'services', 'other');
  mkdirSync(billing, {recursive: true});
  mkdirSync(other, {recursive: true});
  writeServiceConfig(billing, ['alpha']);
  writeServiceConfig(other, ['alpha']);
  writeLaunch(home, ['alpha'], {arcadia});
  let assignees = 0;
  const tickets = [
    ticket({key: '1', queue: 'alpha', sddService: 'services/billing'}),
    ticket({key: '2', queue: 'alpha', sddService: 'services/other'}),
    ticket({key: '3', queue: 'alpha'}),
  ];
  const writes: {key: string; service: string}[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      answers: () => true,
      tickets: () => tickets,
      writeService: (key, service) => {
        writes.push({key, service});
        const found = tickets.find(item => item.key === key);
        if (found) {
          found.sddService = service;
        }
      },
      writeAssignee: () => {
        assignees += 1;
      },
    },
  );
  const board = window.board();
  const card = board.pool.find(item => item.key === '3');
  assert.ok(card);
  assert.equal(card.checkout, undefined);
  assert.equal(card.queue, 'alpha');
  assert.deepEqual(card.choices, ['services/billing', 'services/other']);
  assert.equal(card.reason, 'не назван сервис');
  assert.equal(card.takeDisabled, true);
  assert.equal(
    board.cards.some(item => item.key === '3'),
    false,
  );
  assert.equal(
    writes.some(item => item.key === '3'),
    false,
  );
  window.take('3');
  assert.equal(assignees, 0);
  rmSync(dir, {recursive: true, force: true});
}

function proveOneGithubDirectoryWithAnSddKeyWritesItselfAndSeveralStayAChoice40(): void {
  const {dir, home, github} = yard();
  const alone = path.join(github, 'acme', 'alone');
  const many = path.join(github, 'acme', 'many');
  const api = path.join(many, 'services', 'api');
  mkdirSync(alone, {recursive: true});
  mkdirSync(api, {recursive: true});
  writeServiceConfig(alone, ['alpha']);
  writeServiceConfig(many, ['alpha']);
  writeServiceConfig(api, ['alpha']);
  writeFileSync(path.join(alone, 'openspec', 'skip.yaml'), ':\n');
  const broken = path.join(github, 'acme', 'broken');
  mkdirSync(path.join(broken, 'openspec'), {recursive: true});
  writeFileSync(path.join(broken, 'openspec', 'config.yaml'), ':\n');
  writeLaunch(home, ['acme/alone', 'acme/many', 'acme/broken'], {github});
  const tickets = [
    ticket({key: '1', repo: 'acme/alone', labels: ['alpha', 'sdd:cycle']}),
    ticket({key: '2', repo: 'acme/many', labels: ['alpha', 'sdd:cycle']}),
    ticket({key: '3', repo: 'acme/broken', labels: ['alpha', 'sdd:cycle']}),
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
  const board = window.board();
  assert.deepEqual(writes, [{key: '1', service: ''}]);
  const written = board.pool.find(item => item.key === '1');
  assert.ok(written);
  assert.equal(written.checkout, alone);
  assert.equal(written.queue, 'alpha');
  assert.deepEqual(written.choices, ['']);
  assert.equal(written.reason, undefined);
  assert.equal(written.icon, undefined);
  assert.equal(
    board.cards.some(item => item.key === '1'),
    false,
  );
  const choice = board.pool.find(item => item.key === '2');
  assert.ok(choice);
  assert.equal(choice.checkout, undefined);
  assert.equal(choice.queue, '');
  assert.deepEqual(choice.choices, ['', 'services/api']);
  assert.equal(choice.reason, 'не назван сервис');
  assert.equal(
    writes.some(item => item.key === '2'),
    false,
  );
  const unreadable = board.pool.find(item => item.key === '3');
  assert.ok(unreadable);
  assert.equal(unreadable.checkout, undefined);
  assert.equal(unreadable.queue, '');
  assert.deepEqual(unreadable.choices, []);
  assert.equal(unreadable.reason, 'не назван сервис');
  assert.deepEqual(board.cards, []);
  rmSync(dir, {recursive: true, force: true});
}

function proveWritingSddServiceKeepsTheQueueBreakWhenTheServiceStillLacksTheQueue41(): void {
  const {dir, home, github} = yard();
  const repo = path.join(github, 'acme', 'billing');
  const api = path.join(repo, 'services', 'api');
  const other = path.join(repo, 'services', 'other');
  mkdirSync(api, {recursive: true});
  mkdirSync(other, {recursive: true});
  writeServiceConfig(api, ['alpha']);
  writeServiceConfig(other, ['beta']);
  writeLaunch(home, ['acme/billing'], {github});
  const tickets = [ticket({key: '1', repo: 'acme/billing', labels: ['alpha', 'sdd:cycle']})];
  const window = openWindow(
    {homePath: home, adapter: 'github'},
    {
      tickets: () => tickets,
      writeService: (key, service) => {
        const found = tickets.find(item => item.key === key);
        if (found) {
          found.sddService = service;
        }
      },
    },
  );
  assert.equal(window.board().pool[0]?.reason, 'не назван сервис');
  assert.deepEqual(window.board().cards, []);
  window.chooseService('1', 'services/other');
  const card = window.board().pool.find(item => item.key === '1');
  assert.ok(card);
  assert.equal(card.reason, 'очереди нет в конфиге сервиса');
  assert.equal(card.takeDisabled, true);
  assert.equal(tickets[0].sddService, 'services/other');
  rmSync(dir, {recursive: true, force: true});
}

function proveTheBoardAndTheWindowSpyReadOneWatchList44(): void {
  const {dir, home, arcadia} = yard();
  const billing = path.join(arcadia, 'services', 'billing');
  const other = path.join(arcadia, 'services', 'other');
  mkdirSync(billing, {recursive: true});
  mkdirSync(other, {recursive: true});
  writeServiceConfig(billing, ['alpha']);
  writeServiceConfig(other, ['beta']);
  writeLaunch(home, ['alpha'], {arcadia});
  const started: string[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      answers: () => true,
      login: () => MANAGER,
      startStep: value => {
        started.push(value ?? '');
      },
      tickets: () => [
        ticket({key: '1', queue: 'alpha', sddService: 'services/billing'}),
        ticket({key: '2', queue: 'beta', sddService: 'services/other'}),
        cycle('3', 'implementing'),
        cycle('4', 'implementing', {queue: 'beta', sddService: 'services/other'}),
      ],
    },
  );
  window.chooseAgent('cursor');
  const board = window.board();
  assert.deepEqual(board.watch, ['alpha']);
  assert.deepEqual(
    board.pool.map(item => item.key),
    ['1'],
  );
  assert.deepEqual(board.cards, []);
  assert.deepEqual(
    columnCards(board, 'implementing')?.map(card => card.key),
    ['3'],
  );
  const shown = [
    ...board.pool.map(card => card.key),
    ...(board.columns ?? []).flatMap(column => column.cards.map(card => card.key)),
  ];
  assert.equal(shown.includes('2'), false);
  assert.equal(shown.includes('4'), false);
  window.spy();
  assert.deepEqual(started, [billing]);
  rmSync(dir, {recursive: true, force: true});
}

spec('watch-list', () => {
  requirement("The board and the window's spy read one watch list", () => {
    scenario('The pool and the columns share the list', () => {
      proveTheBoardAndTheWindowSpyReadOneWatchList44();
    });
    scenario("The machine's spy ignores a bare cycle label", async () => {
      await proveTheMachineSpyLeavesABareCycleOutAndDoesNotReadAifactory45();
    });
  });
  requirement('Each read rebuilds the list from the files', () => {
    scenario('An overlay name joins the home list', () => {
      proveAnOverlayWatchNameJoinsTheHomeListAndARepeatedNameIsOne26();
    });
    scenario('A name on either file remains', () => {
      proveANameRemovedFromOneFileStaysWhileTheOtherFileStillHasIt27();
    });
    scenario('Both lists empty means no cards', () => {
      proveEmptyWatchListsLeaveTheBoardWithNoCards30();
    });
    scenario('Service queues do not join the list', () => {
      proveServiceQueuesDoNotJoinTheWatchList31();
    });
  });
  requirement('A Tracker queue is the port field', () => {
    scenario('The port field selects the cycle', () => {
      proveATrackerTicketIsSelectedByThePortQueueAndALabelDoesNotReplaceIt32();
    });
    scenario('A queue missing from the service config blocks Take', () => {
      proveTheFirstCheckoutBreakIsTheOnlyReasonAndTakeDoesNotWriteTheAssignee35();
    });
  });
  requirement('A GitHub queue is a label in sdd.queues', () => {
    scenario('The first matching queue name wins', () => {
      proveAGithubQueueIsTheFirstSddQueuesNameOnTheIssueAndTheKeyIsOwnerRepo33();
    });
    scenario('No matching label is a break', () => {
      proveAGithubQueueIsTheFirstSddQueuesNameOnTheIssueAndTheKeyIsOwnerRepo33();
    });
  });
  requirement('A checkout is gathered from sddService', () => {
    scenario('Tracker gathers under the Arcadia root', () => {
      proveTrackerGathersTheCheckoutUnderTheArcadiaRoot23();
    });
    scenario('An empty root keeps the default', () => {
      proveAnEmptyRootLeavesArcadiaOrGithub21();
    });
    scenario('GitHub empty sddService is the repository root', () => {
      proveGithubGathersUnderTheRepositoryAndAnEmptySddServiceIsThatRoot24();
    });
    scenario('A path outside the root is a missing catalog', () => {
      proveAPathWithOrOutsideTheRootIsAMissingCatalog25();
    });
  });
  requirement('A missing field offers a choice', () => {
    scenario('One Tracker service writes itself', () => {
      proveOneTrackerServiceThatAlreadyListsTheQueueWritesItself37();
      proveABlankTrackerSddServiceWritesTheSingleServiceThatListsTheQueue38();
    });
    scenario('Several Tracker services stay a choice', () => {
      proveSeveralTrackerServicesThatListTheQueueStayAChoice39();
    });
    scenario('One GitHub directory writes itself', () => {
      proveOneGithubDirectoryWithAnSddKeyWritesItselfAndSeveralStayAChoice40();
    });
    scenario('A queue that is still missing keeps the reason', () => {
      proveWritingSddServiceKeepsTheQueueBreakWhenTheServiceStillLacksTheQueue41();
    });
  });
  requirement('A missing catalog keeps the cycle card', () => {
    scenario('A missing directory leaves the card', () => {
      proveAMissingCatalogKeepsTheCardAndTheChoiceAndDoesNotStartAStep36();
    });
  });
});
