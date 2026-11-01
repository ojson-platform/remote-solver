import assert from 'node:assert/strict';
import {existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';

import {parse} from 'yaml';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {openWindow} from './window.ts';
import {
  MANAGER,
  proveTheServiceConfigGroupHasNoFieldsWhenTheFileDoesNotParseAndOnlyThatCheckoutLosesItsCards106,
  readServiceYaml,
  ticket,
  writeLaunch,
  writeServiceYaml,
  yard,
} from './window.harness.ts';

function proveTheServiceConfigGroupOmitsADefaultBaseAndWritesMainBesideSchemaContextAndRules98(): void {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  const file = writeServiceYaml(
    checkout,
    [
      'schema: spec',
      'context: kept',
      'rules:',
      '  - one',
      'sdd:',
      '  queues:',
      '    - name: alpha',
      '  base: main',
      '  branch-scope: feature',
      '',
    ].join('\n'),
  );
  writeLaunch(home, ['alpha'], {arcadia});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})]},
  );
  window.openSettings();
  assert.equal(window.serviceConfig().file, 'openspec/config.yaml');
  assert.equal(window.serviceConfig().checkout, checkout);
  assert.equal(window.serviceConfig().base, 'main');
  assert.equal(window.serviceConfig().branchScope, 'feature');
  window.setServiceBase('trunk');
  window.setServiceBranchScope('sdd');
  window.saveServiceConfig();
  const omitted = readServiceYaml(file);
  assert.equal(omitted.sdd?.base, undefined);
  assert.equal(omitted.sdd?.['branch-scope'], undefined);
  assert.equal(omitted.schema, 'spec');
  assert.equal(omitted.context, 'kept');
  assert.deepEqual(omitted.rules, ['one']);
  window.setServiceBase('main');
  window.setServiceBranchScope('feature');
  window.saveServiceConfig();
  const written = readServiceYaml(file);
  assert.equal(written.sdd?.base, 'main');
  assert.equal(written.sdd?.['branch-scope'], 'feature');
  assert.equal(written.schema, 'spec');
  assert.equal(written.context, 'kept');
  assert.deepEqual(written.rules, ['one']);
  rmSync(dir, {recursive: true, force: true});
}

function proveTheServiceConfigGroupKeepsAnUnknownSddKey99(): void {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  const file = writeServiceYaml(
    checkout,
    ['sdd:', '  queues:', '    - name: alpha', '  extra: stay', ''].join('\n'),
  );
  writeLaunch(home, ['alpha'], {arcadia});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})]},
  );
  window.openSettings();
  window.setServiceBase('main');
  window.saveServiceConfig();
  assert.equal(readServiceYaml(file).sdd?.extra, 'stay');
  rmSync(dir, {recursive: true, force: true});
}

function proveTheServiceConfigGroupSavesQueueOrderOmitsAnEmptyDescriptionAndChildQueueReturnsTheFirst100(): void {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  const file = writeServiceYaml(
    checkout,
    [
      'sdd:',
      '  queues:',
      '    - name: beta',
      '      description: kept',
      '    - name: alpha',
      '',
    ].join('\n'),
  );
  writeLaunch(home, ['beta'], {arcadia});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {tickets: () => [ticket({key: '1', queue: 'beta', sddService: 'services/billing'})]},
  );
  window.openSettings();
  assert.equal(window.childQueue(), 'beta');
  window.moveServiceQueue(1, 0);
  window.setServiceQueue(0, 'alpha', '');
  window.addServiceQueue();
  window.setServiceQueue(2, 'alpha', '');
  assert.equal(window.childQueue(), 'beta');
  window.saveServiceConfig();
  assert.equal(window.childQueue(), 'alpha');
  const queues = readServiceYaml(file).sdd?.queues;
  assert.deepEqual(queues, [{name: 'alpha'}, {name: 'beta', description: 'kept'}, {name: 'alpha'}]);
  rmSync(dir, {recursive: true, force: true});
}

