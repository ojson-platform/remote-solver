import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {test} from 'vitest';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {cycleHooks, stepPrompt} from './hook.ts';

const plan = ['# plan', '', '## Steps', '', '1. go', '', '## Check', '', '- done', ''].join('\n');

function proveSpacesAreNotAPoint(): void {
  assert.deepEqual(cycleHooks({archive: {before: '   ', after: 'keep'}}), {
    archive: {after: 'keep'},
  });
}

function proveServiceTextPrecedesTheCycleParagraph(): void {
  const result = stepPrompt(
    plan,
    'create-proposal',
    {'create-proposal': {before: ['alpha', 'beta\nline']}},
    {'create-proposal': {before: 'from the cycle'}},
  );
  assert.equal(
    result,
    [
      '# plan',
      '',
      'alpha',
      '',
      'beta',
      'line',
      '',
      'from the cycle',
      '',
      '## Steps',
      '',
      '1. go',
      '',
      '## Check',
      '',
      '- done',
      '',
    ].join('\n'),
  );
}

function proveAMissingCycleParagraphAddsNoBlankLine(): void {
  const result = stepPrompt(plan, 'create-proposal', {'create-proposal': {before: ['only']}}, {});
  assert.equal(
    result,
    ['# plan', '', 'only', '', '## Steps', '', '1. go', '', '## Check', '', '- done', ''].join(
      '\n',
    ),
  );
}

function proveStepsKeepsTheSliceInPlace(): void {
  const file = [
    '## Out of this action',
    '',
    'stay out',
    '',
    '## Slice',
    '',
    'stay slice',
    '',
    '## Read only',
    '',
    'stay read',
    '',
    '## Steps',
    '',
    '1. work',
    '',
    '## Check',
    '',
    '- ok',
    '',
  ].join('\n');
  const result = stepPrompt(
    file,
    'create-tasks',
    {'create-tasks': {before: ['BEFORE'], after: ['AFTER']}},
    {},
  );
  assert.equal(
    result,
    [
      '## Out of this action',
      '',
      'stay out',
      '',
      '## Slice',
      '',
      'stay slice',
      '',
      '## Read only',
      '',
      'stay read',
      '',
      'BEFORE',
      '',
      '## Steps',
      '',
      '1. work',
      '',
      'AFTER',
      '',
      '## Check',
      '',
      '- ok',
      '',
    ].join('\n'),
  );
  assert.ok(result.indexOf('## Out of this action') < result.indexOf('## Slice'));
  assert.ok(result.indexOf('## Slice') < result.indexOf('## Steps'));
  assert.ok(result.indexOf('## Read only') < result.indexOf('## Steps'));
  assert.equal(result.slice(result.indexOf('BEFORE'), result.indexOf('## Steps')), 'BEFORE\n\n');
}

function proveArchiveDoesNotEnterUnarchive(): void {
  const file = [
    '## Out of this action',
    '',
    '- scope',
    '',
    '## archive',
    '',
    '1. Fold',
    '',
    '## unarchive',
    '',
    '1. Revert',
    '',
    '## Check',
    '',
    '- ok',
    '',
  ].join('\n');
  const result = stepPrompt(
    file,
    'unarchive',
    {unarchive: {after: ['UN-AFTER']}},
    {archive: {before: 'FOLD-SECRET'}, unarchive: {before: 'UN-BEFORE'}},
  );
  assert.equal(result.includes('FOLD-SECRET'), false);
  assert.equal(
    result,
    [
      '## Out of this action',
      '',
      '- scope',
      '',
      '## archive',
      '',
      '1. Fold',
      '',
      'UN-BEFORE',
      '',
      '## unarchive',
      '',
      '1. Revert',
      '',
      'UN-AFTER',
      '',
      '## Check',
      '',
      '- ok',
      '',
    ].join('\n'),
  );
}

function proveWithoutStepsTheAnchorIsTheActionSection(): void {
  const file = [
    '## Out of this action',
    '',
    '- scope',
    '',
    '## archive',
    '',
    '1. Fold',
    '',
    '## Check',
    '',
    '- ok',
    '',
  ].join('\n');
  const result = stepPrompt(
    file,
    'archive',
    {archive: {before: ['B'], after: ['A']}},
    {archive: {before: 'CB', after: 'CA'}},
  );
  assert.equal(
    result,
    [
      '## Out of this action',
      '',
      '- scope',
      '',
      'B',
      '',
      'CB',
      '',
      '## archive',
      '',
      '1. Fold',
      '',
      'A',
      '',
      'CA',
      '',
      '## Check',
      '',
      '- ok',
      '',
    ].join('\n'),
  );
  assert.ok(result.indexOf('B') < result.indexOf('## archive'));
  assert.ok(result.indexOf('## archive') < result.indexOf('A'));
  assert.ok(result.indexOf('A') < result.indexOf('## Check'));
}

