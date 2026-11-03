import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {serveBoard} from './page.ts';
import {formsOf, git, pageHtml, post} from './page.harness.ts';
import {FACTORY_AGENTS} from './types.ts';
import {openWindow} from './window.ts';
import {
  readHome,
  scratch,
  ticket,
  writeLaunch,
  writeOverlay,
  writeServiceConfig,
  yard,
} from './window.harness.ts';

function overlayPath(checkout: string): string {
  return path.join(checkout, '.aifactory', 'config.yaml');
}

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

  requirement('Choosing the saved agent again changes nothing', () => {
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

    scenario('Choosing the saved agent again changes nothing', async () => {
      const {dir, home} = scratch();
      const window = openWindow({homePath: home});

      const page = await serveBoard(window);
      try {
        await choose(page.url, 'cursor');
        window.leaveModel('mechanical', 'custom-mechanical');
        const diskBefore = readFileSync(home, 'utf8');
        await choose(page.url, 'cursor');
        assert.equal(readFileSync(home, 'utf8'), diskBefore);
        const doc = readHome(home);
        assert.equal(doc.agent, 'cursor');
        assert.equal(doc.models?.mechanical, 'custom-mechanical');
        assert.equal(window.settings().agent, 'cursor');
        assert.equal(window.settings().models.mechanical.value, 'custom-mechanical');
      } finally {
        await page.close();
      }
      rmSync(dir, {recursive: true, force: true});
    });
  });

  requirement('The layer agent does not record the home agent', () => {
    function trackerWindow(home: string, arcadia: string) {
      const checkout = path.join(arcadia, 'services', 'billing');
      mkdirSync(checkout, {recursive: true});
      writeServiceConfig(checkout, ['alpha']);
      writeLaunch(home, ['alpha'], {arcadia});
      return {
        checkout,
        window: openWindow(
          {homePath: home, adapter: 'tracker'},
          {tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})]},
        ),
      };
    }

    scenario('An overlay agent leaves the factory needing an agent', async () => {
      const {dir, home, arcadia} = yard();
      const {checkout, window} = trackerWindow(home, arcadia);
      assert.equal(readHome(home).agent, undefined);

      window.openSettings();
      window.chooseOverlayAgent('cursor');
      const overlay = readHome(overlayPath(checkout));
      assert.equal(overlay.agent, 'cursor');
      assert.equal(overlay.models?.mechanical, 'composer-2.5-fast');
      assert.equal(overlay.models?.judgment, 'grok-4.7-high-fast');
      assert.equal(overlay.effort, undefined);
      assert.equal(overlay.speed, undefined);
      assert.equal(readHome(home).agent, undefined);
      assert.deepEqual(window.board().rows, [{text: 'фабрике ещё нужен агент'}]);
      assert.equal(window.board().stepsStart, false);
      assert.equal(window.board().takeDisabled, true);
      rmSync(dir, {recursive: true, force: true});
    });

    scenario('агент слоя remains the override for that one checkout', async () => {
      const {dir, home, arcadia} = yard();
      const {checkout, window} = trackerWindow(home, arcadia);
      writeOverlay(checkout, ['alpha'], 'agent: cursor\n');
      window.openSettings();
      assert.equal(window.overlay().agent, 'cursor');
      window.clearOverlayAgent();
      assert.equal(readHome(overlayPath(checkout)).agent, undefined);
      assert.equal(window.overlay().agent, '');
      rmSync(dir, {recursive: true, force: true});
    });

    scenario('Empty means the home agent', async () => {
      const {dir, home, arcadia} = yard();
      const {checkout, window} = trackerWindow(home, arcadia);
      window.chooseAgent('cursor');
      window.openSettings();
      assert.equal(window.overlay().agent, '');
      assert.equal(window.overlay().models.mechanical.value, 'composer-2.5-fast');
      assert.equal(window.overlay().models.judgment.value, 'grok-4.7-high-fast');
      window.chooseOverlayAgent('cursor');
      assert.equal(readHome(overlayPath(checkout)).agent, 'cursor');
      rmSync(dir, {recursive: true, force: true});
    });

    scenario(
      'Choosing cursor on агент слоя writes the known pair and drops old effort and speed',
      async () => {
        const {dir, home, arcadia} = yard();
        const checkout = path.join(arcadia, 'services', 'billing');
        mkdirSync(checkout, {recursive: true});
        writeServiceConfig(checkout, ['alpha']);
        writeFileSync(
          home,
          [
            'agent: codex',
            'models:',
            '  mechanical: gpt-6-luna',
            '  judgment: gpt-6.1-sol',
            'effort:',
            '  mechanical: low',
            '  judgment: high',
            'watch:',
            '  - alpha',
            'roots:',
            `  arcadia: ${arcadia}`,
            '',
          ].join('\n'),
        );
        writeOverlay(
          checkout,
          ['alpha'],
          [
            'models:',
            '  mechanical: custom-mechanical',
            '  judgment: custom-judgment',
            'effort:',
            '  mechanical: max',
            'speed:',
            '  mechanical: fast',
            '',
          ].join('\n'),
        );
        const window = openWindow(
          {homePath: home, adapter: 'tracker'},
          {tickets: () => [ticket({key: '1', queue: 'alpha', sddService: 'services/billing'})]},
        );
        window.openSettings();
        window.chooseOverlayAgent('cursor');
        const overlay = readHome(overlayPath(checkout));
        assert.equal(overlay.agent, 'cursor');
        assert.equal(overlay.models?.mechanical, 'composer-2.5-fast');
        assert.equal(overlay.models?.judgment, 'grok-4.7-high-fast');
        assert.equal(overlay.effort, undefined);
        assert.equal(overlay.speed, undefined);
        const homeDoc = readHome(home);
        assert.equal(homeDoc.agent, 'codex');
        assert.equal(homeDoc.models?.mechanical, 'gpt-6-luna');
        assert.equal(homeDoc.models?.judgment, 'gpt-6.1-sol');
        assert.deepEqual(homeDoc.effort, {mechanical: 'low', judgment: 'high'});
        rmSync(dir, {recursive: true, force: true});
      },
    );

    scenario('The overlay models, effort, and speed keep following the merged factory', async () => {
      const {dir, home, arcadia} = yard();
      const {checkout, window} = trackerWindow(home, arcadia);
      window.chooseAgent('cursor');
      writeOverlay(
        checkout,
        ['alpha'],
        ['models:', '  mechanical: custom-mechanical', '  judgment: custom-judgment', ''].join(
          '\n',
        ),
      );
      window.openSettings();
      assert.equal(window.overlay().agent, '');
      assert.equal(window.overlay().models.mechanical.value, 'custom-mechanical');
      assert.equal(window.overlay().models.judgment.value, 'custom-judgment');
      rmSync(dir, {recursive: true, force: true});
    });

    scenario('An empty агент слоя keeps recorded effort and speed', async () => {
      const {dir, home, arcadia} = yard();
      const {checkout, window} = trackerWindow(home, arcadia);
      window.chooseAgent('cursor');
      writeOverlay(
        checkout,
        ['alpha'],
        [
          'models:',
          '  mechanical: custom-mechanical',
          '  judgment: custom-judgment',
          'effort:',
          '  mechanical: max',
          'speed:',
          '  mechanical: fast',
          '',
        ].join('\n'),
      );
      window.openSettings();
      assert.equal(window.overlay().agent, '');
      assert.deepEqual(window.overlay().effort, {mechanical: 'max', judgment: ''});
      assert.deepEqual(window.overlay().speed, {mechanical: 'fast', judgment: ''});
      rmSync(dir, {recursive: true, force: true});
    });

    scenario('The checkout overlay stays out of the repository', async () => {
      const {dir, home, arcadia} = yard();
      const {checkout, window} = trackerWindow(home, arcadia);
      git(checkout, ['init', '-b', 'master']);
      git(checkout, ['config', 'user.email', 'test@example.com']);
      git(checkout, ['config', 'user.name', 'Test']);
      writeFileSync(path.join(checkout, '.gitignore'), '.aifactory/\n');
      git(checkout, ['add', 'openspec', '.gitignore']);
      git(checkout, ['commit', '-m', 'init']);
      window.openSettings();
      window.chooseOverlayAgent('cursor');
      assert.equal(existsSync(overlayPath(checkout)), true);
      const status = execFileSync('git', ['status', '--porcelain'], {
        cwd: checkout,
        encoding: 'utf8',
      }).trim();
      assert.equal(status, '');
      rmSync(dir, {recursive: true, force: true});
    });
  });
});