function proveTheServiceConfigGroupOmitsIgnoreCommentsWhenTheLastPatternIsRemoved101(): void {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  const file = writeServiceYaml(
    checkout,
    ['sdd:', '  queues:', '    - name: alpha', '  ignore-comments:', '    - bot', ''].join('\n'),
  );
  writeLaunch(home, ['alpha'], {arcadia});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})]},
  );
  window.openSettings();
  window.addServiceIgnore('reviewer');
  assert.deepEqual(
    window.serviceConfig().ignoreComments?.map(item => item.value),
    ['bot', 'reviewer'],
  );
  window.removeServiceIgnore(1);
  window.removeServiceIgnore(0);
  window.saveServiceConfig();
  assert.equal(readServiceYaml(file).sdd?.['ignore-comments'], undefined);
  assert.deepEqual(readServiceYaml(file).sdd?.queues, [{name: 'alpha'}]);
  rmSync(dir, {recursive: true, force: true});
}

function proveTheServiceConfigGroupWarnsWhenAnIgnoreCommentsPatternDoesNotCompile102(): void {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  const file = writeServiceYaml(
    checkout,
    ['sdd:', '  queues:', '    - name: alpha', '  ignore-comments:', '    - bot', ''].join('\n'),
  );
  const bytes = readFileSync(file, 'utf8');
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
  window.setServiceIgnore(0, '(');
  const field = window.serviceConfig().ignoreComments?.[0];
  assert.equal(field?.value, '(');
  assert.equal(field?.warning, true);
  assert.equal(window.serviceConfig().save, false);
  window.saveServiceConfig();
  assert.equal(readFileSync(file, 'utf8'), bytes);
  assert.equal(
    window.board().pool.some(card => card.key === '1'),
    true,
  );
  window.spy();
  assert.equal(started, 1);
  window.closeSettings();
  assert.equal(readFileSync(file, 'utf8'), bytes);
  window.openSettings();
  assert.equal(window.serviceConfig().ignoreComments?.[0]?.value, 'bot');
  assert.equal(window.serviceConfig().save, true);
  rmSync(dir, {recursive: true, force: true});
}

function proveTheServiceConfigGroupWarnsOnAnEmptyQueueNameAndOnTheLastQueue103(): void {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  const file = writeServiceYaml(
    checkout,
    ['sdd:', '  queues:', '    - name: alpha', ''].join('\n'),
  );
  const bytes = readFileSync(file, 'utf8');
  writeLaunch(home, ['alpha'], {arcadia});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})]},
  );
  window.openSettings();
  window.addServiceQueue();
  const added = window.serviceConfig().queues?.items.at(-1);
  assert.equal(added?.name, '');
  assert.equal(added?.warning, true);
  assert.equal(window.serviceConfig().save, false);
  window.saveServiceConfig();
  assert.equal(readFileSync(file, 'utf8'), bytes);
  window.setServiceQueue(1, 'gamma', '');
  assert.equal(window.serviceConfig().queues?.items[1]?.warning, undefined);
  assert.equal(window.serviceConfig().save, true);
  window.removeServiceQueue(1);
  window.removeServiceQueue(0);
  assert.deepEqual(window.serviceConfig().queues, {items: [], warning: true});
  assert.equal(window.serviceConfig().save, false);
  window.saveServiceConfig();
  assert.deepEqual(readServiceYaml(file).sdd?.queues, [{name: 'alpha'}]);
  rmSync(dir, {recursive: true, force: true});
}

function proveTheServiceConfigGroupWarnsWhenYAMLHasNoSddKey104(): void {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  const file = writeServiceYaml(
    checkout,
    ['schema: spec', 'context: kept', 'rules:', '  - one', ''].join('\n'),
  );
  writeLaunch(home, ['alpha'], {arcadia});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})]},
  );
  window.openSettings();
  assert.deepEqual(window.serviceConfig().queues, {items: [], warning: true});
  assert.equal(window.serviceConfig().save, false);
  window.addServiceQueue();
  window.setServiceQueue(0, 'alpha', '');
  assert.equal(window.serviceConfig().queues?.warning, undefined);
  assert.equal(window.serviceConfig().save, true);
  window.saveServiceConfig();
  const doc = readServiceYaml(file);
  assert.deepEqual(doc.sdd?.queues, [{name: 'alpha'}]);
  assert.equal(doc.schema, 'spec');
  assert.equal(doc.context, 'kept');
  assert.deepEqual(doc.rules, ['one']);
  assert.equal(doc.sdd?.base, undefined);
  rmSync(dir, {recursive: true, force: true});
}

