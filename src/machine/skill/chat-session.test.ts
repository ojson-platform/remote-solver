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
      assert.match(act, /Say that this phase has open questions and this turn answers them/);
      assert.match(act, /The printed `text` is the question/);
      assert.match(act, /The prompt is that text/);
      assert.match(act, /Show every entry together in the client's question dialog/);
      assert.match(
        act,
        /Write each choice from the printed question and the issue text already in the step/,
      );
      assert.match(act, /Each whole answer is its own choice/);
      assert.match(act, /A choice is a whole answer the person can accept unchanged/);
      assert.match(
        act,
        /When one whole answer is ready, the second choice is Skip: it records nothing, the item stays open, and the next run asks it again/,
      );
      assert.match(act, /One whole answer is enough: the dialog still opens/);
      assert.match(act, /Do not ask by printing the question alone/);
      assert.match(act, /A skip records nothing. When every entry was skipped, stop/);
      assert.match(act, /The person's own words stay available/);
      assert.match(act, /person's words unchanged in place of `<answer>`/);
      assert.match(act, /That command is the only post/);
      assert.match(act, /When it exits 0, the post is done. Do not run it again/);
      assert.match(act, /Do not edit the change/);
      assert.match(act, /Then run `sdd step <key>` and follow Act/);
      assert.match(act, /When that command exits non-zero, stop, and the message names the file and the exit/);
      assert.match(
        act,
        /When the next step still lists an entry the person answered, stop, and say the record did not close it/,
      );
      assert.match(act, /Do not post the answer another way/);
      assert.match(act, /Closing the dialog answers nothing and stops/);
      assert.match(act, /An entry left unanswered stays open, and the next run asks it again/);
      assert.match(act, /When the next step lists only entries the person left unanswered, stop/);
      assert.match(act, /A later message that answers these entries is recorded the same way/);
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
      assert.match(act, /Do not open the step file, the program, its adapters, or another skill's scripts/);
      assert.match(act, /The printed text is the outcome/);
      assert.match(
        act,
        /Edit in the printed path/,
      );
      assert.match(act, /Every `sdd` command runs from the service root/);
      assert.match(act, /Do not search the tree for that checkout/);
      assert.match(act, /Do not rebase, commit, or publish except by the `sdd` command/);
      assert.match(act, /When `sdd publish` exits non-zero, stop and name the exit/);
      assert.match(act, /Do not rebase the branch by hand and do not open the program/);
      assert.match(
        act,
        /A repository rule that runs a local check before push does not apply in this cycle/,
      );
      assert.match(act, /Pull-request checks are read when the phase is verifying/);
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
      assert.match(next, /answers entries of a printed `dialog` follows that dialog's record/);
      assert.doesNotMatch(next, /run each answered entry's `record`/);
    });
    scenario('A question about the cycle runs step', () => {
      const next = section('The next message');
      assert.match(
        next,
        /A message that only asks where the cycle is: run `sdd step <key>` again and follow Act/,
      );
      assert.match(next, /Do not describe the cycle from an earlier print/);
      assert.doesNotMatch(next, /say what is still waited for/);
    });
    scenario('Another request is carried out', () => {
      const next = section('The next message');
      assert.match(next, /Any other request is carried out/);
      assert.match(
        next,
        /When that work moves the branch or the change, run `sdd step <key>` again and follow Act/,
      );
    });
  });
});
