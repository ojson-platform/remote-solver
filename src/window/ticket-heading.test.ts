import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {requirement, scenario, spec} from '@ojson/spec-coverage';
import {plaqueClickOpens} from './page.ts';
import {
  MANAGER,
  articleOf,
  bandOf,
  held,
  hosted,
  pageHtml,
  post,
} from './__tests__/page.harness.ts';

spec('ticket-heading', () => {
  requirement('The ticket heading names the issue', () => {
    scenario('The board shows the issue link beside the title', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [
            held('1', 'specifying', {
              repo: 'acme/billing',
              title: 'Take me',
              sddService: 'services/billing',
            }),
          ],
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const html = await pageHtml(page.url);
          const article = articleOf(html, '1');
          const href = 'href="https://github.com/acme/billing/issues/1"';
          assert.match(article, new RegExp(`<a class="key" ${href}>#1</a>`));
          assert.match(article, /: Take me/);
          const face = article.slice(
            article.indexOf('<button class="face"'),
            article.indexOf('</button>'),
          );
          assert.equal(face.includes(href), false);
        },
      );
    });

    scenario('A long board title ends on the third line', () => {
      const html = readFileSync(new URL('./face.css', import.meta.url), 'utf8');
      assert.match(html, /\.ident > \.name\s*\{[^}]*-webkit-line-clamp:\s*3/);
      assert.match(html, /\.ident > \.name \.open,\s*\.ident > \.name \.face\s*\{[^}]*display:\s*contents/);
      assert.match(html, /\.ident > \.name \.title\s*\{[^}]*display:\s*inline/);
      assert.match(html, /\.sidebar header \.name\s*\{[^}]*display:\s*flex[^}]*flex-wrap:\s*wrap/);
      assert.doesNotMatch(html, /\.ident > \.name \.title\s*\{[^}]*white-space:\s*nowrap/);
      assert.doesNotMatch(html, /(?:^|[{}])\s*\.name\s*\{\s*display:\s*flex/);
    });

    scenario('The plaque opens outside the issue link', () => {
      const gutter = {closest: (selector: string) => (selector === '.gutter' ? gutter : null)};
      const link = {
        closest: (selector: string) => (selector === 'a' || selector === '.gutter' ? link : null),
      };
      const corner = {
        closest: (selector: string) =>
          selector === '.corner' || selector === '.gutter' ? corner : null,
      };
      const button = {
        closest: (selector: string) => (selector === 'button' || selector === '.gutter' ? button : null),
      };
      assert.equal(plaqueClickOpens(gutter), true);
      assert.equal(plaqueClickOpens(link), false);
      assert.equal(plaqueClickOpens(corner), false);
      assert.equal(plaqueClickOpens(button), false);
      assert.equal(plaqueClickOpens(null), false);
    });

    scenario('A ticket without a repo has no link', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'specifying', {title: 'Take me'})],
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const article = articleOf(await pageHtml(page.url), '1');
          const text = article.replace(/>\s+</g, '><').replace(/<[^>]+>/g, '');
          assert.match(text, /#1: Take me/);
          assert.equal(article.includes('github.com'), false);
        },
      );
    });
  });

  requirement('The sidebar names the one open pull request', () => {
    scenario('One pull request is a muted link in the sidebar', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [
            held('1', 'specifying', {
              repo: 'acme/billing',
              pull: '11',
              openPullRequests: 1,
              title: 'Take me',
            }),
          ],
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const html = await pageHtml(page.url);
          const article = articleOf(html, '1');
          const side = bandOf(html, '1');
          assert.match(side, /https:\/\/github\.com\/acme\/billing\/pull\/11/);
          assert.match(side, /\(PR:/);
          assert.equal(article.includes('/pull/11'), false);
          assert.match(html, /\.pull\s*\{[^}]*color:\s*var\(--muted\)/);
          assert.match(html, /\.pull a\s*\{[^}]*color:\s*inherit/);
        },
      );
    });

    scenario('Several pull requests omit the parenthesis', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [
            held('1', 'specifying', {repo: 'acme/billing', pull: '11', openPullRequests: 2}),
          ],
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const side = bandOf(await pageHtml(page.url), '1');
          assert.equal(side.includes('(PR:'), false);
          assert.equal(side.includes('/pull/11'), false);
        },
      );
    });
  });

  requirement('The project badge links to the project root', () => {
    scenario('A service path badges its last segment', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [
            held('1', 'specifying', {
              repo: 'acme/billing',
              pull: '11',
              openPullRequests: 1,
              title: 'Take me',
            }),
          ],
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const html = await pageHtml(page.url);
          const href = 'href="https://github.com/acme/billing/tree/HEAD/services/billing"';
          assert.match(bandOf(html, '1'), new RegExp(`<a class="project" ${href}>billing</a>`));
          assert.equal(articleOf(html, '1').includes('class="project"'), false);
        },
      );
    });

    scenario('An empty service badges the repository root', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [held('1', 'specifying', {repo: 'acme/billing', sddService: ''})],
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          assert.equal(
            (await post(page.url, 'act', new URLSearchParams({act: 'open', key: '1'}).toString()))
              .status,
            200,
          );
          const html = await pageHtml(page.url);
          const article = articleOf(html, '1');
          const badge = bandOf(html, '1').match(/<a class="project" href="([^"]+)">billing<\/a>/);
          assert.ok(badge);
          assert.equal(badge[1], 'https://github.com/acme/billing');
          assert.equal(badge[1].includes('/issues/'), false);
          assert.equal(article.includes('class="project"'), false);
          assert.match(article, /\/issues\//);
        },
      );
    });

    scenario('An unnamed service has no badge', async () => {
      await hosted(
        {
          login: () => MANAGER,
          tickets: () => [
            {...held('1', 'specifying', {repo: 'acme/billing'}), sddService: undefined},
          ],
        },
        async (page, window) => {
          window.chooseAgent('cursor');
          const html = await pageHtml(page.url);
          assert.match(html, /https:\/\/github\.com\/acme\/billing\/issues\/1/);
          assert.equal(html.includes('class="project"'), false);
        },
      );
    });
  });
});
