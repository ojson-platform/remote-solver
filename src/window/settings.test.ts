import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import {requirement, scenario, spec} from '@ojson/spec-coverage';
import {openWindow} from './window.ts';
import {
  MANAGER,
  proveChoosingCursorWritesItsPairAndOmitsEffortAndSpeed2,
  readHome,
  readServiceYaml,
  scratch,
  ticket,
  writeLaunch,
  writeServiceConfig,
  writeServiceYaml,
  yard,
} from './window.harness.ts';
import {bare, hosted, pageHtml, post} from './page.harness.ts';

function proveAnEmptyAgentListWritesNoHomeFile9(): void {
  const {dir, home} = scratch();
  const window = openWindow({homePath: home, agents: []});
  window.chooseAgent('cursor');
  window.chooseAgent('codex');
  assert.equal(existsSync(home), false);
  assert.deepEqual(window.board().rows, [{text: 'фабрике ещё нужен агент'}]);
  rmSync(dir, {recursive: true, force: true});
}

function proveLeavingAModelEmptyWritesThatField10(): void {
  const {dir, home} = scratch();
  const window = openWindow({homePath: home}, {answers: () => true});
  window.chooseAgent('cursor');
  window.leaveModel('mechanical', '');
  assert.equal(readHome(home).models?.mechanical, '');
  assert.equal(readHome(home).models?.judgment, 'grok-4.7-high-fast');
  assert.equal(window.settings().models.mechanical.needsValue, true);
  assert.equal(window.settings().models.judgment.needsValue, false);
  assert.deepEqual(window.board().rows, [{text: 'нужна модель mechanical'}]);
  window.leaveModel('judgment', '');
  const doc = readHome(home);
  assert.equal(doc.models?.mechanical, '');
  assert.equal(doc.models?.judgment, '');
  assert.equal(window.settings().models.judgment.needsValue, true);
  assert.deepEqual(window.board().rows, [{text: 'нужны модели mechanical и judgment'}]);
  window.leaveModel('judgment', 'grok-4.7-high-fast');
  assert.equal(readHome(home).models?.judgment, 'grok-4.7-high-fast');
  assert.equal(readHome(home).models?.mechanical, '');
  assert.deepEqual(window.board().rows, [{text: 'нужна модель mechanical'}]);
  rmSync(dir, {recursive: true, force: true});
}

function proveANewerHomeFileBlocksTheWriteAndTheWindowShowsTheDisk13(): void {
  const {dir, home} = scratch();
  writeFileSync(
    home,
    [
      'agent: cursor',
      'models:',
      '  mechanical: composer-2.5-fast',
      '  judgment: grok-4.7-high-fast',
      '',
    ].join('\n'),
  );
  const window = openWindow({homePath: home});
  const disk = [
    'agent: codex',
    'models:',
    '  mechanical: gpt-6-luna',
    '  judgment: gpt-6.1-sol',
    'effort:',
    '  mechanical: low',
    '  judgment: high',
    '',
  ].join('\n');
  writeFileSync(home, disk);
  window.chooseAgent('opencode');
  assert.equal(readFileSync(home, 'utf8'), disk);
  assert.equal(window.settings().agent, 'codex');
  assert.equal(window.settings().models.mechanical.value, 'gpt-6-luna');
  assert.equal(window.settings().models.judgment.value, 'gpt-6.1-sol');
  window.chooseAgent('cursor');
  assert.equal(readHome(home).agent, 'cursor');
  rmSync(dir, {recursive: true, force: true});
}

function proveAMissingHomeFileLeavesSettingsClosedUntilTheManagerOpensThem66(): void {
  const {dir, home} = scratch();
  const window = openWindow({homePath: home});
  assert.equal(window.settings().open, false);
  assert.equal(window.board().settingsOpen, false);
  window.openSettings();
  assert.equal(window.settings().open, true);
  assert.equal(window.board().settingsOpen, true);
  assert.deepEqual(window.board().rows, [{text: 'фабрике ещё нужен агент'}]);
  assert.equal(existsSync(home), false);
  window.closeSettings();
  assert.equal(existsSync(home), false);
  assert.equal(window.settings().open, false);
  rmSync(dir, {recursive: true, force: true});
}

