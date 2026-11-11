import assert from 'node:assert/strict';
import {requirement, scenario, spec} from '@ojson/spec-coverage';
import {memoryPorts} from '../../adapters/tracker/github.ts';
import {publish} from '../../sdd.ts';

spec('publish', () => {
  requirement('A dirty worktree is not published', () => {
    scenario('Dirty paths are named and nothing is pushed', async () => {
      const pushed: string[] = [];
      const memory = memoryPorts();
      await assert.rejects(
        publish(
          {key: '7', title: '#7: fix'},
          {
            review: memory.review,
            vcs: {dirty: async () => ['src/a.ts'], push: async key => void pushed.push(key)},
          },
        ),
        /src\/a\.ts/,
      );
      assert.deepEqual(pushed, []);
    });
  });

  requirement('Several open pull requests are refused before the push', () => {
    scenario('Two open pull requests reject publish before the push', async () => {
      const memory = memoryPorts({
        pulls: {
          '7': [
            {id: '3', title: '#7: one', state: 'OPEN'},
            {id: '4', title: '#7: two', state: 'OPEN'},
          ],
        },
      });
      const pushed: string[] = [];
      await assert.rejects(
        publish(
          {key: '7', title: '#7: fix'},
          {
            review: memory.review,
            vcs: {dirty: async () => [], push: async key => void pushed.push(key)},
          },
        ),
        /3, 4/,
      );
      assert.deepEqual(pushed, []);
    });
  });

  requirement('The argument is the pull request title', () => {
    scenario('The new pull request uses the given title', async () => {
      const titles: string[] = [];
      const memory = memoryPorts();
      await publish(
        {key: '7', title: '#7: land the change'},
        {
          review: {
            pulls: key => memory.review.pulls(key),
            ensurePull: (key, title, body) => {
              titles.push(title);
              return memory.review.ensurePull(key, title, body);
            },
          } as never,
          vcs: {dirty: async () => [], push: async () => undefined},
        },
      );
      assert.deepEqual(titles, ['#7: land the change']);
    });
  });
});