function proveTheServiceConfigGroupCanOnlyRemoveANonStringIgnoreCommentsValue105(): void {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  const file = writeServiceYaml(
    checkout,
    ['sdd:', '  queues:', '    - name: alpha', '  ignore-comments: 1', ''].join('\n'),
  );
  writeLaunch(home, ['alpha'], {arcadia});
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})]},
  );
  window.openSettings();
  const locked = window.serviceConfig().ignoreComments;
  assert.equal(locked?.length, 1);
  assert.equal(locked?.[0]?.removeOnly, true);
  assert.equal(locked?.[0]?.warning, true);
  assert.equal(window.serviceConfig().save, false);
  window.setServiceIgnore(0, 'bot');
  assert.equal(window.serviceConfig().ignoreComments?.[0]?.removeOnly, true);
  window.removeServiceIgnore(0);
  assert.equal(window.serviceConfig().save, true);
  window.saveServiceConfig();
  assert.equal(readServiceYaml(file).sdd?.['ignore-comments'], undefined);
  writeFileSync(file, 'sdd:\n  queues:\n    - name: alpha\n  ignore-comments: 1\n');
  window.closeSettings();
  window.openSettings();
  assert.equal(window.serviceConfig().ignoreComments?.[0]?.removeOnly, true);
  window.removeServiceIgnore(0);
  window.closeSettings();
  assert.equal(readServiceYaml(file).sdd?.['ignore-comments'], 1);
  rmSync(dir, {recursive: true, force: true});
}

function proveTheServiceConfigGroupCreatesAMissingFileFromTheQueueTheManagerAdds108(): void {
  const {dir, home, arcadia} = yard();
  const checkout = path.join(arcadia, 'services', 'billing');
  mkdirSync(checkout, {recursive: true});
  const file = path.join(checkout, 'openspec', 'config.yaml');
  writeLaunch(home, ['alpha'], {arcadia});
  let started = 0;
  let leading = false;
  const assignees: string[] = [];
  const window = openWindow(
    {homePath: home, adapter: 'tracker'},
    {
      answers: () => true,
      login: () => MANAGER,
      leading: () => leading,
      startStep: () => {
        started += 1;
      },
      writeAssignee: key => {
        assignees.push(key);
      },
      tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})],
    },
  );
  window.chooseAgent('cursor');
  const card = window.board().pool.find(item => item.key === '1');
  assert.ok(card);
  assert.equal(card.reason, 'конфига сервиса нет');
  assert.notEqual(card.reason, 'каталога нет');
  assert.equal(card.takeDisabled, true);
  window.take('1');
  assert.deepEqual(assignees, []);
  window.spy();
  assert.equal(started, 0);
  leading = true;
  window.spy();
  assert.equal(started, 0);
  leading = false;
  window.spy();
  assert.equal(started, 0);
  window.openSettings();
  assert.equal(window.serviceConfig().file, 'openspec/config.yaml');
  assert.equal(window.serviceConfig().checkout, checkout);
  assert.deepEqual(window.serviceConfig().queues, {items: []});
  assert.equal(window.serviceConfig().save, true);
  assert.equal(window.serviceConfig().line, undefined);
  window.saveServiceConfig();
  assert.equal(existsSync(file), true);
  const created = readServiceYaml(file);
  assert.equal(created.schema, undefined);
  assert.equal(created.context, undefined);
  assert.equal(created.rules, undefined);
  window.addServiceQueue();
  assert.equal(window.serviceConfig().save, false);
  window.setServiceQueue(0, 'alpha', '');
  window.saveServiceConfig();
  const doc = readServiceYaml(file);
  assert.deepEqual(doc.sdd?.queues, [{name: 'alpha'}]);
  assert.equal(doc.schema, undefined);
  assert.equal(doc.context, undefined);
  assert.equal(doc.rules, undefined);
  window.spy();
  assert.equal(started, 1);
  window.take('1');
  assert.deepEqual(assignees, ['1']);
  rmSync(dir, {recursive: true, force: true});
}

