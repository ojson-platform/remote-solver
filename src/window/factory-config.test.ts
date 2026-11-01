import assert from 'node:assert/strict';
import {mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {openWindow} from './window.ts';
import {
  MANAGER,
  assertNoEmptyStrings,
  cycle,
  proveACatalogThatRejectsTheRecordedJudgmentIdKeepsItAndStopsTheStep95,
  proveChoosingCursorWritesItsPairAndOmitsEffortAndSpeed2,
  proveTheMachineSpyLeavesABareCycleOutAndDoesNotReadAifactory45,
  readHome,
  scratch,
  ticket,
  writeLaunch,
  writeOverlay,
  writeServiceConfig,
  yard,
} from './window.harness.ts';

function proveChoosingCodexWritesItsPairAndEffortAndOmitsSpeed3(): void {
  const {dir, home} = scratch();
  const window = openWindow({homePath: home});
  window.chooseAgent('codex');
  const doc = readHome(home);
  assert.equal(doc.agent, 'codex');
  assert.equal(doc.models?.mechanical, 'gpt-6-luna');
  assert.equal(doc.models?.judgment, 'gpt-6.1-sol');
  assert.deepEqual(doc.effort, {mechanical: 'low', judgment: 'high'});
  assert.equal(doc.speed, undefined);
  assertNoEmptyStrings(doc);
  assert.deepEqual(window.settings().effort, {mechanical: 'low', judgment: 'high'});
  assert.deepEqual(window.settings().speed, {mechanical: '', judgment: ''});
  rmSync(dir, {recursive: true, force: true});
}

function proveChoosingClaudeCodeWritesItsPairAndEffortAndOmitsSpeed4(): void {
  const {dir, home} = scratch();
  const window = openWindow({homePath: home});
  window.chooseAgent('claude-code');
  const doc = readHome(home);
  assert.equal(doc.agent, 'claude-code');
  assert.equal(doc.models?.mechanical, 'sonnet');
  assert.equal(doc.models?.judgment, 'opus');
  assert.deepEqual(doc.effort, {mechanical: 'medium', judgment: 'medium'});
  assert.equal(doc.speed, undefined);
  assert.equal(window.settings().speed, undefined);
  assertNoEmptyStrings(doc);
  rmSync(dir, {recursive: true, force: true});
}

function proveChoosingOpencodeWritesItsPairAndOmitsEffortAndSpeed5(): void {
  const {dir, home} = scratch();
  const window = openWindow({homePath: home});
  window.chooseAgent('opencode');
  const doc = readHome(home);
  assert.equal(doc.agent, 'opencode');
  assert.equal(doc.models?.mechanical, 'moonshotai/kimi-k2.7-code');
  assert.equal(doc.models?.judgment, 'moonshotai/kimi-k3');
  assert.equal(doc.effort, undefined);
  assert.equal(doc.speed, undefined);
  assert.equal(window.settings().effort, undefined);
  assert.equal(window.settings().speed, undefined);
  assertNoEmptyStrings(doc);
  rmSync(dir, {recursive: true, force: true});
}

function proveNoHomePathWritesNoFileWhenTheManagerChoosesAnAgent8(): void {
  let started = 0;
  const window = openWindow(
    {},
    {
      startStep: () => {
        started += 1;
      },
      catalog: () => {
        throw new Error('catalog');
      },
    },
  );
  window.chooseAgent('cursor');
  window.spy();
  assert.equal(started, 0);
  assert.deepEqual(window.board().rows, [{text: 'фабрике ещё нужен агент'}]);
  assert.equal(window.settings().agent, '');
  assert.equal(window.board().takeDisabled, true);
}

function proveEmptyEffortAndSpeedAreTheAgentDefaultAndDoNotStopAStep12(): void {
  const {dir, home} = scratch();
  let started = 0;
  const window = openWindow(
    {homePath: home},
    {
      answers: () => true,
      startStep: () => {
        started += 1;
      },
    },
  );
  window.chooseAgent('codex');
  window.leaveEffort('mechanical', '');
  window.leaveEffort('judgment', '');
  window.leaveSpeed('mechanical', '');
  window.leaveSpeed('judgment', '');
  const doc = readHome(home);
  assert.equal(doc.agent, 'codex');
  assert.equal(doc.models?.mechanical, 'gpt-6-luna');
  assert.equal(doc.models?.judgment, 'gpt-6.1-sol');
  assert.equal(doc.effort, undefined);
  assert.equal(doc.speed, undefined);
  assert.deepEqual(window.settings().effort, {mechanical: 'low', judgment: 'high'});
  assert.deepEqual(window.settings().speed, {mechanical: '', judgment: ''});
  assert.deepEqual(window.settings().effortWords, ['low', 'medium', 'high', 'xhigh', 'max']);
  assert.deepEqual(window.settings().speedWords, ['fast']);
  window.leaveEffort('mechanical', 'turbo');
  window.leaveSpeed('mechanical', 'slow');
  assert.equal(readHome(home).effort, undefined);
  assert.equal(readHome(home).speed, undefined);
  window.leaveEffort('mechanical', 'max');
  window.leaveSpeed('mechanical', 'fast');
  assert.equal(readHome(home).effort?.mechanical, 'max');
  assert.equal(readHome(home).speed?.mechanical, 'fast');
  window.leaveEffort('mechanical', '');
  window.leaveSpeed('mechanical', '');
  window.spy();
  assert.equal(started, 1);
  assert.equal(window.board().stepsStart, true);
  rmSync(dir, {recursive: true, force: true});
}

function proveChangingTheAgentReplacesTheSetAndDropsOldEffortAndSpeed15(): void {
  const {dir, home} = scratch();
  const window = openWindow({homePath: home});
  window.chooseAgent('cursor');
  window.chooseAgent('codex');
  let doc = readHome(home);
  assert.equal(doc.agent, 'codex');
  assert.equal(doc.models?.mechanical, 'gpt-6-luna');
  assert.equal(doc.models?.judgment, 'gpt-6.1-sol');
  assert.deepEqual(doc.effort, {mechanical: 'low', judgment: 'high'});
  assert.equal(doc.speed, undefined);
  assert.equal(JSON.stringify(doc).includes('composer-2.5-fast'), false);
  assert.equal(JSON.stringify(doc).includes('grok-4.7-high-fast'), false);
  assertNoEmptyStrings(doc);
  window.chooseAgent('opencode');
  doc = readHome(home);
  assert.equal(doc.agent, 'opencode');
  assert.equal(doc.models?.mechanical, 'moonshotai/kimi-k2.7-code');
  assert.equal(doc.models?.judgment, 'moonshotai/kimi-k3');
  assert.equal(doc.effort, undefined);
  assert.equal(doc.speed, undefined);
  assert.equal(JSON.stringify(doc).includes('gpt-6-luna'), false);
  assertNoEmptyStrings(doc);
  window.chooseAgent('cursor');
  doc = readHome(home);
  assert.equal(doc.effort, undefined);
  assert.equal(doc.speed, undefined);
  assert.equal(doc.models?.mechanical, 'composer-2.5-fast');
  assertNoEmptyStrings(doc);
  rmSync(dir, {recursive: true, force: true});
}

function proveARecordedAgentThatDoesNotAnswerStaysInTheFile16(): void {
  const {dir, home} = scratch();
  const body = [
    'agent: cursor',
    'models:',
    '  mechanical: composer-2.5-fast',
    '  judgment: grok-4.7-high-fast',
    '',
  ].join('\n');
  writeFileSync(home, body);
  const asked: string[] = [];
  let started = 0;
  let assignees = 0;
  const window = openWindow(
    {homePath: home},
    {
      answers: agentId => {
        asked.push(agentId);
        return false;
      },
      startStep: () => {
        started += 1;
      },
      writeAssignee: () => {
        assignees += 1;
      },
    },
  );
  assert.deepEqual(window.board().rows, [{text: 'агент не отвечает'}]);
  assert.equal(window.board().visible, true);
  assert.equal(window.board().settingsOpen, false);
  assert.equal(window.board().stepsStart, false);
  assert.equal(window.board().takeDisabled, true);
  window.spy();
  window.take();
  assert.equal(started, 0);
  assert.equal(assignees, 0);
  assert.equal(readFileSync(home, 'utf8'), body);
  assert.ok(asked.includes('cursor'));
  rmSync(dir, {recursive: true, force: true});
}

function proveTheHomeFileGainsNoPersonPhaseFocusOrMetrics18(): void {
  const {dir, home} = scratch();
  writeFileSync(
    home,
    [
      'person: ada',
      'phase: implementing',
      'focus: gap',
      'metrics:',
      '  n: 1',
      'watch:',
      '  - LAVKAOPSCORE',
      'roots:',
      '  arcadia: ~/arcadia',
      '  github: ~/github',
      'roles: []',
      'agent: cursor',
      'models:',
      '  mechanical: composer-2.5-fast',
      '  judgment: grok-4.7-high-fast',
      '',
    ].join('\n'),
  );
  const window = openWindow({homePath: home});
  window.chooseAgent('codex');
  window.take();
  const doc = readHome(home);
  assert.equal(doc.person, undefined);
  assert.equal(doc.phase, undefined);
  assert.equal(doc.focus, undefined);
  assert.equal(doc.metrics, undefined);
  assert.deepEqual(doc.watch, ['LAVKAOPSCORE']);
  assert.deepEqual(doc.roots, {arcadia: '~/arcadia', github: '~/github'});
  assert.deepEqual(doc.roles, []);
  assert.equal(doc.agent, 'codex');
  rmSync(dir, {recursive: true, force: true});
}

function proveAnOverlayMechanicalModelReplacesTheHomeIdAndAMissingOverlayKeepsHome84(): void {
  const {dir, home, arcadia} = yard();
  const billing = path.join(arcadia, 'services', 'billing');
  const other = path.join(arcadia, 'services', 'other');
  mkdirSync(billing, {recursive: true});
  mkdirSync(other, {recursive: true});
  writeServiceConfig(billing, ['alpha']);
  writeServiceConfig(other, ['beta']);
  writeLaunch(home, ['alpha', 'beta'], {arcadia});
  writeOverlay(billing, [], 'models:\n  mechanical: overlay-mechanical\n');
  const started: {checkout: string; mechanical: string; judgment: string}[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      answers: () => true,
      startStep: (checkout, models) => {
        started.push({
          checkout: checkout ?? '',
          mechanical: models?.mechanical ?? '',
          judgment: models?.judgment ?? '',
        });
      },
      tickets: () => [
        ticket({key: '1', queue: 'alpha', sddService: 'services/billing'}),
        ticket({key: '2', queue: 'beta', sddService: 'services/other'}),
      ],
    },
  );
  window.chooseAgent('cursor');
  window.spy();
  assert.deepEqual(started, [
    {
      checkout: billing,
      mechanical: 'overlay-mechanical',
      judgment: 'grok-4.7-high-fast',
    },
    {
      checkout: other,
      mechanical: 'composer-2.5-fast',
      judgment: 'grok-4.7-high-fast',
    },
  ]);
  rmSync(dir, {recursive: true, force: true});
}

