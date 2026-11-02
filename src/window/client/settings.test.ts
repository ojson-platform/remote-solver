import assert from 'node:assert/strict';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {MANAGER, bare, formsOf, hosted, post, readSnapshot} from '../page.harness.ts';
import {renderWindow} from './render.ts';

function homeDom(html: string): string {
  const start = html.indexOf('<h3>Дом</h3>');
  assert.ok(start >= 0);
  const roles = html.indexOf('<h3>Роли</h3>', start);
  return html.slice(start, roles === -1 ? html.length : roles);
}

function addRoleForm(html: string): string {
  const form = formsOf(html).find(item => item.includes('class="add"'));
  assert.ok(form);
  return form;
}

function homeAgentForm(html: string): string {
  const form = formsOf(homeDom(html)).find(item => item.includes('value="choose-agent"'));
  assert.ok(form);
  return form;
}

spec('home-agent', () => {
  requirement('The home agent field is on the home block', () => {
    scenario('The home block has its own agent field above the models', async () => {
      await hosted({login: () => MANAGER, tickets: () => [bare('1', 'Quiet')]}, async page => {
        assert.equal(
          (await post(page.url, 'act', new URLSearchParams({act: 'open-settings'}).toString()))
            .status,
          200,
        );
        const shot = await readSnapshot(page.url);
        assert.equal(shot.settings.open, true);
        assert.equal(shot.settings.agent, '');
        const html = renderWindow(shot);
        const home = homeDom(html);
        const agentAt = home.indexOf('value="choose-agent"');
        const mechanicalAt = home.indexOf('>mechanical<');
        assert.ok(agentAt >= 0 && mechanicalAt > agentAt);
        assert.match(home, /список наблюдения/);
        assert.match(home, /name="arcadia"/);
        assert.match(home, /name="github"/);
        const addForm = addRoleForm(html);
        assert.doesNotMatch(addForm, /name="agent"/);
        assert.match(addForm, /value="add-role"/);
      });
    });

    scenario('The field is empty until an agent is saved', async () => {
      await hosted({login: () => MANAGER, tickets: () => [bare('1', 'Quiet')]}, async page => {
        assert.equal(
          (await post(page.url, 'act', new URLSearchParams({act: 'open-settings'}).toString()))
            .status,
          200,
        );
        const shot = await readSnapshot(page.url);
        assert.equal(shot.settings.agent, '');
        const agentForm = homeAgentForm(renderWindow(shot));
        assert.match(agentForm, /<option[^>]*value=""[^>]*selected/);
        assert.doesNotMatch(agentForm, /value="cursor"[^>]*selected/);
      });
    });
  });
});
