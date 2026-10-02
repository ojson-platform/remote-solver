import assert from 'node:assert/strict';
import {test} from 'vitest';

import {memoryPorts} from './adapters/github.ts';
import {fixArgs, fixThread, publish, threadsArgs} from './sdd.ts';

test('threads takes a pull and optional marker filters', () => {
  assert.deepEqual(threadsArgs(['12']), {pull: '12', layer: undefined, unmarked: false});
  assert.deepEqual(threadsArgs(['12', '--layer', 'spec']), {
    pull: '12',
    layer: 'spec',
    unmarked: false,
  });
  assert.deepEqual(threadsArgs(['12', '--unmarked']), {
    pull: '12',
    layer: undefined,
    unmarked: true,
  });
  assert.equal(threadsArgs([]), null);
  assert.equal(threadsArgs(['--layer', 'spec']), null);
  assert.equal(threadsArgs(['12', '--layer']), null);
  assert.equal(threadsArgs(['12', '--bogus']), null);
});

test('thread fix takes the issue, the pull, and a thread or --conversation', () => {
  assert.deepEqual(fixArgs(['7', '12', 'PRRT_1']), {key: '7', pull: '12', thread: 'PRRT_1'});
  assert.deepEqual(fixArgs(['7', '12', '--conversation']), {key: '7', pull: '12', thread: null});
  assert.equal(fixArgs(['7', '12']), null);
  assert.equal(fixArgs(['7', '12', '--bogus']), null);
  assert.equal(fixArgs(['7', '12', 'PRRT_1', 'extra']), null);
  assert.equal(fixArgs(['--conversation', '12', 'PRRT_1']), null);
});

const thread = {id: 'PRRT_1', comment: '41', path: 'src/a.ts', line: 3, resolved: false};

function surface(body: string, published: boolean) {
  const memory = memoryPorts({threadList: {'12': [{...thread, body}]}});
  const vcs = {
    head: async () => 'abc123',
    published: async (key: string) => published && key === '7',
  };
  return {memory, deps: {review: memory.review, vcs}};
}

test('thread fix refuses while HEAD is not on the remote issue branch', async () => {
  const {memory, deps} = surface('sdd:layer=code → implementing', false);
  await assert.rejects(fixThread({key: '7', pull: '12', thread: 'PRRT_1'}, deps), /abc123.*Publish/);
  await assert.rejects(fixThread({key: '7', pull: '12', thread: null}, deps), /Publish/);
  assert.deepEqual(memory.calls, []);
});

test('thread fix replies sdd:fixed HEAD on the latest comment and resolves in one call', async () => {
  const {memory, deps} = surface('sdd:layer=code → implementing', true);
  assert.equal(await fixThread({key: '7', pull: '12', thread: 'PRRT_1'}, deps), 'sdd:fixed abc123');
  assert.deepEqual(memory.calls, [
    'threadList',
    'reply',
    'body:🤖 sdd:fixed abc123',
    'resolveThread',
  ]);
});

test('thread fix on a thread already answered sdd:fixed only resolves it', async () => {
  const {memory, deps} = surface('🤖 sdd:fixed abc123', true);
  await fixThread({key: '7', pull: '12', thread: 'PRRT_1'}, deps);
  assert.deepEqual(memory.calls, ['threadList', 'resolveThread']);
});

test('thread fix --conversation says sdd:fixed HEAD and resolves nothing', async () => {
  const {memory, deps} = surface('', true);
  await fixThread({key: '7', pull: '12', thread: null}, deps);
  assert.deepEqual(memory.calls, ['say', 'body:🤖 sdd:fixed abc123']);
});

test('thread fix names a thread the pull does not have', async () => {
  const {deps} = surface('', true);
  await assert.rejects(fixThread({key: '7', pull: '12', thread: 'PRRT_9'}, deps), /No thread PRRT_9/);
});

function publishing(dirt: string[]) {
  const memory = memoryPorts();
  const pushed: string[] = [];
  const vcs = {dirty: async () => dirt, push: async (key: string) => void pushed.push(key)};
  return {memory, pushed, deps: {review: memory.review, vcs}};
}

test('publish refuses a dirty worktree, names each path, and pushes nothing', async () => {
  const {memory, pushed, deps} = publishing(['src/a.ts', 'coverage/']);
  await assert.rejects(
    publish({key: '7', title: '#7: fix'}, deps),
    /#7 is not published.*\.gitignore.*\n {2}src\/a\.ts\n {2}coverage\/$/s,
  );
  assert.deepEqual(pushed, []);
  assert.deepEqual(memory.calls, []);
});

test('publish on a clean worktree pushes the issue branch and opens the pull', async () => {
  const {memory, pushed, deps} = publishing([]);
  assert.equal(await publish({key: '7', title: '#7: fix'}, deps), '#7: pull new');
  assert.deepEqual(pushed, ['7']);
  assert.deepEqual(memory.calls, ['pulls', 'ensurePull']);
});

test('publish refuses several open pull requests and pushes nothing', async () => {
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
      {review: memory.review, vcs: {dirty: async () => [], push: async key => void pushed.push(key)}},
    ),
    /cycle stopped until one open PR remains: 3, 4/,
  );
  assert.deepEqual(pushed, []);
  assert.deepEqual(memory.calls, ['pulls']);
});
