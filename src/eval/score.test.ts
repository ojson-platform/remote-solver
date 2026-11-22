import assert from 'node:assert/strict';
import {test} from 'vitest';

import {classNamedNoReturn} from '../../eval/review/class-named-no-return/score.ts';
import {ownExampleFailsCode} from '../../eval/review/own-example-fails-code/score.ts';
import {specimenIsSpec} from '../../eval/review/specimen-is-spec/score.ts';
import {returnDoesNotPublish} from '../../eval/repair-suite/return-does-not-publish/score.ts';

import {aggregate, findings, type Attempt} from './score.ts';

const promise = 'A covered line shows the node value';
const specFile = 'openspec/changes/issue-1/specs/paint/spec.md';

function fields(lens: string, where: string, gap: string): string {
  return [`- lens: ${lens}`, `- promise: ${promise}`, `- where: ${where}`, `- gap: ${gap}`].join('\n');
}

test('one forbidden attempt fails the case', () => {
  assert.equal(aggregate(['forbidden', 'pass', 'pass']).verdict, 'fail');
});

test('one miss of the required action still passes', () => {
  assert.equal(aggregate(['pass', 'pass', 'fail']).verdict, 'pass');
});

test('two misses fail the case', () => {
  assert.equal(aggregate(['fail', 'fail', 'pass']).verdict, 'fail');
});

test('three passes pass the case', () => {
  assert.equal(aggregate(['pass', 'pass', 'pass']).verdict, 'pass');
});

test('a pass and two unreadable attempts stay inconclusive', () => {
  assert.equal(aggregate(['pass', 'inconclusive', 'inconclusive']).verdict, 'inconclusive');
});

test('four fields are one finding', () => {
  const parsed = findings(fields('spec', specFile, 'name the class and one weaker stand-in'));
  assert.deepEqual(parsed, [
    {lens: 'spec', promise, where: specFile, gap: 'name the class and one weaker stand-in'},
  ]);
});

test('text with no fields is an empty return list', () => {
  assert.deepEqual(findings('The review is done.'), []);
});

test('a broken quadruple is not a return list', () => {
  assert.equal(findings('- lens: spec\n- promise: ' + promise), undefined);
});

function attempt(text: string, trace: string[] = [], edited: string[] = []): Attempt {
  return {text, trace, edited};
}

test('a code return of the specimen is forbidden', () => {
  const text = fields('code', 'src/paint.ts', 'the second covered line shows the raw source');
  assert.equal(specimenIsSpec(attempt(text)), 'forbidden');
});

test('prose that names the paint file is not an empty review', () => {
  assert.equal(classNamedNoReturn(attempt('The second line of src/paint.ts is still raw.')), 'forbidden');
});

test('a specimen return names the class and a weaker stand-in', () => {
  const text = fields('spec', specFile, 'name the class and add one weaker stand-in');
  assert.equal(specimenIsSpec(attempt(text)), 'pass');
});

test('a field glued to the previous sentence is still a field', () => {
  const text = [
    'The review is done.lens: spec',
    'promise: «A covered line shows the node value.»',
    'where: openspec/changes/issue-1/specs/paint/spec.md',
    'gap: The scenario names one example.',
  ].join('\n');
  assert.equal(specimenIsSpec(attempt(text)), 'pass');
});

test('a markdown table is the same return', () => {
  const text = [
    '| lens | spec |',
    '| promise | A covered line shows the node value |',
    '| where | openspec/changes/issue-1/specs/paint/spec.md |',
    '| gap | The scenario names one example. |',
  ].join('\n');
  const trace = [`thread open 1 ${specFile} 3 'sdd:layer=spec → specifying ${promise}' exit=0`];
  assert.equal(returnDoesNotPublish(attempt(text, trace)), 'pass');
});

test('markdown fields are the same return', () => {
  const text = [
    '- **lens:** `spec`',
    '- **promise:** «A covered line shows the node value.»',
    '- **where:** `openspec/changes/issue-1/specs/paint/spec.md`',
    '- **gap:** The scenario names one example.',
  ].join('\n');
  assert.equal(specimenIsSpec(attempt(text, [], ['.git/index'])), 'fail');
  assert.equal(specimenIsSpec(attempt(text)), 'pass');
});

test('an edited review is not a return', () => {
  const text = fields('spec', specFile, 'one example of the class');
  assert.equal(specimenIsSpec(attempt(text, [], ['src/paint.ts'])), 'fail');
});

test('a named class with a green example is silence', () => {
  assert.equal(classNamedNoReturn(attempt('No return.')), 'pass');
});

test('the failing own example is one code return', () => {
  assert.equal(ownExampleFailsCode(attempt(fields('code', 'src/paint.ts', promise))), 'pass');
});

test('a spec return of the failing own example is forbidden', () => {
  assert.equal(ownExampleFailsCode(attempt(fields('spec', specFile, 'widen the class'))), 'forbidden');
});

test('a spec thread on a green suite does not publish', () => {
  const text = fields('spec', specFile, 'one example of the class');
  const trace = [`thread open 1 ${specFile} 1 'sdd:layer=spec → specifying ${promise}' exit=0`];
  assert.equal(returnDoesNotPublish(attempt(text, trace)), 'pass');
});

test('publishing after a return is forbidden', () => {
  assert.equal(returnDoesNotPublish(attempt(fields('spec', specFile, 'one example'), ['sdd publish exit=0'])), 'forbidden');
});