spec('service-config', () => {
  requirement('The group writes the sdd fields', () => {
    scenario('A default base is omitted', () => {
      proveTheServiceConfigGroupOmitsADefaultBaseAndWritesMainBesideSchemaContextAndRules98();
    });
    scenario('A custom base is written', () => {
      proveTheServiceConfigGroupOmitsADefaultBaseAndWritesMainBesideSchemaContextAndRules98();
    });
    scenario('An unknown sdd key remains', () => {
      proveTheServiceConfigGroupKeepsAnUnknownSddKey99();
    });
  });
  requirement('Queues are an ordered list of names', () => {
    scenario("The first queue is the child's queue", () => {
      proveTheServiceConfigGroupSavesQueueOrderOmitsAnEmptyDescriptionAndChildQueueReturnsTheFirst100();
    });
    scenario('An empty description is omitted', () => {
      proveTheServiceConfigGroupSavesQueueOrderOmitsAnEmptyDescriptionAndChildQueueReturnsTheFirst100();
    });
    scenario('Duplicate names stay in order', () => {
      proveTheServiceConfigGroupSavesQueueOrderOmitsAnEmptyDescriptionAndChildQueueReturnsTheFirst100();
    });
  });
  requirement('Ignore-comments is an ordered list of strings', () => {
    scenario('An empty list removes the key', () => {
      proveTheServiceConfigGroupOmitsIgnoreCommentsWhenTheLastPatternIsRemoved101();
    });
  });
  requirement('An unreadable edit is not written', () => {
    scenario('A pattern that does not compile blocks save', () => {
      proveTheServiceConfigGroupWarnsWhenAnIgnoreCommentsPatternDoesNotCompile102();
    });
    scenario('An empty queue name blocks save', () => {
      proveTheServiceConfigGroupWarnsOnAnEmptyQueueNameAndOnTheLastQueue103();
    });
    scenario('The last queue cannot be removed into an empty list', () => {
      proveTheServiceConfigGroupWarnsOnAnEmptyQueueNameAndOnTheLastQueue103();
    });
    scenario('YAML without sdd warns', () => {
      proveTheServiceConfigGroupWarnsWhenYAMLHasNoSddKey104();
    });
  });
  requirement('A non-string ignore-comments value can only be removed', () => {
    scenario('Removing a number drops the key', () => {
      proveTheServiceConfigGroupCanOnlyRemoveANonStringIgnoreCommentsValue105();
    });
    scenario('Closing keeps the number', () => {
      proveTheServiceConfigGroupCanOnlyRemoveANonStringIgnoreCommentsValue105();
    });
  });
  requirement('A service config that does not parse hides that checkout', () => {
    scenario('One broken file hides only its cards', () => {
      proveTheServiceConfigGroupHasNoFieldsWhenTheFileDoesNotParseAndOnlyThatCheckoutLosesItsCards106();
    });
    scenario('The group does not rewrite a file that does not parse', () => {
      proveTheServiceConfigGroupHasNoFieldsWhenTheFileDoesNotParseAndOnlyThatCheckoutLosesItsCards106();
    });
  });
  requirement('A missing service config keeps the card', () => {
    scenario('A missing file leaves the card', () => {
      proveTheServiceConfigGroupCreatesAMissingFileFromTheQueueTheManagerAdds108();
    });
    scenario('Save creates the file', () => {
      proveTheServiceConfigGroupCreatesAMissingFileFromTheQueueTheManagerAdds108();
    });
  });
});
