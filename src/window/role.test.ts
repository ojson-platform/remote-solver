import assert from 'node:assert/strict';
import {
  existsSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import {requirement, scenario, spec} from '@ojson/spec-coverage';
import {parse} from 'yaml';
import {openWindow} from './window.ts';
import {
  MANAGER,
  columnCards,
  cycle,
  homeRoles,
  prepare,
  readHome,
  readServiceYaml,
  scratch,
  ticket,
  yard,
} from './window.harness.ts';
import {articleOf, bandOf, held, hosted, pageHtml, post} from './page.harness.ts';

function proveTheShelfShowsTheOutcomeBeforeTheDrag(): void {
  const {dir, home, arcadia} = yard();
  const other = scratch();
  prepare(arcadia, home);
  writeFileSync(
    home,
    [
      'watch:',
      '  - alpha',
      'roots:',
      `  arcadia: ${arcadia}`,
      'roles:',
      '  - name: Page',
      '    outcome: html',
      '    text: <p>hello</p>',
      '',
    ].join('\n'),
  );
  writeFileSync(
    other.home,
    ['roles:', '  - name: Note', '    outcome: pull-comment', '    text: hi', ''].join('\n'),
  );
  const window = openWindow({homePath: home, adapter: 'tracker'});
  const theirs = openWindow({homePath: other.home});
  assert.deepEqual(window.shelf(), [{name: 'Page', outcome: 'html'}]);
  assert.deepEqual(theirs.shelf(), [{name: 'Note', outcome: 'pull-comment'}]);
  const service = readServiceYaml(
    path.join(arcadia, 'services', 'billing', 'openspec', 'config.yaml'),
  );
  assert.equal('roles' in service, false);
  rmSync(dir, {recursive: true, force: true});
  rmSync(other.dir, {recursive: true, force: true});
}

function proveRemovingARoleWritesTheHomeConfig(): void {
  const {dir, home} = scratch();
  writeFileSync(
    home,
    [
      'watch:',
      '  - alpha',
      'roles:',
      '  - name: Page',
      '    outcome: html',
      '    text: <p>hi</p>',
      '  - name: Note',
      '    outcome: pull-comment',
      '    text: hi',
      '',
    ].join('\n'),
  );
  const window = openWindow({homePath: home});
  window.removeRole('Page');
  assert.deepEqual(
    homeRoles(home).map(role => role.name),
    ['Note'],
  );
  assert.deepEqual(readHome(home).watch, ['alpha']);
  assert.deepEqual(window.shelf(), [{name: 'Note', outcome: 'pull-comment'}]);
  rmSync(dir, {recursive: true, force: true});
}

function proveTicketFieldsStoresTheLabels(): void {
  const {dir, home} = scratch();
  writeFileSync(home, 'watch:\n  - alpha\n');
  const window = openWindow({homePath: home});
  window.addRole({
    name: 'Plan',
    outcome: 'ticket-fields',
    text: 'note',
    labels: ['sdd:auto-plan', 'sdd:auto-merge'],
  });
  const [role] = homeRoles(home);
  assert.equal(role?.outcome, 'ticket-fields');
  assert.ok(role?.labels?.includes('sdd:auto-plan'));
  assert.equal(role?.labels?.includes('sdd:auto-merge'), false);
  rmSync(dir, {recursive: true, force: true});
}

function proveADragDoesNotMoveThePhase(): void {
  const {dir, home, arcadia} = yard();
  const checkout = prepare(arcadia, home);
  const config = path.join(checkout, 'openspec', 'config.yaml');
  const before = readFileSync(config, 'utf8');
  const item = cycle('1', 'implementing');
  let phases = 0;
  let assignees = 0;
  let started = 0;
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => [item],
      writePhase: () => {
        phases += 1;
      },
      writeAssignee: () => {
        assignees += 1;
      },
      startStep: () => {
        started += 1;
      },
    },
  );
  window.addRole({name: 'Page', outcome: 'html', text: '<p>stay</p>'});
  assert.deepEqual(window.drag('Page', '1'), {popup: '<p>stay</p>'});
  assert.deepEqual(item.labels, ['sdd:cycle', 'sdd:implementing']);
  assert.equal(item.assignee, MANAGER);
  assert.equal(phases, 0);
  assert.equal(assignees, 0);
  assert.equal(started, 0);
  assert.equal(readFileSync(config, 'utf8'), before);
  assert.equal('role' in item, false);
  assert.equal(columnCards(window.board(), 'implementing')?.[0]?.key, '1');
  rmSync(dir, {recursive: true, force: true});
}