function proveChangingTheOverlayAgentToOpencodeWritesThePairAndNoEffortOrSpeed85(): void {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeServiceConfig(checkout, ['alpha']);
  writeLaunch(home, ['alpha'], {arcadia});
  writeOverlay(
    checkout,
    ['alpha'],
    [
      'agent: codex',
      'models:',
      '  mechanical: gpt-6-luna',
      '  judgment: gpt-6.1-sol',
      'effort:',
      '  mechanical: max',
      '  judgment: max',
      'speed:',
      '  mechanical: fast',
      'roots:',
      '  arcadia: /wrong',
      'roles:',
      '  - someone',
      '',
    ].join('\n'),
  );
  let reads = 0;
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      catalog: () => {
        reads += 1;
        return {mechanical: 'not-the-pair', judgment: 'also-not'};
      },
      tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})],
    },
  );
  window.chooseAgent('cursor');
  window.openSettings();
  window.chooseOverlayAgent('opencode');
  const doc = readHome(path.join(checkout, '.aifactory', 'config.yaml'));
  assert.equal(doc.agent, 'opencode');
  assert.equal(doc.models?.mechanical, 'moonshotai/kimi-k2.7-code');
  assert.equal(doc.models?.judgment, 'moonshotai/kimi-k3');
  assert.equal(doc.effort, undefined);
  assert.equal(doc.speed, undefined);
  assert.equal(doc.roots, undefined);
  assert.equal(doc.roles, undefined);
  assert.deepEqual(doc.watch, ['alpha']);
  assertNoEmptyStrings(doc);
  assert.equal(reads, 0);
  rmSync(dir, {recursive: true, force: true});
}

