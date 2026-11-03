import assert from 'node:assert/strict';
import {existsSync, rmSync} from 'node:fs';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {serveBoard} from './page.ts';
import {formsOf, pageHtml, post} from './page.harness.ts';
import {FACTORY_AGENTS} from './types.ts';
import {openWindow} from './window.ts';
import {readHome, scratch} from './window.harness.ts';

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

  requirement('Choosing an agent writes the home file at once', () => {
    async function choose(pageUrl: string, agent: string): Promise<void> {
      assert.equal(
        (
          await post(
            pageUrl,
            'act',
            new URLSearchParams({act: 'choose-agent', agent}).toString(),
          )
        ).status,
        200,
      );
    }

    scenario('Choosing an agent writes the home file at once with that agent\'s known pair', async () => {
      const {dir, home} = scratch();
      const window = openWindow({homePath: home});
      assert.equal(existsSync(home), false);

      const page = await serveBoard(window);
      try {
        await choose(page.url, 'cursor');
        assert.equal(existsSync(home), true);
        const doc = readHome(home);
        assert.equal(doc.agent, 'cursor');
        assert.equal(doc.models?.mechanical, 'composer-2.5-fast');
        assert.equal(doc.models?.judgment, 'grok-4.7-high-fast');
        assert.equal(doc.effort, undefined);
        assert.equal(doc.speed, undefined);
        assert.deepEqual(window.board().rows, []);
        assert.equal(window.board().stepsStart, true);
      } finally {
        await page.close();
      }
      rmSync(dir, {recursive: true, force: true});
    });

    scenario('Choosing codex writes its known pair at once', async () => {
      const {dir, home} = scratch();
      const window = openWindow({homePath: home});

      const page = await serveBoard(window);
      try {
        await choose(page.url, 'codex');
        const doc = readHome(home);
        assert.equal(doc.agent, 'codex');
        assert.equal(doc.models?.mechanical, 'gpt-6-luna');
        assert.equal(doc.models?.judgment, 'gpt-6.1-sol');
        assert.deepEqual(doc.effort, {mechanical: 'low', judgment: 'high'});
        assert.equal(doc.speed, undefined);
        assert.deepEqual(window.board().rows, []);
        assert.equal(window.board().stepsStart, true);
      } finally {
        await page.close();
      }
      rmSync(dir, {recursive: true, force: true});
    });

    scenario('Choosing a different agent writes that agent\'s known pair at once', async () => {
      const {dir, home} = scratch();
      const window = openWindow({homePath: home});

      const page = await serveBoard(window);
      try {
        await choose(page.url, 'cursor');
        await choose(page.url, 'codex');
        const doc = readHome(home);
        assert.equal(doc.agent, 'codex');
        assert.equal(doc.models?.mechanical, 'gpt-6-luna');
        assert.equal(doc.models?.judgment, 'gpt-6.1-sol');
        assert.deepEqual(doc.effort, {mechanical: 'low', judgment: 'high'});
        assert.equal(doc.speed, undefined);
        assert.equal(doc.models?.mechanical, 'gpt-6-luna');
        assert.notEqual(doc.models?.mechanical, 'composer-2.5-fast');
      } finally {
        await page.close();
      }
      rmSync(dir, {recursive: true, force: true});
    });
  });
});
