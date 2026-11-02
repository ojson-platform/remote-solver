import assert from 'node:assert/strict';
import {existsSync, rmSync} from 'node:fs';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {
  MANAGER,
  bare,
  between,
  formsOf,
  hosted,
  pageHtml,
  post,
} from './page.harness.ts';
import {FACTORY_AGENTS} from './types.ts';
import {openWindow} from './window.ts';
import {scratch} from './window.harness.ts';

function homeBlock(html: string): string {
  return between(html, '<h3>Дом</h3>', '<div class="stack">');
}

function chooseAgentForm(html: string): string {
  const form = formsOf(homeBlock(html)).find(item => item.includes('value="choose-agent"'));
  assert.ok(form, 'home choose-agent form');
  return form;
}

function addRoleForm(html: string): string {
  const form = formsOf(homeBlock(html)).find(item => item.includes('class="add"'));
  assert.ok(form, 'add-role form');
  return form;
}

function agentSelect(form: string): string {
  const match = form.match(/<select[^>]*name="agent"[\s\S]*?<\/select>/);
  assert.ok(match?.[0], 'agent select');
  return match[0];
}

spec('home-agent', () => {
  requirement('The home block chooses the agent', () => {
    scenario('The home block has its own agent field above the models', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [bare('1', 'Quiet')]},
        async page => {
          assert.equal(
            (
              await post(
                page.url,
                'act',
                new URLSearchParams({act: 'open-settings'}).toString(),
              )
            ).status,
            200,
          );
          const html = await pageHtml(page.url);
          const block = homeBlock(html);
          const agentForm = chooseAgentForm(html);
          assert.match(agentForm, />агент</);
          const agentAt = block.indexOf('value="choose-agent"');
          const modelAt = block.indexOf('value="leave-model"');
          assert.ok(agentAt >= 0 && modelAt > agentAt);
          const add = addRoleForm(html);
          assert.equal(add.includes('name="agent"'), false);
          assert.match(block, /список наблюдения/);
          assert.match(block, /arcadia/);
          assert.match(block, /github/);
        },
      );
    });
  });
  requirement('The agent list has no empty option', () => {
    scenario('The field is empty until an agent is saved', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [bare('1', 'Quiet')]},
        async (page, window) => {
          window.openSettings();
          assert.equal(window.settings().agent, '');
          const html = await pageHtml(page.url);
          const select = agentSelect(chooseAgentForm(html));
          assert.match(select, /value="" disabled="" hidden=""/);
          assert.doesNotMatch(select, /value="cursor"[^>]*selected/);
          assert.equal(select.includes('>cursor</option>'), true);
          for (const agent of FACTORY_AGENTS) {
            assert.equal(select.includes(`>${agent}</option>`), true);
          }
          const emptyOffers = [...select.matchAll(/<option value="">([^>]*)>/g)].filter(
            match => !match[1].includes('disabled'),
          );
          assert.equal(emptyOffers.length, 0);
        },
      );
    });
    scenario('Opening settings does not save the first option', () => {
      const {dir, home} = scratch();
      const window = openWindow({homePath: home});
      assert.equal(window.settings().agent, '');
      window.openSettings();
      assert.equal(window.settings().agent, '');
      window.closeSettings();
      assert.equal(existsSync(home), false);
      assert.equal(window.settings().agent, '');
      rmSync(dir, {recursive: true, force: true});
    });
  });
});