function proveAnOverlayAgentOfCodexWithNoEffortKeyDoesNotTakeHomeEffortMax87(): void {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeServiceConfig(checkout, ['alpha']);
  writeFileSync(
    home,
    [
      'agent: cursor',
      'models:',
      '  mechanical: composer-2.5-fast',
      '  judgment: grok-4.7-high-fast',
      'effort:',
      '  mechanical: max',
      '  judgment: max',
      'watch:',
      '  - alpha',
      'roots:',
      `  arcadia: ${arcadia}`,
      '',
    ].join('\n'),
  );
  writeOverlay(
    checkout,
    ['alpha'],
    ['agent: codex', 'models:', '  mechanical: gpt-6-luna', '  judgment: gpt-6.1-sol', ''].join(
      '\n',
    ),
  );
  let started = 0;
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      answers: () => true,
      startStep: () => {
        started += 1;
      },
      tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})],
    },
  );
  window.openSettings();
  assert.equal(window.overlay().file, '.aifactory/config.yaml');
  assert.equal(window.overlay().checkout, checkout);
  assert.equal(window.overlay().agent, 'codex');
  assert.equal(window.overlay().models.mechanical.value, 'gpt-6-luna');
  assert.equal(window.overlay().models.judgment.value, 'gpt-6.1-sol');
  assert.deepEqual(window.overlay().effort, {mechanical: 'low', judgment: 'high'});
  assert.deepEqual(window.overlay().speed, {mechanical: '', judgment: ''});
  assert.equal(readHome(path.join(checkout, '.aifactory', 'config.yaml')).effort, undefined);
  window.spy();
  assert.equal(started, 1);
  rmSync(dir, {recursive: true, force: true});
}

