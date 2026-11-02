import assert from 'node:assert/strict';
import {existsSync, readFileSync, rmSync} from 'node:fs';

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
import {
  assertNoEmptyStrings,
  homeRoles,
  proveChoosingCursorWritesItsPairAndOmitsEffortAndSpeed2,
  readHome,
  scratch,
} from './window.harness.ts';

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
  requirement('Choosing an agent writes the known pair at once', () => {
    scenario('Cursor writes its pair and the board turns on', async () => {
      proveChoosingCursorWritesItsPairAndOmitsEffortAndSpeed2();
      const {dir, home} = scratch();
      const window = openWindow(
        {homePath: home},
        {login: () => MANAGER, tickets: () => [bare('1', 'Quiet')]},
      );
      assert.deepEqual(window.board().rows, [{text: 'фабрике ещё нужен агент'}]);
      assert.equal(window.board().takeDisabled, true);
      window.chooseAgent('cursor');
      assert.equal(window.board().stepsStart, true);
      assert.deepEqual(window.board().rows, []);
      assert.equal(window.board().takeDisabled, false);
      await hosted(
        {login: () => MANAGER, tickets: () => [bare('1', 'Quiet')]},
        async page => {
          assert.equal(
            (
              await post(
                page.url,
                'act',
                new URLSearchParams({act: 'choose-agent', agent: 'cursor'}).toString(),
              )
            ).status,
            200,
          );
        },
      );
      rmSync(dir, {recursive: true, force: true});
    });
    scenario('Codex writes its pair and effort', () => {
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
      rmSync(dir, {recursive: true, force: true});
    });
    scenario('Claude-code writes its pair and effort', () => {
      const {dir, home} = scratch();
      const window = openWindow({homePath: home});
      window.chooseAgent('claude-code');
      const doc = readHome(home);
      assert.equal(doc.agent, 'claude-code');
      assert.equal(doc.models?.mechanical, 'sonnet');
      assert.equal(doc.models?.judgment, 'opus');
      assert.deepEqual(doc.effort, {mechanical: 'medium', judgment: 'medium'});
      assert.equal(doc.speed, undefined);
      assertNoEmptyStrings(doc);
      rmSync(dir, {recursive: true, force: true});
    });
    scenario('OpenCode writes its pair', () => {
      const {dir, home} = scratch();
      const window = openWindow({homePath: home});
      window.chooseAgent('opencode');
      const doc = readHome(home);
      assert.equal(doc.agent, 'opencode');
      assert.equal(doc.models?.mechanical, 'moonshotai/kimi-k2.7-code');
      assert.equal(doc.models?.judgment, 'moonshotai/kimi-k3');
      assert.equal(doc.effort, undefined);
      assert.equal(doc.speed, undefined);
      assertNoEmptyStrings(doc);
      rmSync(dir, {recursive: true, force: true});
    });
    scenario('A catalog does not change the pair', () => {
      const {dir, home} = scratch();
      let reads = 0;
      const window = openWindow(
        {homePath: home},
        {
          catalog: () => {
            reads += 1;
            return {mechanical: 'other-mechanical', judgment: 'other-judgment'};
          },
        },
      );
      window.chooseAgent('cursor');
      assert.equal(reads, 0);
      const doc = readHome(home);
      assert.equal(doc.models?.mechanical, 'composer-2.5-fast');
      assert.equal(doc.models?.judgment, 'grok-4.7-high-fast');
      rmSync(dir, {recursive: true, force: true});
    });
    scenario('Choosing the saved agent again changes nothing', () => {
      const {dir, home} = scratch();
      const window = openWindow({homePath: home});
      window.chooseAgent('cursor');
      window.leaveModel('mechanical', '');
      const before = readFileSync(home, 'utf8');
      window.chooseAgent('cursor');
      assert.equal(readFileSync(home, 'utf8'), before);
      assert.equal(readHome(home).models?.mechanical, '');
      rmSync(dir, {recursive: true, force: true});
    });
    scenario('An empty offer writes nothing', () => {
      const {dir, home} = scratch();
      const window = openWindow({homePath: home, agents: []});
      window.chooseAgent('cursor');
      assert.equal(existsSync(home), false);
      assert.deepEqual(window.board().rows, [{text: 'фабрике ещё нужен агент'}]);
      rmSync(dir, {recursive: true, force: true});
    });
    scenario('No home file path writes nothing', () => {
      let assignees = 0;
      const window = openWindow(
        {},
        {
          login: () => MANAGER,
          tickets: () => [bare('1', 'Quiet')],
          writeAssignee: () => {
            assignees += 1;
          },
        },
      );
      window.chooseAgent('cursor');
      assert.deepEqual(window.board().rows, [{text: 'фабрике ещё нужен агент'}]);
      assert.equal(window.board().takeDisabled, true);
      window.take('1');
      assert.equal(assignees, 0);
    });
  });
  requirement('The same submit can add a role', () => {
    scenario('A named role is added without the home agent', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [bare('1', 'Quiet')]},
        async (page, window, {home}) => {
          window.openSettings();
          window.chooseAgent('codex');
          const agentBefore = readHome(home).agent;
          assert.equal(
            (
              await post(
                page.url,
                'act',
                new URLSearchParams({
                  act: 'add-role',
                  name: 'editor',
                  outcome: 'html',
                  text: 'role body',
                }).toString(),
              )
            ).status,
            200,
          );
          assert.deepEqual(homeRoles(home), [{name: 'editor', outcome: 'html', text: 'role body'}]);
          assert.equal(readHome(home).agent, agentBefore);
        },
      );
    });
    scenario('An empty role name adds no role', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [bare('1', 'Quiet')]},
        async (page, window, {home}) => {
          window.openSettings();
          window.chooseAgent('cursor');
          const rolesBefore = homeRoles(home);
          const agentBefore = readHome(home).agent;
          assert.equal(
            (
              await post(
                page.url,
                'act',
                new URLSearchParams({
                  act: 'add-role',
                  name: '',
                  outcome: 'html',
                  text: 'ignored',
                }).toString(),
              )
            ).status,
            200,
          );
          assert.deepEqual(homeRoles(home), rolesBefore);
          assert.equal(readHome(home).agent, agentBefore);
        },
      );
    });
    scenario('Choosing the home agent adds no role', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [bare('1', 'Quiet')]},
        async (page, _window, {home}) => {
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
          assert.equal(
            (
              await post(
                page.url,
                'act',
                new URLSearchParams({
                  act: 'choose-agent',
                  agent: 'cursor',
                  name: 'editor',
                  outcome: 'html',
                  text: 'draft',
                }).toString(),
              )
            ).status,
            200,
          );
          assert.equal(homeRoles(home).length, 0);
          assert.equal(readHome(home).agent, 'cursor');
        },
      );
    });
  });
});
