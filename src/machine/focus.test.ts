import assert from 'node:assert/strict';
import {test} from 'vitest';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import type {FileSource, Tracker} from './port.ts';
import {changeDir} from './naming.ts';
import {focusMarkerLine, focusMirrorName, FOCUS_MARKER_LINES, isFocusRecord} from './marker.ts';
import {memoryPorts} from '../adapters/github.ts';
import {endStep, firstFocusSentence, focusProse, latestFocusComment, postFocusComment} from './focus.ts';
import {focusArgs, postFocus, publish} from '../sdd.ts';
import {focusPlaque} from '../window/focus.ts';

const KEY = '26';

type Run = {
  files?: readonly string[];
  comments?: {body: string; manager?: boolean}[];
};

function source(paths: readonly string[]): FileSource {
  return {
    exists: rel => paths.includes(rel),
    read: () => '',
    list: rel => {
      const prefix = rel.endsWith('/') ? rel : `${rel}/`;
      return paths.filter(item => item.startsWith(prefix));
    },
  };
}

function file(name: string): string {
  return `${changeDir(KEY)}/${name}`;
}

async function runFocus(
  body: string,
  over: Run = {},
): Promise<{posted: string[]; comments: {body: string; manager?: boolean}[]}> {
  const comments = (over.comments ?? []).map(comment => ({...comment}));
  const posted: string[] = [];
  const tracker = {
    async comments() {
      return comments.map(comment => ({...comment}));
    },
    async comment(_key: string, text: string) {
      posted.push(text);
      comments.push({body: text});
    },
  } as Pick<Tracker, 'comments' | 'comment'>;
  await postFocusComment(KEY, body, {tracker, vcs: {filesAt: () => source(over.files ?? [file('proposal.md')])}});
  return {posted, comments};
}

async function runPostFocus(
  body: string,
  over: Run = {},
): Promise<{posted: string[]; comments: {body: string; manager?: boolean}[]; message: string}> {
  const comments = (over.comments ?? []).map(comment => ({...comment}));
  const posted: string[] = [];
  const tracker = {
    async comments() {
      return comments.map(comment => ({...comment}));
    },
    async comment(_key: string, text: string) {
      posted.push(text);
      comments.push({body: text});
    },
  } as Pick<Tracker, 'comments' | 'comment'>;
  const message = await postFocus(
    {key: KEY, body},
    {tracker, vcs: {filesAt: () => source(over.files ?? [file('proposal.md')])}},
  );
  return {posted, comments, message};
}