function proveAnEmptyModelStillRunsTheRole(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const item = ticket({
    key: '1',
    queue: 'alpha',
    sddService: 'services/billing',
    assignee: '',
    labels: ['sdd:cycle'],
  });
  let started = 0;
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      answers: () => false,
      startStep: () => {
        started += 1;
      },
      tickets: () => [item],
    },
  );
  window.chooseAgent('cursor');
  window.leaveModel('judgment', '');
  window.addRole({name: 'Page', outcome: 'html', text: 'shown'});
  const card = window.board().pool.find(entry => entry.key === '1');
  assert.ok(card);
  assert.equal(card.takeDisabled, true);
  assert.equal(window.board().stepsStart, false);
  assert.deepEqual(window.drag('Page', '1'), {popup: 'shown'});
  assert.equal(started, 0);
  assert.equal(item.assignee, '');
  rmSync(dir, {recursive: true, force: true});
}

function proveTheSpyDoesNotStartARole(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const item = cycle('1', 'implementing');
  let labels = 0;
  let hooks = 0;
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      answers: () => true,
      tickets: () => [item],
      editLabels: () => {
        labels += 1;
      },
      writeHooks: () => {
        hooks += 1;
      },
    },
  );
  window.chooseAgent('cursor');
  window.addRole({
    name: 'Spec',
    outcome: 'ticket-fields',
    text: 'just a note',
    labels: ['sdd:auto-spec'],
  });
  window.drag('Spec', '1');
  assert.equal(labels, 1);
  assert.equal(hooks, 0);
  window.spy();
  assert.equal(labels, 1);
  assert.equal(hooks, 0);
  rmSync(dir, {recursive: true, force: true});
}

function proveNamedLabelsAreSet(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const item = cycle('1', 'implementing');
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => [item],
      editLabels: (_key, add) => {
        item.labels = [...item.labels, ...add];
      },
    },
  );
  window.addRole({
    name: 'Spec',
    outcome: 'ticket-fields',
    text: 'just a note',
    labels: ['sdd:auto-spec', 'sdd:auto-merge'],
  });
  window.drag('Spec', '1');
  assert.ok(item.labels.includes('sdd:auto-spec'));
  assert.equal(item.labels.includes('sdd:auto-merge'), false);
  assert.ok(item.labels.includes('sdd:implementing'));
  assert.equal(item.assignee, MANAGER);
  rmSync(dir, {recursive: true, force: true});
}

function proveAPointMapReplacesSddHooks(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const text = 'archive:\n  before: keep the cycle\n';
  const item = cycle('1', 'implementing', {sddHooks: {'create-proposal': {after: 'old'}}});
  let written = '';
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => [item],
      writeHooks: (_key, next) => {
        written = next;
        item.sddHooks = parse(next);
      },
    },
  );
  window.addRole({name: 'Hooks', outcome: 'ticket-fields', text, labels: ['sdd:auto-plan']});
  window.openCard('1');
  window.drag('Hooks', '1');
  assert.equal(written, text);
  assert.deepEqual(window.sidebar(), [
    {kind: 'hook', points: [{action: 'archive', point: 'before', paragraph: 'keep the cycle'}]},
  ]);
  rmSync(dir, {recursive: true, force: true});
}

function proveProseLeavesSddHooks(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const item = cycle('1', 'implementing', {sddHooks: {archive: {before: 'old'}}});
  let hooks = 0;
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => [item],
      editLabels: (_key, add) => {
        item.labels = [...item.labels, ...add];
      },
      writeHooks: () => {
        hooks += 1;
      },
    },
  );
  window.addRole({
    name: 'Spec',
    outcome: 'ticket-fields',
    text: 'just a note',
    labels: ['sdd:auto-spec'],
  });
  window.openCard('1');
  window.drag('Spec', '1');
  assert.equal(hooks, 0);
  assert.deepEqual(item.sddHooks, {archive: {before: 'old'}});
  assert.ok(item.labels.includes('sdd:auto-spec'));
  assert.deepEqual(window.sidebar(), [
    {kind: 'hook', points: [{action: 'archive', point: 'before', paragraph: 'old'}]},
  ]);
  rmSync(dir, {recursive: true, force: true});
}

function proveOnePullRequestReceivesTheText(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const item = cycle('1', 'implementing', {openPullRequests: 1});
  const comments: string[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => [item],
      commentPull: (_key, body) => {
        comments.push(body);
      },
    },
  );
  window.addRole({name: 'Note', outcome: 'pull-comment', text: 'ship it'});
  window.drag('Note', '1');
  assert.deepEqual(comments, ['ship it']);
  rmSync(dir, {recursive: true, force: true});
}

function proveZeroPullRequestsSetNoIcon(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const item = cycle('1', 'implementing', {openPullRequests: 0});
  const comments: string[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => [item],
      commentPull: (_key, body) => {
        comments.push(body);
      },
    },
  );
  window.addRole({name: 'Note', outcome: 'pull-comment', text: 'ship it'});
  const before = columnCards(window.board(), 'implementing')?.[0];
  assert.equal(before?.icon, undefined);
  assert.deepEqual(window.drag('Note', '1'), {status: 'комментарий не записан'});
  const after = columnCards(window.board(), 'implementing')?.[0];
  assert.equal(after?.icon, undefined);
  assert.deepEqual(comments, []);
  rmSync(dir, {recursive: true, force: true});
}

