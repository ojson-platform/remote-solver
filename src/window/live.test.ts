import assert from 'node:assert/strict';
import {rmSync} from 'node:fs';
import {test} from 'vitest';

import type {ThreadTarget} from '../machine/port.ts';
import {openLiveBoard, type LiveReview} from './live.ts';
import {yard} from './live.harness.ts';

function liveAnchor(head = 'abc123', pullId = '11') {
  const staged = yard();
  const opened: {pull: string; target: ThreadTarget}[] = [];
  const spoken: {pull: string; body: string}[] = [];
  let ranges = 0;
  staged.review.pulls = async () => [
    {id: pullId, title: '#6: Show the whole Plan', state: 'OPEN', checks: 'green'},
  ];
  staged.review.range = async () => {
    ranges += 1;
    return {head, base: 'base1'};
  };
  staged.review.speak = async (pull, body) => {
    spoken.push({pull, body});
  };
  const review = staged.review as LiveReview & {
    openThread: (pull: string, target: ThreadTarget) => Promise<void>;
  };
  review.openThread = async (pull, target) => {
    opened.push({pull, target});
  };
  const live = openLiveBoard({
    homePath: staged.homePath,
    repo: 'acme/billing',
    tracker: staged.tracker,
    review,
    githubRoot: staged.github,
  });
  return {staged, live, opened, spoken, review, ranges: () => ranges};
}

test('a live anchor opens a plain thread on the pull head', async () => {
  const hosted = liveAnchor();
  try {
    await hosted.live.refresh();
    const status = await hosted.live.window.answer(
      '6',
      '',
      'смотрите сюда',
      'строка',
      'src/a.ts',
      '4',
      '',
    );
    assert.equal(status, undefined);
    assert.deepEqual(hosted.spoken, []);
    assert.deepEqual(hosted.opened, [
      {
        pull: '11',
        target: {
          commit: 'abc123',
          path: 'src/a.ts',
          line: 4,
          body: 'смотрите сюда',
          plain: true,
          side: 'right',
        },
      },
    ]);
  } finally {
    rmSync(hosted.staged.dir, {recursive: true, force: true});
  }
});

test('a refused live thread falls back to the quoted line', async () => {
  const hosted = liveAnchor();
  let tried = false;
  hosted.review.openThread = async () => {
    tried = true;
    throw new Error('host refused the thread');
  };
  try {
    await hosted.live.refresh();
    const status = await hosted.live.window.answer(
      '6',
      '',
      'ответ',
      'строка',
      'src/a.ts',
      '4',
      'right',
    );
    assert.equal(tried, true);
    assert.equal(status, undefined);
    assert.equal(String(status).includes('host refused the thread'), false);
    assert.deepEqual(hosted.spoken, [{pull: '11', body: '> строка\n\nответ'}]);
  } finally {
    rmSync(hosted.staged.dir, {recursive: true, force: true});
  }
});

test('an empty pull head falls back to the quoted line', async () => {
  const hosted = liveAnchor('');
  try {
    await hosted.live.refresh();
    const status = await hosted.live.window.answer(
      '6',
      '',
      'ответ',
      'строка',
      'src/a.ts',
      '4',
      'right',
    );
    assert.equal(hosted.ranges() > 0, true);
    assert.equal(status, undefined);
    assert.deepEqual(hosted.opened, []);
    assert.deepEqual(hosted.spoken, [{pull: '11', body: '> строка\n\nответ'}]);
  } finally {
    rmSync(hosted.staged.dir, {recursive: true, force: true});
  }
});

test('a refused live thread and a refused quote are not written', async () => {
  const hosted = liveAnchor();
  let triedThread = false;
  let triedSpeak = false;
  hosted.review.openThread = async () => {
    triedThread = true;
    throw new Error('host refused the thread');
  };
  hosted.review.speak = async () => {
    triedSpeak = true;
    throw new Error('host refused the quote');
  };
  try {
    await hosted.live.refresh();
    const status = await hosted.live.window.answer(
      '6',
      '',
      'ответ',
      'строка',
      'src/a.ts',
      '4',
      'right',
    );
    assert.equal(triedThread, true);
    assert.equal(triedSpeak, true);
    assert.equal(status, 'комментарий не записан');
    assert.equal(status.includes('host refused'), false);
  } finally {
    rmSync(hosted.staged.dir, {recursive: true, force: true});
  }
});

test('an empty pull id writes nothing', async () => {
  const hosted = liveAnchor('abc123', '');
  try {
    await hosted.live.refresh();
    const status = await hosted.live.window.answer(
      '6',
      '',
      'ответ',
      'строка',
      'src/a.ts',
      '4',
      'right',
    );
    assert.equal(status, 'комментарий не записан');
    assert.deepEqual(hosted.opened, []);
    assert.deepEqual(hosted.spoken, []);
  } finally {
    rmSync(hosted.staged.dir, {recursive: true, force: true});
  }
});