function proveClearingTheOverlayAgentRemovesAgentModelsEffortAndSpeed88(): void {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeServiceConfig(checkout, ['alpha']);
  writeLaunch(home, ['alpha'], {arcadia});
  writeOverlay(
    checkout,
    ['alpha'],
    [
      'agent: codex',
      'models:',
      '  mechanical: gpt-6-luna',
      '  judgment: gpt-6.1-sol',
      'effort:',
      '  mechanical: high',
      '  judgment: low',
      'speed:',
      '  mechanical: fast',
      '',
    ].join('\n'),
  );
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})]},
  );
  window.chooseAgent('cursor');
  window.openSettings();
  window.clearOverlayAgent();
  const doc = readHome(path.join(checkout, '.aifactory', 'config.yaml'));
  assert.equal(doc.agent, undefined);
  assert.equal(doc.models, undefined);
  assert.equal(doc.effort, undefined);
  assert.equal(doc.speed, undefined);
  assert.deepEqual(doc.watch, ['alpha']);
  assert.equal(window.overlay().agent, 'cursor');
  rmSync(dir, {recursive: true, force: true});
}

function proveClearingOverlayEffortAndSpeedRemovesThoseKeys(): void {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeServiceConfig(checkout, ['alpha']);
  writeLaunch(home, ['alpha'], {arcadia});
  writeOverlay(
    checkout,
    ['alpha'],
    [
      'agent: codex',
      'models:',
      '  mechanical: gpt-6-luna',
      '  judgment: gpt-6.1-sol',
      'effort:',
      '  mechanical: high',
      '  judgment: low',
      'speed:',
      '  mechanical: fast',
      '',
    ].join('\n'),
  );
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})]},
  );
  window.chooseAgent('cursor');
  window.openSettings();
  assert.deepEqual(window.overlay().effortWords, ['low', 'medium', 'high', 'xhigh', 'max']);
  assert.deepEqual(window.overlay().speedWords, ['fast']);
  window.leaveOverlayEffort('mechanical', 'turbo');
  window.leaveOverlaySpeed('judgment', 'slow');
  const kept = readHome(path.join(checkout, '.aifactory', 'config.yaml'));
  assert.equal(kept.effort?.mechanical, 'high');
  assert.equal(kept.speed?.mechanical, 'fast');
  window.leaveOverlayEffort('mechanical', '');
  window.leaveOverlayEffort('judgment', '');
  window.leaveOverlaySpeed('mechanical', '');
  const doc = readHome(path.join(checkout, '.aifactory', 'config.yaml'));
  assert.equal(doc.agent, 'codex');
  assert.equal(doc.effort, undefined);
  assert.equal(doc.speed, undefined);
  rmSync(dir, {recursive: true, force: true});
}

