import assert from 'node:assert/strict';
import {existsSync, rmSync} from 'node:fs';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {serveBoard} from './page.ts';
import {formsOf, pageHtml, post} from './page.harness.ts';
import {FACTORY_AGENTS} from './types.ts';
import {openWindow} from './window.ts';
import {scratch} from './window.harness.ts';

function agentOptions(html: string): string[] {
  const homeStart = html.indexOf('<h3>Дом</h3>');
  assert.ok(homeStart >= 0);
  const roles = html.indexOf('<div class="roles">', homeStart);
  const home = roles > homeStart ? html.slice(homeStart, roles) : html.slice(homeStart);
  const form = formsOf(home).find(item => item.includes('value="choose-agent"'));
  assert.ok(form, 'home choose-agent form');
  return [...form.matchAll(/<option[^>]*value="([^"]*)"[^>]*>/g)].map(match => match[1]);
}

spec('home-agent', () => {
  requirement('The agent field is empty until an agent is saved', () => {
    scenario('The field is empty until an agent is saved', async () => {
      const {dir, home} = scratch();
      const window = openWindow({homePath: home});
      assert.equal(existsSync(home), false);
      assert.equal(window.settings().agent, '');
      assert.deepEqual(window.board().rows, [{text: 'фабрике ещё нужен агент'}]);
      assert.equal(window.board().stepsStart, false);
      assert.equal(window.board().takeDisabled, true);

      const page = await serveBoard(window);
      try {
        assert.equal(
          (await post(page.url, 'act', new URLSearchParams({act: 'open-settings'}).toString()))
            .status,
          200,
        );
        assert.equal(existsSync(home), false);
        assert.equal(window.settings().agent, '');
        assert.equal(window.settings().open, true);

        const html = await pageHtml(page.url);
        assert.deepEqual(agentOptions(html), ['', ...FACTORY_AGENTS]);
        const agentForm = formsOf(html).find(item => item.includes('value="choose-agent"'));
        assert.ok(agentForm);
        assert.match(agentForm, /<option[^>]*value=""[^>]*>\s*<\/option>/);

        window.take('1');
        assert.equal(existsSync(home), false);
      } finally {
        await page.close();
      }
      rmSync(dir, {recursive: true, force: true});
    });
  });
});
