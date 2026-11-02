import assert from 'node:assert/strict';
import {existsSync, rmSync, writeFileSync} from 'node:fs';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {between, formsOf, hosted, pageHtml, post, prepare, yard} from './page.harness.ts';
import {serveBoard} from './page.ts';
import {readHome, scratch} from './window.harness.ts';
import {openWindow} from './window.ts';

function homeBlockOf(html: string): string {
  return between(html, '<h3>Дом</h3>', '<div class="roles">');
}

function homeAgentForm(html: string): string {
  const block = homeBlockOf(html);
  const form = formsOf(block).find(
    item => item.includes('value="choose-agent"') && item.includes('name="agent"'),
  );
  assert.ok(form, 'home agent form');
  return form;
}

function newRoleForm(html: string): string {
  const form = formsOf(html).find(item => item.includes('placeholder="имя"'));
  assert.ok(form, 'new-role form');
  return form;
}

function proveTheAgentFieldSitsAboveTheModels(): void {
  const {dir, home} = scratch();
  const window = openWindow({homePath: home});
  window.openSettings();
  assert.equal(existsSync(home), false);
  assert.equal(window.settings().agent, '');
  window.closeSettings();
  rmSync(dir, {recursive: true, force: true});
}

function proveNothingSavedLeavesTheFieldEmpty(): void {
  const {dir, home} = scratch();
  const window = openWindow({homePath: home});
  window.openSettings();
  assert.equal(window.settings().agent, '');
  window.closeSettings();
  rmSync(dir, {recursive: true, force: true});
}

spec('home-agent', () => {
  requirement('The home block has its own agent field above the models', () => {
    scenario('The agent field sits above the models', () => {
      proveTheAgentFieldSitsAboveTheModels();
    });
  });
  requirement('The field is empty until an agent is saved', () => {
    scenario('Nothing saved leaves the field empty', () => {
      proveNothingSavedLeavesTheFieldEmpty();
    });
  });
});

spec('home-agent', () => {
  requirement('The home block has its own agent field above the models', () => {
    scenario('The agent field sits above the models', async () => {
      await hosted({tickets: () => []}, async (page, _window, paths) => {
        assert.equal(readHome(paths.home).agent, undefined);
        await post(page.url, 'act', new URLSearchParams({act: 'open-settings'}).toString());
        const sheet = await pageHtml(page.url);
        const block = homeBlockOf(sheet);
        const labels = [...block.matchAll(/<label(?:[^>]*)>([^<]+)<\/label>/g)].map(match =>
          match[1].trim(),
        );
        assert.deepEqual(labels.slice(0, 6), [
          'агент',
          'mechanical',
          'judgment',
          'список наблюдения',
          'arcadia',
          'github',
        ]);
        assert.equal(newRoleForm(sheet).includes('<label>агент</label>'), false);
      });
    });
    scenario('A filled name stores the role and not an agent', async () => {
      await hosted({tickets: () => []}, async (page, _window, paths) => {
        assert.equal(readHome(paths.home).agent, undefined);
        await post(page.url, 'act', new URLSearchParams({act: 'open-settings'}).toString());
        const sheet = await pageHtml(page.url);
        assert.match(newRoleForm(sheet), /value="add-role"/);
        await post(
          page.url,
          'act',
          new URLSearchParams({
            act: 'add-role',
            name: 'Page',
            outcome: 'html',
            text: '<p>hi</p>',
          }).toString(),
        );
        const doc = readHome(paths.home);
        assert.equal(doc.agent, undefined);
        assert.deepEqual(doc.roles, [{name: 'Page', outcome: 'html', text: '<p>hi</p>'}]);
      });
    });
    scenario('An empty name stores no role', async () => {
      await hosted({tickets: () => []}, async (page, _window, paths) => {
        assert.equal(readHome(paths.home).agent, undefined);
        await post(
          page.url,
          'act',
          new URLSearchParams({
            act: 'add-role',
            name: '',
            outcome: 'html',
            text: 'draft',
          }).toString(),
        );
        const doc = readHome(paths.home);
        assert.equal(doc.agent, undefined);
        assert.equal(doc.roles, undefined);
      });
    });
  });
  requirement('The field is empty until an agent is saved', () => {
    scenario('Nothing saved leaves the field empty', async () => {
      await hosted({tickets: () => []}, async (page, window, paths) => {
        assert.equal(readHome(paths.home).agent, undefined);
        window.openSettings();
        assert.equal(window.settings().agent, '');
        const select = homeAgentForm(await pageHtml(page.url)).match(
          /<select[^>]*name="agent"[^>]*>[\s\S]*?<\/select>/,
        )?.[0];
        assert.ok(select);
        assert.match(select, /<option[^>]*value=""[^>]*selected/);
        assert.doesNotMatch(select, /value="cursor"[^>]*selected/);
      });
    });
    scenario('A saved agent is shown', async () => {
      const {dir, home, arcadia} = yard();
      try {
        prepare(arcadia, home);
        writeFileSync(
          home,
          [
            'agent: cursor',
            'models:',
            '  mechanical: composer-2.5-fast',
            '  judgment: grok-4.7-high-fast',
            'watch:',
            '  - alpha',
            `roots:`,
            `  arcadia: ${arcadia}`,
            '',
          ].join('\n'),
        );
        assert.equal(readHome(home).agent, 'cursor');
        const window = openWindow({homePath: home, adapter: 'tracker'}, {tickets: () => []});
        const page = await serveBoard(window);
        try {
          window.openSettings();
          assert.equal(window.settings().agent, 'cursor');
          const select = homeAgentForm(await pageHtml(page.url)).match(
            /<select[^>]*name="agent"[^>]*>[\s\S]*?<\/select>/,
          )?.[0];
          assert.ok(select);
          assert.match(select, /value="cursor"[^>]*selected/);
          assert.doesNotMatch(select, /<option[^>]*value=""[^>]*selected/);
        } finally {
          await page.close();
        }
      } finally {
        rmSync(dir, {recursive: true, force: true});
      }
    });
  });
});