function proveHtmlStaysOffTheIssue(): void {
  const {dir, home, arcadia} = yard();
  prepare(arcadia, home);
  const item = cycle('1', 'implementing', {comments: [{body: 'already'}]});
  const comments: string[] = [];
  let hooks = 0;
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => [item],
      commentPull: (_key, body) => {
        comments.push(body);
      },
      writeHooks: () => {
        hooks += 1;
      },
    },
  );
  window.addRole({name: 'Page', outcome: 'html', text: '<p>hello</p>'});
  assert.deepEqual(window.drag('Page', '1'), {popup: '<p>hello</p>'});
  assert.deepEqual(comments, []);
  assert.equal(hooks, 0);
  assert.deepEqual(item.comments, [{body: 'already'}]);
  rmSync(dir, {recursive: true, force: true});
}

function proveAMissingCycleFileSavesNothing(): void {
  const {dir, home, arcadia} = yard();
  const checkout = prepare(arcadia, home);
  const item = cycle('1', 'implementing');
  let started = 0;
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      tickets: () => [item],
      startStep: () => {
        started += 1;
      },
    },
  );
  window.addRole({name: 'File', outcome: 'cycle-file', text: 'notes.md'});
  const missing = path.join(checkout, 'notes.md');
  assert.deepEqual(window.drag('File', '1'), {popup: 'файла нет'});
  assert.equal(existsSync(missing), false);
  assert.equal(started, 0);
  writeFileSync(missing, 'body\n');
  assert.deepEqual(window.drag('File', '1'), {popup: 'body\n'});
  assert.equal(readFileSync(missing, 'utf8'), 'body\n');
  assert.equal(started, 0);
  rmSync(dir, {recursive: true, force: true});
}

spec('role', () => {
  requirement("Verbs list this manager's roles", () => {
    scenario('The shelf shows the outcome before the drag', () => {
      proveTheShelfShowsTheOutcomeBeforeTheDrag();
    });
    scenario('Removing a role writes the home config', () => {
      proveRemovingARoleWritesTheHomeConfig();
    });
  });
  requirement('A role record is a name, one outcome, and its text', () => {
    scenario('Ticket-fields stores the labels', () => {
      proveTicketFieldsStoresTheLabels();
    });
  });
  requirement('The window runs one press and does not keep the role', () => {
    scenario('A drag does not move the phase', () => {
      proveADragDoesNotMoveThePhase();
    });
    scenario('An empty model still runs the role', () => {
      proveAnEmptyModelStillRunsTheRole();
    });
    scenario('The spy does not start a role', () => {
      proveTheSpyDoesNotStartARole();
    });
  });
  requirement('Ticket-fields sets the named labels and may replace sddHooks', () => {
    scenario('Named labels are set', () => {
      proveNamedLabelsAreSet();
    });
    scenario('A point map replaces sddHooks', () => {
      proveAPointMapReplacesSddHooks();
    });
    scenario('Prose leaves sddHooks', () => {
      proveProseLeavesSddHooks();
    });
  });
  requirement('A pull comment needs exactly one open pull request', () => {
    scenario('One pull request receives the text', () => {
      proveOnePullRequestReceivesTheText();
    });
    scenario('Zero pull requests set no icon', () => {
      proveZeroPullRequestsSetNoIcon();
    });
  });
  requirement('HTML opens and is not written on the cycle', () => {
    scenario('HTML stays off the issue', () => {
      proveHtmlStaysOffTheIssue();
    });
  });
  requirement("A cycle file opens from the card's checkout", () => {
    scenario('A missing cycle file saves nothing', () => {
      proveAMissingCycleFileSavesNothing();
    });
  });
});

spec('role', () => {
  requirement("Verbs list this manager's roles", () => {
    scenario('A closed row has no verbs', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'proposing'), held('2', 'specifying')],
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          window.addRole({name: 'Page', outcome: 'html', text: '<p>страница</p>'});
          const closed = await pageHtml(page.url);
          assert.equal(articleOf(closed, '1').includes('class="verb"'), false);
          assert.equal(articleOf(closed, '2').includes('class="verb"'), false);
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const html = await pageHtml(page.url);
          const verb = bandOf(html, '1');
          assert.match(verb, /Page/);
          assert.match(verb, /html/);
          assert.equal(articleOf(html, '2').includes('class="verb"'), false);
          assert.equal(articleOf(html, '2').includes('class="band"'), false);
        },
      );
    });
  });
});