function proveAnOverlayEditIsOnDiskAfterSettingsClose86(): void {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeServiceConfig(checkout, ['alpha']);
  writeLaunch(home, ['alpha'], {arcadia});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})]},
  );
  window.openSettings();
  window.chooseOverlayAgent('claude-code');
  const file = path.join(checkout, '.aifactory', 'config.yaml');
  assert.equal(readHome(file).agent, 'claude-code');
  window.closeSettings();
  const doc = readHome(file);
  assert.equal(doc.agent, 'claude-code');
  assert.equal(doc.models?.mechanical, 'sonnet');
  assert.equal(doc.models?.judgment, 'opus');
  assert.deepEqual(doc.effort, {mechanical: 'medium', judgment: 'medium'});
  assert.equal(doc.speed, undefined);
  assert.equal(window.board().settingsOpen, false);
  rmSync(dir, {recursive: true, force: true});
}

function proveOneGatheredCheckoutIsSelectedWhenSettingsOpenWithNoCard91(): void {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeServiceConfig(checkout, ['alpha']);
  writeLaunch(home, ['alpha'], {arcadia});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})]},
  );
  assert.equal(window.overlay().checkout, '');
  window.openSettings();
  assert.equal(window.overlay().file, '.aifactory/config.yaml');
  assert.equal(window.overlay().checkout, checkout);
  assert.equal(window.serviceConfig().checkout, checkout);
  rmSync(dir, {recursive: true, force: true});
}

function proveSeveralGatheredCheckoutsWriteNothingUntilChooseCheckout92(): void {
  const {dir, home, arcadia} = yard();
  const billing = path.join(arcadia, 'services', 'billing');
  const other = path.join(arcadia, 'services', 'other');
  mkdirSync(billing, {recursive: true});
  mkdirSync(other, {recursive: true});
  writeServiceConfig(billing, ['alpha']);
  writeServiceConfig(other, ['beta']);
  writeLaunch(home, ['alpha', 'beta'], {arcadia});
  const tickets = [
    ticket({key: '1', queue: 'alpha', sddService: 'services/billing'}),
    ticket({key: '2', queue: 'beta', sddService: 'services/other'}),
  ];
  const window = openWindow({homePath: home, adapter: 'tracker'}, {tickets: () => tickets});
  window.openSettings();
  assert.equal(window.overlay().checkout, '');
  assert.equal(window.serviceConfig().checkout, '');
  window.chooseOverlayAgent('opencode');
  assert.equal(existsSync(path.join(billing, '.aifactory', 'config.yaml')), false);
  assert.equal(existsSync(path.join(other, '.aifactory', 'config.yaml')), false);
  window.chooseCheckout(path.join(arcadia, 'missing'));
  assert.equal(window.overlay().checkout, '');
  window.chooseCheckout(billing);
  window.chooseOverlayAgent('opencode');
  assert.equal(readHome(path.join(billing, '.aifactory', 'config.yaml')).agent, 'opencode');
  assert.equal(existsSync(path.join(other, '.aifactory', 'config.yaml')), false);
  window.openCard('2');
  assert.equal(window.overlay().checkout, other);
  rmSync(dir, {recursive: true, force: true});
}

function proveTheServiceConfigGroupDiscardsAnUnsavedQueueEditAndTheSpyReadsTheDiskQueues110(): void {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeServiceConfig(checkout, ['alpha']);
  const file = path.join(checkout, 'openspec', 'config.yaml');
  writeLaunch(home, ['alpha'], {arcadia});
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
  window.chooseAgent('cursor');
  window.openSettings();
  window.setServiceQueue(0, 'gamma', 'draft');
  assert.equal(window.serviceConfig().queues?.items[0]?.name, 'gamma');
  assert.equal(window.childQueue(), 'alpha');
  window.spy();
  assert.equal(started, 1);
  assert.deepEqual(readServiceYaml(file).sdd?.queues, [{name: 'alpha'}]);
  window.closeSettings();
  assert.deepEqual(readServiceYaml(file).sdd?.queues, [{name: 'alpha'}]);
  window.openSettings();
  assert.equal(window.serviceConfig().queues?.items[0]?.name, 'alpha');
  assert.equal(window.serviceConfig().queues?.items[0]?.description, '');
  rmSync(dir, {recursive: true, force: true});
}

