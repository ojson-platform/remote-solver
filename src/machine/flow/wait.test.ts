import assert from 'node:assert/strict';
import {vi} from 'vitest';
import {requirement, scenario, spec} from '@ojson/spec-coverage';
import {machine} from '../../adapters/compose.ts';
import {memoryPorts} from '../../adapters/tracker/github.ts';
import {runSdd} from '../../sdd.ts';

spec('wait', () => {
  requirement('Wait comments the ask', () => {
    scenario('Wait without a sentence is refused', async () => {
      const {tracker, review} = memoryPorts({
        issues: [{key: '7', title: '#7: title', body: '', state: 'OPEN', labels: ['sdd:cycle']}],
      });
      const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('exit');
      });
      try {
        await assert.rejects(
          runSdd(
            ['wait', '7'],
            machine(process.cwd(), {tracker, review, config: {queues: [{name: 'Sandcastle'}]}}),
          ),
          /exit/,
        );
        assert.equal((await tracker.labels('7')).includes('sdd:wait-human'), false);
      } finally {
        exit.mockRestore();
      }
    });
    scenario('Wait posts the sentence', async () => {
      const {tracker, review, calls} = memoryPorts({
        issues: [{key: '7', title: '#7: title', body: '', state: 'OPEN', labels: ['sdd:cycle']}],
      });
      await runSdd(
        ['wait', '7', 'merge the pull request'],
        machine(process.cwd(), {tracker, review, config: {queues: [{name: 'Sandcastle'}]}}),
      );
      assert.ok((await tracker.labels('7')).includes('sdd:wait-human'));
      const notes = await tracker.comments('7');
      assert.equal(notes.at(-1)?.body, '🤖 sdd:wait-human\nmerge the pull request');
      assert.ok(calls.some(call => call.includes('merge the pull request')));
    });
  });

  requirement('Unwait clears the label', () => {
    scenario('Unwait removes the label', async () => {
      const {tracker, review} = memoryPorts({
        issues: [
          {
            key: '7',
            title: '#7: title',
            body: '',
            state: 'OPEN',
            labels: ['sdd:cycle', 'sdd:wait-human'],
          },
        ],
      });
      await runSdd(
        ['unwait', '7'],
        machine(process.cwd(), {tracker, review, config: {queues: [{name: 'Sandcastle'}]}}),
      );
      assert.equal((await tracker.labels('7')).includes('sdd:wait-human'), false);
    });
    scenario('Unwait on an issue that is not waiting', async () => {
      const {tracker, review, calls} = memoryPorts({
        issues: [{key: '7', title: '#7: title', body: '', state: 'OPEN', labels: ['sdd:cycle']}],
      });
      await runSdd(
        ['unwait', '7'],
        machine(process.cwd(), {tracker, review, config: {queues: [{name: 'Sandcastle'}]}}),
      );
      assert.equal(calls.includes('editLabels'), false);
      assert.deepEqual(await tracker.labels('7'), ['sdd:cycle']);
    });
  });
});
