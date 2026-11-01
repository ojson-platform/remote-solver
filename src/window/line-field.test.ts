import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {requirement, scenario, spec} from '@ojson/spec-coverage';
import {draftsAfterClick, lineFieldClosesOnEscape} from './page.ts';
import {
  MANAGER,
  bandOf,
  held,
  hosted,
  pageHtml,
  post,
  writeChange,
} from './page.harness.ts';

spec('line-field', () => {
  requirement('A line field opens on a document line', () => {
    scenario('A typed line comment stays when another line opens', () => {
      assert.deepEqual(draftsAfterClick([{line: 'первая', text: 'черновик'}], 'вторая'), [
        {line: 'первая', text: 'черновик'},
        {line: 'вторая', text: ''},
      ]);
    });
    scenario('An empty line field closes when another line opens', () => {
      assert.deepEqual(draftsAfterClick([{line: 'первая', text: '   '}], 'вторая'), [
        {line: 'вторая', text: ''},
      ]);
    });
    scenario('An empty line field closes when its line is clicked again', () => {
      assert.deepEqual(draftsAfterClick([{line: 'первая', text: ''}], 'первая'), []);
      assert.deepEqual(draftsAfterClick([{line: 'первая', text: '  '}], 'первая'), []);
    });
    scenario('A typed line comment stays when its line is clicked again', () => {
      assert.deepEqual(draftsAfterClick([{line: 'первая', text: 'черновик'}], 'первая'), [
        {line: 'первая', text: 'черновик'},
      ]);
    });
    scenario('A line field uses the pool frame', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'proposing', {openPullRequests: 1})]},
        async (page, window, paths) => {
          writeChange(paths.arcadia, '1', 'proposal.md', '## Scope\n\nСтрока.\n');
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const html = await pageHtml(page.url);
          assert.match(
            html,
            /\.spine form\.line-note textarea,\s*\.spine \.plan-foot textarea\s*\{/,
          );
          assert.match(
            html,
            /\.spine form\.line-note textarea:focus,\s*\.spine \.plan-foot textarea:focus\s*\{[^}]*rgba\(230, 179, 90, 0\.45\)/,
          );
          assert.match(html, /\.spine form\.line-note\s*\{[^}]*position:\s*relative[^}]*margin:\s*18px 10px 8px/);
          assert.match(html, /\.spine \.shut\s*\{[^}]*border-radius:\s*50%/);
          assert.match(bandOf(html, '1'), /class="shut"[^>]*aria-label="Закрыть"/);
          assert.match(bandOf(html, '1'), /class="send"[^>]*aria-label="Записать"/);
        },
      );
    });
    scenario('A hovered line draws no bar on the left', () => {
      const css = readFileSync(new URL('./face.css', import.meta.url), 'utf8');
      assert.match(
        css,
        /\.spine button\.line:hover,\s*\.spine button\.line\.is-on\s*\{[^}]*background-image:/,
      );
      assert.doesNotMatch(
        css,
        /\.spine button\.line:hover,\s*\.spine button\.line\.is-on\s*\{[^}]*inset\s+3px/,
      );
    });
    scenario('Escape closes the line field', () => {
      assert.equal(lineFieldClosesOnEscape('Escape', true), true);
      assert.equal(lineFieldClosesOnEscape('Escape', false), false);
      assert.equal(lineFieldClosesOnEscape('Enter', true), false);
    });
  });
  requirement('A document remark is a review comment', () => {
    scenario('A remark on the plan is a review comment', async () => {
      const comments: string[] = [];
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'proposing', {openPullRequests: 1})],
          commentPull: (_key, body) => {
            comments.push(body);
          },
        },
        async (page, window, paths) => {
          writeChange(
            paths.arcadia,
            '1',
            'proposal.md',
            '## Outcome\n\nГодность.\n\n## Open questions\n',
          );
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          assert.match(
            bandOf(await pageHtml(page.url), '1'),
            /<label class="draft">Комментарий/,
          );
          assert.equal(
            (
              await post(
                page.url,
                'act',
                new URLSearchParams({
                  act: 'answer',
                  key: '1',
                  reply: 'Сначала сократить Outcome.',
                }).toString(),
              )
            ).status,
            200,
          );
          assert.deepEqual(comments, ['Сначала сократить Outcome.']);
        },
      );
    });
  });
});