function proveTheServiceConfigGroupShowsTheDiskCopyWhenTheFileChangedBeforeSave111(): void {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  const file = writeServiceYaml(
    checkout,
    ['sdd:', '  queues:', '    - name: alpha', ''].join('\n'),
  );
  writeLaunch(home, ['alpha'], {arcadia});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})]},
  );
  window.openSettings();
  assert.equal(window.serviceConfig().queues?.items[0]?.name, 'alpha');
  writeFileSync(file, 'sdd:\n  queues:\n    - name: beta\n  base: main\n');
  window.setServiceBase('trunk');
  window.saveServiceConfig();
  const doc = readServiceYaml(file);
  assert.equal(doc.sdd?.queues?.[0]?.name, 'beta');
  assert.equal(doc.sdd?.base, 'main');
  assert.equal(window.serviceConfig().queues?.items[0]?.name, 'beta');
  assert.equal(window.serviceConfig().base, 'main');
  assert.equal(window.serviceConfig().save, true);
  rmSync(dir, {recursive: true, force: true});
}

function proveEachGroupNamesItsFile137(): void {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  writeServiceConfig(checkout, ['alpha']);
  writeLaunch(home, ['alpha'], {arcadia});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})]},
  );
  window.openCard('1');
  window.openSettings();
  assert.equal(window.overlay().file, '.aifactory/config.yaml');
  assert.equal(window.serviceConfig().file, 'openspec/config.yaml');
  rmSync(dir, {recursive: true, force: true});
}

spec('settings', () => {
  requirement('Settings are two blocks and do not open themselves', () => {
    scenario('A missing home file leaves settings closed', () => {
      proveAMissingHomeFileLeavesSettingsClosedUntilTheManagerOpensThem66();
    });
    scenario('Each group names its file', () => {
      proveEachGroupNamesItsFile137();
    });
  });
  requirement("Service groups write the open card's checkout", () => {
    scenario('One checkout is selected', () => {
      proveOneGatheredCheckoutIsSelectedWhenSettingsOpenWithNoCard91();
    });
    scenario('No choice writes nothing', () => {
      proveSeveralGatheredCheckoutsWriteNothingUntilChooseCheckout92();
    });
  });
  requirement('A write rereads the file first', () => {
    scenario('A newer home file blocks the user block', () => {
      proveANewerHomeFileBlocksTheWriteAndTheWindowShowsTheDisk13();
    });
    scenario('A newer service config blocks the save', () => {
      proveTheServiceConfigGroupShowsTheDiskCopyWhenTheFileChangedBeforeSave111();
    });
  });
  requirement('The overlay group writes immediately', () => {
    scenario('An overlay edit is on disk before settings close', () => {
      proveAnOverlayEditIsOnDiskAfterSettingsClose86();
    });
  });
  requirement('The service-config group writes on save', () => {
    scenario('Closing discards an unsaved edit', () => {
      proveTheServiceConfigGroupDiscardsAnUnsavedQueueEditAndTheSpyReadsTheDiskQueues110();
    });
    scenario('The spy reads the previous file', () => {
      proveTheServiceConfigGroupDiscardsAnUnsavedQueueEditAndTheSpyReadsTheDiskQueues110();
    });
  });
  requirement('Choosing an agent writes at once', () => {
    scenario('Choosing cursor writes the home file', () => {
      proveChoosingCursorWritesItsPairAndOmitsEffortAndSpeed2();
    });
    scenario('An empty agent list writes nothing', () => {
      proveAnEmptyAgentListWritesNoHomeFile9();
    });
    scenario('Leaving a model empty writes the empty field', () => {
      proveLeavingAModelEmptyWritesThatField10();
    });
  });
});

spec('settings', () => {
  requirement('Settings are two blocks and do not open themselves', () => {
    scenario('The settings sheet has one close button', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [bare('1', 'Quiet')]},
        async (page, window) => {
          window.chooseAgent('cursor');
          const closed = await pageHtml(page.url);
          assert.equal(closed.includes('role="dialog"'), false);
          assert.match(closed, /name="act" value="open-settings"/);
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open-settings'}).toString()))
              .status,
            200,
          );
          const sheet = await pageHtml(page.url);
          assert.match(sheet, /role="dialog" aria-label="Настройки"/);
          assert.equal(sheet.match(/value="close-settings"/g)?.length, 1);
          assert.match(sheet, /aria-label="Закрыть"/);
          assert.equal(/>\s*Закрыть\s*</.test(sheet), false);
          assert.match(sheet, /name="act" value="open-settings"/);
        },
      );
    });
  });
});
