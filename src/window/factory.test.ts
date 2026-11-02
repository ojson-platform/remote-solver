import assert from 'node:assert/strict';
import {readFileSync, rmSync} from 'node:fs';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {openWindow} from './window.ts';
import {readHome, scratch} from './window.harness.ts';

spec('home-agent', () => {
  requirement('Choosing an agent writes the known pair', () => {
    scenario('Choosing an agent writes the home file at once', () => {
      const {dir, home} = scratch();
      const window = openWindow({homePath: home});
      assert.equal(window.settings().agent, '');
      window.chooseAgent('codex');
      const doc = readHome(home);
      assert.equal(doc.agent, 'codex');
      assert.equal(doc.models?.mechanical, 'gpt-6-luna');
      assert.equal(doc.models?.judgment, 'gpt-6.1-sol');
      assert.equal(doc.effort?.mechanical, 'low');
      assert.equal(doc.effort?.judgment, 'high');
      assert.equal(doc.speed, undefined);
      assert.equal(window.settings().agent, 'codex');
      assert.equal(window.settings().models.mechanical.value, 'gpt-6-luna');
      assert.equal(window.settings().models.judgment.value, 'gpt-6.1-sol');
      rmSync(dir, {recursive: true, force: true});
    });

    scenario('Choosing the saved agent again changes nothing', () => {
      const {dir, home} = scratch();
      const window = openWindow({homePath: home});
      window.chooseAgent('cursor');
      window.leaveModel('mechanical', 'custom-mechanical');
      const before = readFileSync(home, 'utf8');
      window.chooseAgent('cursor');
      assert.equal(readFileSync(home, 'utf8'), before);
      assert.equal(readHome(home).models?.mechanical, 'custom-mechanical');
      rmSync(dir, {recursive: true, force: true});
    });
  });
});