function proveClearingOverlayJudgmentWithNoOverlayAgentShowsTheHomeJudgmentId89(): void {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeServiceConfig(checkout, ['alpha']);
  writeLaunch(home, ['alpha'], {arcadia});
  writeOverlay(checkout, ['alpha'], 'models:\n  judgment: custom-judgment\n');
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})]},
  );
  window.chooseAgent('cursor');
  window.openSettings();
  assert.equal(window.overlay().models.judgment.value, 'custom-judgment');
  window.leaveOverlayModel('judgment', '');
  const doc = readHome(path.join(checkout, '.aifactory', 'config.yaml'));
  assert.equal(doc.models?.judgment, undefined);
  assert.equal(window.overlay().models.judgment.value, 'grok-4.7-high-fast');
  assert.equal(window.overlay().models.mechanical.value, 'composer-2.5-fast');
  rmSync(dir, {recursive: true, force: true});
}

function proveAnEmptyMergedMechanicalModelNamesTheCheckoutAndStopsOnlyThatStep93(): void {
  const {dir, home, arcadia} = yard();
  const billing = path.join(arcadia, 'services', 'billing');
  const other = path.join(arcadia, 'services', 'other');
  mkdirSync(billing, {recursive: true});
  mkdirSync(other, {recursive: true});
  writeServiceConfig(billing, ['alpha']);
  writeServiceConfig(other, ['beta']);
  writeLaunch(home, ['alpha', 'beta'], {arcadia});
  writeOverlay(billing, [], 'models:\n  mechanical: ""\n');
  const tickets = [
    ticket({key: '1', queue: 'alpha', sddService: 'services/billing', title: 'Bare'}),
    ticket({key: '2', queue: 'beta', sddService: 'services/other', title: 'Other'}),
    cycle('3', 'implementing', {assignee: '', title: 'Phased'}),
  ];
  const assignees: string[] = [];
  const started: {checkout: string; mechanical: string}[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      login: () => MANAGER,
      answers: () => true,
      tickets: () => tickets,
      writeAssignee: key => {
        assignees.push(key);
        const found = tickets.find(item => item.key === key);
        if (found) {
          found.assignee = MANAGER;
        }
      },
      startStep: (checkout, models) => {
        started.push({checkout: checkout ?? '', mechanical: models?.mechanical ?? ''});
      },
    },
  );
  window.chooseAgent('cursor');
  const row = window.board().rows.find(item => item.text.includes(billing));
  assert.ok(row);
  assert.equal(row.text.includes('нужна модель mechanical'), true);
  assert.equal(
    window
      .board()
      .rows.some(item => item.text.includes(other) && item.text.includes('нужна модель')),
    false,
  );
  window.take('1');
  window.take('3');
  assert.deepEqual(assignees, ['3']);
  window.spy();
  assert.deepEqual(started, [{checkout: other, mechanical: 'composer-2.5-fast'}]);
  rmSync(dir, {recursive: true, force: true});
}

function proveAStartedStepKeepsTheMechanicalIdFromThatCallUntilLeadingIsFalse96(): void {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeServiceConfig(checkout, ['alpha']);
  writeLaunch(home, ['alpha'], {arcadia});
  writeOverlay(checkout, [], 'models:\n  mechanical: first-id\n');
  let leading = false;
  const started: string[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      answers: () => true,
      leading: () => leading,
      startStep: (_checkout, models) => {
        started.push(models?.mechanical ?? '');
      },
      tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})],
    },
  );
  window.chooseAgent('cursor');
  window.spy();
  leading = true;
  writeOverlay(checkout, [], 'models:\n  mechanical: second-id\n');
  window.spy();
  assert.deepEqual(started, ['first-id']);
  leading = false;
  window.spy();
  assert.deepEqual(started, ['first-id', 'second-id']);
  rmSync(dir, {recursive: true, force: true});
}

