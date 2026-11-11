import assert from 'node:assert/strict';
import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {
  MANAGER,
  bare,
  formsOf,
  hosted,
  pageHtml,
  post,
} from '../__tests__/page.harness.ts';

function homeBeforeRoles(html: string): string {
  const start = html.indexOf('<h3>Дом</h3>');
  assert.ok(start >= 0, 'Дом');
  const roles = html.indexOf('<div class="roles">', start);
  assert.ok(roles > start, 'roles');
  return html.slice(start, roles);
}

spec('home-agent', () => {
  requirement('The home block has its own agent field above the models', () => {
    scenario(
      'The home block has its own agent field above the models and the new-role form does not',
      async () => {
        await hosted({login: () => MANAGER, tickets: () => [bare('1', 'Quiet')]}, async page => {
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open-settings'}).toString()))
              .status,
            200,
          );
          const sheet = await pageHtml(page.url);
          const home = homeBeforeRoles(sheet);
          const agentForm = formsOf(home).find(form => form.includes('value="choose-agent"'));
          assert.ok(agentForm, 'home choose-agent form');
          assert.match(agentForm, /<label>агент<\/label>/);
          const agentAt = home.indexOf('value="choose-agent"');
          const modelAt = home.indexOf('value="leave-model"');
          assert.ok(agentAt >= 0 && modelAt > agentAt, 'агент above models');
          assert.ok(home.includes('список наблюдения'));
          assert.ok(home.indexOf('список наблюдения') > agentAt);
          assert.ok(home.includes('value="leave-roots"'));
          assert.ok(home.indexOf('value="leave-roots"') > agentAt);

          const addForm = formsOf(sheet).find(form => form.includes('class="add"'));
          assert.ok(addForm);
          assert.match(addForm, /value="add-role"/);
          assert.doesNotMatch(addForm, /name="agent"/);
          assert.match(addForm, /name="name"/);
          assert.match(addForm, /name="outcome"/);
          assert.match(addForm, /name="text"/);
          assert.match(addForm, />Добавить</);

          const added = await post(
            page.url,
            'act',
            new URLSearchParams({
              act: 'add-role',
              name: 'editor',
              outcome: 'html',
              text: 'черновик',
            }).toString(),
          );
          assert.equal(added.status, 200);
          const after = await pageHtml(page.url);
          assert.match(after, /черновик/);
          assert.match(after, /value="editor"/);
        });
      },
    );
  });
});
