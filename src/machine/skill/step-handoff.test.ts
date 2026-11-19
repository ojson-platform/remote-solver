import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

const steps = path.join(import.meta.dirname, '..', '..', '..', 'skills', 'sdd-flow', 'steps');

function step(name: string): string {
  return readFileSync(path.join(steps, name), 'utf8');
}

spec('step-handoff', () => {
  requirement('Specify hands a proposal fault back', () => {
    scenario('Specify hands the capability list to proposal', () => {
      const body = step('specify.md');
      assert.match(body, /capability list, problem, or scope is wrong/);
      assert.match(body, /last requirement of a baseline/);
      assert.match(body, /Hand-off to `proposal`/);
      assert.match(body, /Keep the spec files/);
    });
  });

  requirement('Tasks cuts a slice and hands off what it cannot verify', () => {
    scenario('A verification boundary with no command hands off to design', () => {
      const body = step('tasks.md');
      assert.match(body, /boundary with no command: Hand-off to `design`/);
      assert.match(body, /Do not write the card/);
    });
    scenario('A scenario in two tasks is fixed before the commit', () => {
      const body = step('tasks.md');
      assert.match(body, /A scenario in two tasks, a scenario in none, or a task with no anchor: fix that before the commit/);
    });
    scenario('A scenario no caller can verify hands off to spec', () => {
      assert.match(step('tasks.md'), /no caller path can verify: Hand-off to `spec`/);
    });
    scenario('Tasks publishes one card per slice', () => {
      const body = step('tasks.md');
      assert.match(body, /one `tasks\/<id>\.md` per slice/);
      assert.match(body, /same observation share a slice/);
      assert.match(body, /Each Scenario sits in exactly one slice/);
    });
  });

  requirement('Verify hands a failure to the layer that owns it', () => {
    scenario('A failure that names behavior hands off to code', () => {
      const body = step('verify.md');
      assert.match(body, /writes no files/);
      assert.match(body, /Hand-off \(`CONTEXT\.md`\) to `code`/);
    });
    scenario('A validate failure that names a spec file hands off to spec', () => {
      assert.match(step('verify.md'), /Hand-off to `spec` per file/);
    });
    scenario('A missing scenario test returns to code', () => {
      const body = step('verify.md');
      assert.match(
        body,
        /When that line names a delta scenario, Hand-off to `code` on the test file for that spec/,
      );
      assert.match(body, /The cause is the line\. Do not Wait/);
    });
    scenario('No test line is a note and a wait', () => {
      assert.match(step('verify.md'), /No test line is § Hand-off: `sdd:note` and Wait/);
    });
    scenario('Infrastructure only waits', () => {
      const body = step('verify.md');
      assert.match(body, /Infrastructure only: Wait/);
      assert.match(body, /Writes no files/);
    });
  });

  requirement('Classification leaves a marker the next poll reads', () => {
    scenario('Classification replies and leaves the thread open', () => {
      const body = step('pr-comments.md');
      assert.match(body, /reply with one line: `sdd:layer=<layer> → <phase>`/);
      assert.match(body, /Leave every thread open/);
    });
    scenario('Verifying and accepting name the cause and wait', () => {
      const body = step('pr-comments.md');
      assert.match(body, /`verifying`, `accepting`\): do not open a `code` thread/);
      assert.match(body, /with no marker, then Wait/);
    });
    scenario('A phase with a layer row opens a thread', () => {
      assert.match(
        step('pr-comments.md'),
        /The body is `sdd:layer=<layer> → <phase> <cause>`/,
      );
    });
    scenario('Classification removes the hold unless it waited', () => {
      assert.match(step('pr-comments.md'), /Step 3 Waited: leave `sdd:wait-human` set\. Otherwise `unwait <issue>`/);
    });
    scenario('An out reply resolves the thread', () => {
      assert.match(step('pr-comments.md'), /`out`: open the issue, then `thread resolve` yourself/);
    });
  });

  requirement('A named promise stays on the file\'s layer', () => {
    scenario('A new example of a named promise stays code', () => {
      const comments = step('pr-comments.md');
      assert.match(
        comments,
        /A remark that quotes a promise a scenario already states takes the layer of the file it sits on, even when the example is new/,
      );
      assert.match(comments, /`spec` remains only a promise no scenario states/);
      const fix = step('fix.md');
      assert.match(
        fix,
        /A new example of a promise a scenario already states is that scenario\. Write that scenario's test red, then the source/,
      );
      assert.match(comments, /A word the scenario title does not contain is that same promise/);
      assert.match(fix, /The red run fails on the example the remark names before any source edit/);
      assert.match(fix, /A green run of a neighboring example is not that red run/);
      assert.match(fix, /The test keeps the scenario title the delta already names/);
      assert.match(fix, /Hand-off to `spec` only when no scenario states the promise/);
    });
    scenario('A stable spec scenario stays code', () => {
      const comments = step('pr-comments.md');
      assert.match(
        comments,
        /A scenario a stable spec names is that promise, even when this change's delta does not name it/,
      );
      assert.match(step('fix.md'), /A `scenario` a stable spec names counts the same way and stays on this layer/);
    });
    scenario('A promise this change does not own is out', () => {
      const comments = step('pr-comments.md');
      assert.match(comments, /A promise no scenario states that this change does not own is `out`/);
      assert.match(step('fix.md'), /A promise this change does not own is `out`, not `spec`/);
    });
  });

  requirement('Design writes the question it cannot close', () => {
    scenario('An approach sentence with no scenario hands off to spec', () => {
      const body = step('design.md');
      assert.match(body, /observation no scenario names is a Hand-off to `spec`/);
      assert.match(body, /contradicts a scenario: Hand-off to `spec`/);
      assert.match(body, /do not publish/);
    });
    scenario('An init question is written as an open decision', () => {
      const body = step('design.md');
      assert.match(body, /write each question as an unchecked item under `## Open decisions`/);
      assert.match(body, /write one unchecked item under `## Open decisions` that names the missing command/);
      assert.match(body, /Do not publish/);
    });
  });

  requirement('Implement hands off a task it cannot carry', () => {
    scenario('A missing task card hands off to tasks', () => {
      const body = step('implement.md');
      assert.match(body, /No `tasks\/<id>\.md`, or it lacks a § Artifacts heading: Hand-off to `tasks`/);
      assert.match(body, /Write no code/);
    });
    scenario('A coverage gap outside the task is a hand-off', () => {
      assert.match(step('implement.md'), /coverage gap outside this task is a Hand-off, not a success/);
    });
    scenario('Scenarios from two requirements are split before the task', () => {
      const body = step('implement.md');
      assert.match(body, /Scenarios from two Requirements on that card: split `tasks\.md` in its own commit/);
      assert.match(body, /end the run/);
    });
  });
});