function proveTheSameIdMayFillBothSlots136(): void {
  const {dir, home} = scratch();
  const window = openWindow({homePath: home}, {answers: () => true});
  window.chooseAgent('cursor');
  window.leaveModel('judgment', 'composer-2.5-fast');
  const doc = readHome(home);
  assert.equal(doc.models?.mechanical, 'composer-2.5-fast');
  assert.equal(doc.models?.judgment, 'composer-2.5-fast');
  rmSync(dir, {recursive: true, force: true});
}

spec('factory-config', () => {
  requirement('The home config is the file the launch named', () => {
    scenario('No launch path writes no home file', () => {
      proveNoHomePathWritesNoFileWhenTheManagerChoosesAnAgent8();
    });
    scenario('The home file has no person field', () => {
      proveTheHomeFileGainsNoPersonPhaseFocusOrMetrics18();
    });
  });
  requirement('The service overlay replaces keys and does not replace roots', () => {
    scenario('An overlay model replaces the home model', () => {
      proveAnOverlayMechanicalModelReplacesTheHomeIdAndAMissingOverlayKeepsHome84();
    });
    scenario('A missing overlay keeps the home values', () => {
      proveAnOverlayMechanicalModelReplacesTheHomeIdAndAMissingOverlayKeepsHome84();
    });
    scenario('The machine without the window ignores the overlay', async () => {
      await proveTheMachineSpyLeavesABareCycleOutAndDoesNotReadAifactory45();
    });
  });
  requirement("The merged config is one agent and that agent's fields", () => {
    scenario('A running step keeps its model', () => {
      proveAStartedStepKeepsTheMechanicalIdFromThatCallUntilLeadingIsFalse96();
    });
    scenario('The same id may fill both slots', () => {
      proveTheSameIdMayFillBothSlots136();
    });
  });
  requirement('A known pair is written with the agent', () => {
    scenario('Cursor writes its pair', () => {
      proveChoosingCursorWritesItsPairAndOmitsEffortAndSpeed2();
    });
    scenario('Codex writes its pair', () => {
      proveChoosingCodexWritesItsPairAndEffortAndOmitsSpeed3();
    });
    scenario('Claude-code writes its pair', () => {
      proveChoosingClaudeCodeWritesItsPairAndEffortAndOmitsSpeed4();
    });
    scenario('OpenCode writes its pair', () => {
      proveChoosingOpencodeWritesItsPairAndOmitsEffortAndSpeed5();
    });
  });
  requirement('Changing the agent replaces the whole set', () => {
    scenario('Codex replaces a cursor set', () => {
      proveChangingTheAgentReplacesTheSetAndDropsOldEffortAndSpeed15();
    });
    scenario('OpenCode writes no effort key', () => {
      proveChangingTheOverlayAgentToOpencodeWritesThePairAndNoEffortOrSpeed85();
    });
  });
  requirement("Effort and speed are the agent's own fields", () => {
    scenario('Empty effort does not stop a step', () => {
      proveEmptyEffortAndSpeedAreTheAgentDefaultAndDoNotStopAStep12();
    });
    scenario('An empty model stops Take on a phaseless cycle', () => {
      proveAnEmptyMergedMechanicalModelNamesTheCheckoutAndStopsOnlyThatStep93();
    });
  });
  requirement('An overlay agent does not borrow effort or speed', () => {
    scenario('An overlay agent ignores home effort', () => {
      proveAnOverlayAgentOfCodexWithNoEffortKeyDoesNotTakeHomeEffortMax87();
      proveClearingOverlayEffortAndSpeedRemovesThoseKeys();
    });
    scenario('Clearing the overlay agent drops the set', () => {
      proveClearingTheOverlayAgentRemovesAgentModelsEffortAndSpeed88();
    });
    scenario('Clearing a model shows home', () => {
      proveClearingOverlayJudgmentWithNoOverlayAgentShowsTheHomeJudgmentId89();
    });
  });
  requirement('A recorded agent or model that fails is kept', () => {
    scenario('A silent agent leaves the file', () => {
      proveARecordedAgentThatDoesNotAnswerStaysInTheFile16();
    });
    scenario('A rejected id leaves the file', () => {
      proveACatalogThatRejectsTheRecordedJudgmentIdKeepsItAndStopsTheStep95();
    });
  });
});