test('a missing service list adds no blank line before the cycle paragraph', () => {
  const result = stepPrompt(
    plan,
    'create-proposal',
    {},
    {
      'create-proposal': {before: 'only cycle'},
    },
  );
  assert.equal(
    result,
    [
      '# plan',
      '',
      'only cycle',
      '',
      '## Steps',
      '',
      '1. go',
      '',
      '## Check',
      '',
      '- done',
      '',
    ].join('\n'),
  );
});

test('a service paragraph does not cancel the cycle paragraph', () => {
  const result = stepPrompt(
    '## Steps\n\n1. go\n',
    'archive',
    {archive: {before: ['same']}},
    {
      archive: {before: 'same'},
    },
  );
  assert.equal(result, 'same\n\nsame\n\n## Steps\n\n1. go\n');
});

test('another action and a point other than before or after stay out of the prompt', () => {
  const result = stepPrompt(
    '## Steps\n\n1. go\n',
    'archive',
    {
      archive: {before: ['in'], during: ['service-during']},
      unarchive: {before: ['other-service']},
    },
    {archive: {during: 'cycle-during'}, unarchive: {before: 'other-cycle'}},
  );
  assert.equal(result, 'in\n\n## Steps\n\n1. go\n');
});

test('a string of spaces is not a service paragraph', () => {
  const result = stepPrompt(
    '## Steps\n\n1. go\n',
    'archive',
    {archive: {before: ['keep', '   ']}},
    {},
  );
  assert.equal(result, 'keep\n\n## Steps\n\n1. go\n');
});

test('one service string is one paragraph', () => {
  const result = stepPrompt(
    '## Steps\n\n1. go\n',
    'archive',
    {archive: {before: 'only'}},
    undefined,
  );
  assert.equal(result, 'only\n\n## Steps\n\n1. go\n');
});

test('a cycle field that is missing, empty, or not a map leaves the service text', () => {
  const service = {'create-proposal': {before: ['only']}};
  const expected = [
    '# plan',
    '',
    'only',
    '',
    '## Steps',
    '',
    '1. go',
    '',
    '## Check',
    '',
    '- done',
    '',
  ].join('\n');
  assert.equal(stepPrompt(plan, 'create-proposal', service, undefined), expected);
  assert.equal(stepPrompt(plan, 'create-proposal', service, {}), expected);
  assert.equal(stepPrompt(plan, 'create-proposal', service, 'nope'), expected);
  assert.equal(stepPrompt(plan, 'create-proposal', service, 4), expected);
  assert.equal(
    stepPrompt(plan, 'create-proposal', service, [
      {action: 'create-proposal', point: 'before', value: 'list'},
    ]),
    expected,
  );
});

test('a point that is not text is not in the cycle map', () => {
  assert.deepEqual(cycleHooks({archive: {before: '', after: 4, during: 'stay'}}), {
    archive: {during: 'stay'},
  });
  assert.deepEqual(cycleHooks('nope'), {});
  assert.deepEqual(cycleHooks(null), {});
});

test('the step file the runtime sends is the package step with the hooks inserted', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const file = readFileSync(path.join(root, 'skills/sdd-flow/steps/accept.md'), 'utf8');
  const result = stepPrompt(
    file,
    'unarchive',
    {},
    {archive: {before: 'FOLD-SECRET'}, unarchive: {before: 'UN-BEFORE'}},
  );
  assert.equal(result.includes('FOLD-SECRET'), false);
  assert.ok(result.indexOf('UN-BEFORE') < result.indexOf('## unarchive'));
  assert.ok(result.indexOf('## archive') < result.indexOf('UN-BEFORE'));
});

spec('hook', () => {
  requirement('The cycle keeps one sddHooks map', () => {
    scenario('Spaces are not a point', () => {
      proveSpacesAreNotAPoint();
    });
  });
  requirement('The prompt inserts service lines and then the cycle paragraph', () => {
    scenario('Service text precedes the cycle paragraph', () => {
      proveServiceTextPrecedesTheCycleParagraph();
    });
    scenario('A missing cycle paragraph adds no blank line', () => {
      proveAMissingCycleParagraphAddsNoBlankLine();
    });
    scenario('Steps keeps the slice in place', () => {
      proveStepsKeepsTheSliceInPlace();
    });
    scenario('Archive does not enter unarchive', () => {
      proveArchiveDoesNotEnterUnarchive();
    });
    scenario('Without Steps the anchor is the action section', () => {
      proveWithoutStepsTheAnchorIsTheActionSection();
    });
  });
});
