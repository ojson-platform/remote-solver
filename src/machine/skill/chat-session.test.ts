import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

const skill = readFileSync(
  path.join(import.meta.dirname, '..', '..', '..', 'skills', 'sdd-flow', 'SKILL.md'),
  'utf8',
);

function section(title: string): string {
  const body = skill.split(new RegExp(`^## ${title}\\n`, 'm'))[1];
  assert.ok(body, title);
  return body.split(/^## /m)[0] ?? '';
}

spec('chat-session', () => {
  requirement('The chat runs until the machine waits', () => {
    scenario('A commit or a hand-off runs step again', () => {
      const act = section('Act');
      assert.match(act, /When the step ends in Publish or Hand-off, run `sdd step <key>` again and follow Act/);
    });
    scenario('A paused advance runs step again', () => {
      const act = section('Act');
      assert.match(act, /Act does not apply them again/);
      assert.match(act, /`advance`: run `sdd step <key>` again and follow Act/);
    });
    scenario('An action with no signal stops', () => {
      assert.match(
        section('Act'),
        /When the step leaves no Publish, no Hand-off, and no Wait, stop/,
      );
    });
    scenario('A dialog does not stop the chat', () => {
      const act = section('Act');
      assert.match(act, /`wait` with `dialog`: do not stop/);
      assert.match(act, /Show every entry together in the client's question dialog/);
      assert.match(
        act,
        /Offer a ready answer only when that entry's text already states that whole answer/,
      );
      assert.match(act, /Always leave a place for the person's own words/);
      assert.match(act, /person's words unchanged in place of `<answer>`/);
      assert.match(act, /Do not edit the change/);
      assert.match(act, /Then run `sdd step <key>` and follow Act/);
      assert.match(act, /When that command exits non-zero, stop, and the message names the file and the exit/);
      assert.match(act, /Dismissing runs nothing and stops/);
      assert.match(act, /A later message that answers these entries is recorded the same way/);
      assert.match(act, /A message that does not answer them shows the dialog again/);
    });
    scenario('A wait without a dialog stops the chat', () => {
      assert.match(section('Act'), /`wait` without `dialog`, or `done`: stop/);
    });
    scenario('The chat follows the printed step', () => {
      const act = section('Act');
      assert.match(
        act,
        /The printed decision's `step` carries the issue text, then the upstream block, then the action text with this service's hooks/,
      );
      assert.match(act, /Follow that text/);
      assert.match(act, /Do not open the step file/);
    });
  });

  requirement('The stop tells the person what happened', () => {
    scenario('The stop names the work, the cause, and the files', () => {
      const stop = section('Stop');
      assert.match(stop, /Say what this run finished/);
      assert.match(stop, /Say why it stopped/);
      assert.match(stop, /Name the files that matter for this stop as links/);
      assert.match(stop, /The printed reason is a fact in that message, not the whole message/);
      assert.match(stop, /Do not reuse a fixed wording/);
    });
  });

  requirement('The next message stays in the session', () => {
    scenario('Agreement on a gate continues', () => {
      const next = section('The next message');
      assert.match(next, /examples, not the whole set/);
      assert.match(
        next,
        /Agreement when the printed decision has `gate`: run `sdd accept <key>`, then Act from a fresh `step`/,
      );
    });
    scenario('Agreement after an empty action continues', () => {
      assert.match(
        section('The next message'),
        /Agreement after a stop with no signal: run `sdd step <key>` again and follow Act/,
      );
    });
    scenario('A change continues', () => {
      assert.match(
        section('The next message'),
        /edit it in the worktree, publish \(`CONTEXT\.md` § Publish\), run `sdd unwait <key>`, then Act from a fresh `step`/,
      );
    });
    scenario('The person is not asked to invoke the skill again', () => {
      assert.match(skill, /Do not ask for `\/sdd-flow` again/);
      assert.match(section('The next message'), /This session is still the skill/);
    });
    scenario('An answer to a printed dialog continues', () => {
      const next = section('The next message');
      assert.match(next, /answers entries of a printed `dialog`/);
      assert.match(next, /person's words unchanged in place of `<answer>`/);
      assert.match(next, /Do not edit the change/);
      assert.match(next, /Then Act from a fresh `step`/);
      assert.match(next, /does not answer those entries shows the dialog again/);
    });
  });
});
