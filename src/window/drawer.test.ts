import assert from 'node:assert/strict';
import {requirement, scenario, spec} from '@ojson/spec-coverage';
import {
  MANAGER,
  articleOf,
  held,
  hosted,
  pageHtml,
  post,
  stationOf,
} from './page.harness.ts';

spec('drawer', () => {
  requirement('The drawer holds one open cycle', () => {
    scenario('Opening another row closes the previous', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'proposing'), held('2', 'specifying')],
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const first = await pageHtml(page.url);
          assert.match(articleOf(first, '1'), /class="ticket is-open"/);
          assert.equal(articleOf(first, '2').includes('is-open'), false);
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '2'}).toString()))
              .status,
            200,
          );
          const second = await pageHtml(page.url);
          assert.match(articleOf(second, '2'), /class="ticket is-open"/);
          assert.equal(articleOf(second, '1').includes('is-open'), false);
          assert.equal(second.match(/class="ticket is-open"/g)?.length, 1);
        },
      );
    });
    scenario('An open row does not narrow its neighbors', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'proposing'), held('2', 'specifying')],
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const before = await pageHtml(page.url);
          const neighbor = articleOf(before, '2');
          assert.equal(neighbor.match(/data-station=/g)?.length, 7);
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const after = await pageHtml(page.url);
          assert.equal(articleOf(after, '2'), neighbor);
          assert.match(articleOf(after, '1'), /class="ticket is-open"/);
          assert.match(after, /<aside class="sidebar" data-key="1"/);
          assert.match(after, /\.sidebar\s*\{[^}]*position:\s*fixed/);
          assert.equal(stationOf(after, '1', 'proposing').includes('class="sidebar"'), false);
          assert.match(
            after,
            /\.stations\s*\{[^}]*grid-template-columns:\s*252px repeat\(7, minmax\(0, 1fr\)\)/,
          );
          assert.equal(/\.ticket\.is-open \.station\s*\{[^}]*width/.test(after), false);
        },
      );
    });
    scenario('A second click closes the cycle', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'proposing')]},
        async (page, window) => {
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const opened = await pageHtml(page.url);
          assert.match(opened, /<aside class="sidebar" data-key="1"/);
          assert.match(articleOf(opened, '1'), /is-open/);
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const closed = await pageHtml(page.url);
          assert.equal(closed.includes('class="sidebar"'), false);
          assert.equal(articleOf(closed, '1').includes('is-open'), false);
        },
      );
    });
    scenario('The sidebar is a wide drawer', async () => {
      await hosted(
        {login: () => MANAGER, tickets: () => [held('1', 'proposing')]},
        async (page, window) => {
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const html = await pageHtml(page.url);
          assert.match(html, /<aside class="sidebar" data-key="1"/);
          assert.match(html, /\.sidebar\s*\{[^}]*position:\s*fixed[^}]*right:/);
          assert.match(
            html,
            /\.stations\s*\{[^}]*grid-template-columns:\s*252px repeat\(7, minmax\(0, 1fr\)\)/,
          );
        },
      );
    });
  });
});