spec('focus', () => {
  requirement('The skill writes a focus comment when the artifact is published', () => {
    scenario('The skill of the phase writes this comment when the artifact is published', async () => {
      const {posted} = await runFocus('sdd:focus:plan\nThe proposal names scope and one capability.\n');
      assert.equal(posted.length, 1);
      assert.equal(posted[0]?.startsWith('sdd:focus:plan\n'), true);
    });

    scenario('The skill writes a focus comment when a visit leaves something a person will read later', async () => {
      const {posted, message} = await runPostFocus('sdd:focus:design\nГраница и команды.\n', {
        files: [file('design.md')],
      });
      assert.equal(posted.length, 1);
      assert.equal(isFocusRecord(posted[0] ?? ''), true);
      assert.match(message, /posted/);
    });

    scenario('A focus comment is prose for one phase or the whole pull request', async () => {
      const phase = await runFocus('sdd:focus:spec\nDelta specs name observable behavior.\n');
      const whole = await runFocus('sdd:focus\nThe pull request closes the focus digest gap.\n', {
        comments: [{body: phase.posted[0] ?? ''}],
      });
      assert.equal(focusMarkerLine(phase.posted[0] ?? ''), 'sdd:focus:spec');
      assert.equal(focusMarkerLine(whole.posted[0] ?? ''), 'sdd:focus');
    });

    scenario('The first line is the marker sdd:focus:plan, sdd:focus:spec, sdd:focus:design, sdd:focus:tasks, sdd:focus:code, or sdd:focus', () => {
      for (const marker of FOCUS_MARKER_LINES) {
        assert.equal(focusMarkerLine(`${marker}\nprose`), marker);
        assert.equal(isFocusRecord(`${marker}\nprose`), true);
      }
      assert.equal(focusMarkerLine('sdd:focus:phase\nprose'), null);
      assert.equal(isFocusRecord('sdd:focus:phase\nprose'), false);
    });

    scenario('The layer ledger is not the comment a person reads', async () => {
      const {posted} = await runFocus('sdd:focus:tasks\nThree slices cover publish, window, and threads.\n');
      const body = posted[0] ?? '';
      assert.equal(body.includes('Plan solid'), false);
      assert.equal(body.includes('thread PRRT'), false);
      assert.equal(body.includes('src/a.ts'), false);
    });

    scenario('Older focus comments remain', async () => {
      const older = 'sdd:focus:plan\nFirst plan focus.\n';
      const {comments, posted} = await runFocus('sdd:focus:spec\nSpec focus follows.\n', {
        comments: [{body: older}],
      });
      assert.equal(posted.length, 1);
      assert.equal(comments[0]?.body, older);
      assert.equal(comments.length, 2);
    });

    scenario('Older comments remain', async () => {
      const older = 'person note without a marker';
      const {comments, posted} = await runFocus('sdd:focus:tasks\nСлайсы в порядке заметности.\n', {
        comments: [{body: older}],
        files: [file('tasks.md')],
      });
      assert.equal(comments[0]?.body, older);
      assert.equal(posted.length, 1);
      assert.equal(comments.length, 2);
    });

    scenario('There is no ledger and no fixed heading', async () => {
      const {posted} = await runFocus('sdd:focus:plan\nИсход для читателя тикета.\n');
      const body = posted[0] ?? '';
      assert.equal(body.includes('Plan solid'), false);
      assert.equal(body.includes('thread PRRT'), false);
      assert.equal(/^## /m.test(body), false);
      assert.equal(body.includes('Weak spot:'), false);
    });

    scenario('The same text does not add another comment', async () => {
      const same = 'sdd:focus:design\nBoundary names focus tests.\n';
      const first = await runFocus(same);
      const second = await runFocus(same, {comments: [{body: first.posted[0] ?? ''}]});
      assert.equal(first.posted.length, 1);
      assert.deepEqual(second.posted, []);
    });

    scenario('No signal leaves the comment', async () => {
      const body = 'sdd:focus:code\nImplement slice one.\n';
      const comments = [{body}];
      assert.equal(latestFocusComment(comments), body);
    });

    scenario('No change file means no focus comment', async () => {
      const focus = await runFocus('sdd:focus:plan\nNo directory.\n', {files: []});
      assert.deepEqual(focus.posted, []);
    });

    scenario('A published proposal uses sdd:focus:plan', async () => {
      const {posted} = await runPostFocus('sdd:focus:plan\nИсход и отказ.\n');
      assert.equal(focusMarkerLine(posted[0] ?? ''), 'sdd:focus:plan');
    });

    scenario('A published delta spec uses sdd:focus:spec', async () => {
      const {posted} = await runPostFocus('sdd:focus:spec\nНовое и изменённое обещание.\n', {
        files: [file('specs/focus/spec.md')],
      });
      assert.equal(focusMarkerLine(posted[0] ?? ''), 'sdd:focus:spec');
    });

    scenario('A published design uses sdd:focus:design', async () => {
      const {posted} = await runPostFocus('sdd:focus:design\nГде живёт поведение.\n', {
        files: [file('design.md')],
      });
      assert.equal(focusMarkerLine(posted[0] ?? ''), 'sdd:focus:design');
    });

    scenario('Published tasks use sdd:focus:tasks', async () => {
      const {posted} = await runPostFocus('sdd:focus:tasks\nСлайсы по порядку заметности.\n', {
        files: [file('tasks.md')],
      });
      assert.equal(focusMarkerLine(posted[0] ?? ''), 'sdd:focus:tasks');
    });

    scenario('A code slice, or a code change that answers a review thread, uses sdd:focus:code', async () => {
      const {posted} = await runPostFocus('sdd:focus:code\nПосле коммита верно следующее.\n');
      assert.equal(focusMarkerLine(posted[0] ?? ''), 'sdd:focus:code');
    });

    scenario('The archive commit uses sdd:focus:accept', async () => {
      const {posted} = await runPostFocus('sdd:focus:accept\nБазовая линия и архив.\n');
      assert.equal(focusMarkerLine(posted[0] ?? ''), 'sdd:focus:accept');
    });

    scenario('The archive writes this comment every time, including when sdd:auto-merge is set', async () => {
      const first = await runPostFocus('sdd:focus:accept\nПервый архив.\n');
      const second = await runPostFocus('sdd:focus:accept\nАрхив при auto-merge.\n', {
        comments: [{body: first.posted[0] ?? ''}],
      });
      assert.equal(first.posted.length, 1);
      assert.equal(second.posted.length, 1);
      assert.equal(focusMarkerLine(second.posted[0] ?? ''), 'sdd:focus:accept');
    });

    scenario(
      'sdd:auto-plan, sdd:auto-spec, and sdd:auto-design do not skip the comment, and the document was published',
      async () => {
        for (const marker of ['sdd:focus:plan', 'sdd:focus:spec', 'sdd:focus:design'] as const) {
          const {posted, message} = await runPostFocus(`${marker}\nДокумент опубликован.\n`, {
            files: [file('proposal.md'), file('specs/focus/spec.md'), file('design.md')],
          });
          assert.equal(focusMarkerLine(posted[0] ?? ''), marker);
          assert.match(message, /posted/);
        }
      },
    );

    scenario(
      'A visit that fixes review threads of its own phase writes that phase\'s marker even when the diff is small',
      async () => {
        const older = 'sdd:focus:spec\nСтарая спека.\n';
        const {comments, posted} = await runPostFocus('sdd:focus:spec\nУточнение после ревью.\n', {
          comments: [{body: older}],
          files: [file('specs/focus/spec.md')],
        });
        assert.equal(comments[0]?.body, older);
        assert.equal(comments.length, 2);
        assert.equal(focusMarkerLine(posted[0] ?? ''), 'sdd:focus:spec');
      },
    );

    scenario(
      'Verify, labeling threads, a rebase-only commit, and a publish that carries no phase artifact write no focus comment',
      async () => {
        const posted: string[] = [];
        const memory = memoryPorts({
          issues: [{key: KEY, title: '#26', body: '', state: 'OPEN', labels: []}],
        });
        const tracker = memory.tracker;
        const comment = tracker.comment.bind(tracker);
        tracker.comment = async (key, body) => {
          posted.push(body);
          return comment(key, body);
        };
        await endStep(
          KEY,
          {commits: 1, signal: 'Publish'},
          {
            tracker,
            review: memory.review,
            vcs: {
              compare: async () => '',
              filesAt: () => source([file('proposal.md')]),
              contentCommit: async () => '',
            },
          },
        );
        await publish(
          {key: KEY, title: '#26: rebase only'},
          {
            review: memory.review,
            vcs: {dirty: async () => [], push: async () => {}},
          },
        );
        assert.deepEqual(posted, []);
      },
    );

    scenario('A separate review step does not write the focus', async () => {
      const posted: string[] = [];
      const memory = memoryPorts({
        issues: [{key: KEY, title: '#26', body: '', state: 'OPEN', labels: []}],
      });
      const tracker = memory.tracker;
      const comment = tracker.comment.bind(tracker);
      tracker.comment = async (key, body) => {
        posted.push(body);
        return comment(key, body);
      };
      await endStep(
        KEY,
        {commits: 0, signal: null},
        {
          tracker,
          review: memory.review,
          vcs: {
            compare: async () => '',
            filesAt: () => source([file('proposal.md')]),
            contentCommit: async () => '',
          },
        },
      );
      assert.deepEqual(posted, []);
    });
  });

  requirement('The prose says what the phase produced', () => {
    scenario('The prose says what this phase produced', async () => {
      const prose = 'Design names the focus verb and the window seam.';
      const {posted} = await runFocus(`sdd:focus:design\n${prose}\n`);
      assert.equal(posted[0]?.includes(prose), true);
    });

    scenario('Something weak or that must be looked at is said too', async () => {
      const {posted} = await runFocus(
        'sdd:focus:plan\nScope is clear; the outcome line still needs a sharper caller verb.\n',
      );
      assert.equal(posted[0]?.includes('needs a sharper'), true);
    });

    scenario('Open questions are pointed at by place and count', async () => {
      const {posted} = await runFocus(
        'sdd:focus:plan\nPlan is drafted; proposal.md still has 2 open questions.\n',
      );
      const body = posted[0] ?? '';
      assert.equal(body.includes('2 open questions'), true);
      assert.equal(body.includes('- [ ]'), false);
    });

    scenario('A clean phase omits the weak-spot sentence', async () => {
      const {posted} = await runFocus('sdd:focus:tasks\nTasks slice the delta into three commits.\n');
      assert.equal(posted[0]?.includes('weak'), false);
      assert.equal(posted[0]?.includes('looked at'), false);
    });

    scenario('A phase with no open questions omits the pointer', async () => {
      const {posted} = await runFocus('sdd:focus:spec\nSpecs cover every ADDED scenario.\n');
      assert.equal(posted[0]?.includes('open questions'), false);
    });

    scenario('There is no fixed heading the writer fills in', async () => {
      const {posted} = await runFocus('sdd:focus:code\nFocus posts through the tracker port only.\n');
      const body = posted[0] ?? '';
      assert.equal(body.includes('## Produced'), false);
      assert.equal(body.includes('Weak spot:'), false);
    });
  });

  requirement('The sidebar focus block shows the latest focus prose', () => {
    scenario('The sidebar focus block shows the latest marker as a badge and the prose under it', () => {
      const comments = [
        {body: 'sdd:focus:plan\nOlder plan focus.\n'},
        {body: 'sdd:focus:spec\nLatest spec focus.\n'},
      ];
      assert.equal(focusMarkerLine(comments[1]?.body ?? ''), 'sdd:focus:spec');
      assert.equal(focusPlaque(comments), 'Latest spec focus.\n');
    });

    scenario('The spine row of that phase keeps the first sentence of its own latest phase comment', () => {
      const comment = 'sdd:focus:plan\nPlan names scope. A second sentence stays on the row.\n';
      assert.equal(firstFocusSentence(comment), 'Plan names scope.');
      assert.equal(focusMirrorName(focusMarkerLine(comment) ?? 'sdd:focus'), 'Plan');
    });

    scenario('A whole-pull-request comment belongs to the focus block and to no single row', () => {
      const comment = 'sdd:focus\nWhole pull request summary.\n';
      assert.equal(focusMirrorName(focusMarkerLine(comment) ?? 'sdd:focus'), null);
      assert.equal(focusProse(comment), 'Whole pull request summary.');
    });

    scenario('A manager comment is not the focus block', () => {
      const comments = [
        {body: 'sdd:focus:tasks\nTask slice prose.\n'},
        {body: 'manager note', manager: true},
      ];
      assert.equal(focusPlaque(comments), 'Task slice prose.\n');
    });
  });

});

test('focus args take the issue key and the body', () => {
  assert.deepEqual(focusArgs(['26', 'sdd:focus:plan\nProse']), {
    key: '26',
    body: 'sdd:focus:plan\nProse',
  });
  assert.equal(focusArgs([]), null);
});

test('postFocus refuses an unrecognized marker line', async () => {
  await assert.rejects(
    postFocus({key: '26', body: 'sdd:focus:phase\nnope\n'}, {vcs: {filesAt: () => source([file('proposal.md')])}, tracker: {comments: async () => [], comment: async () => {}}}),
    /recognized/,
  );
});

