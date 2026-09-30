import assert from 'node:assert/strict';
import {test} from 'vitest';

import {markerName, mentionsGrammar, parseMarker} from './marker.ts';

test('one parser reads every marker, fixed first, then note, then a layer', () => {
  assert.deepEqual(parseMarker('🤖 sdd:layer=spec → specifying'), {kind: 'layer', layer: 'spec'});
  assert.deepEqual(parseMarker('sdd:note baseline'), {kind: 'note'});
  assert.deepEqual(parseMarker('🤖 sdd:fixed abc123'), {kind: 'fixed', commit: 'abc123'});
  assert.deepEqual(parseMarker('sdd:fixed'), {kind: 'fixed', commit: null});
  assert.deepEqual(parseMarker('<!-- sdd:begin -->'), {kind: 'begin'});
  assert.deepEqual(parseMarker('sdd:layer=code sdd:fixed abc'), {kind: 'fixed', commit: 'abc'});
  assert.deepEqual(parseMarker('sdd:note sdd:layer=code'), {kind: 'note'});
  assert.equal(parseMarker('please fix the name'), null);
  assert.equal(parseMarker('sdd:layer=Spec'), null);
  assert.equal(markerName(parseMarker('sdd:layer=code')), 'code');
  assert.equal(markerName(parseMarker('sdd:fixed abc')), 'fixed');
  assert.equal(markerName(null), null);
});

test('a remark may not mention any marker token, even malformed, or the robot mark', () => {
  assert.equal(mentionsGrammar('rename the cache'), false);
  assert.equal(mentionsGrammar('sdd:layer=Spec'), true);
  assert.equal(mentionsGrammar('see sdd:fixed'), true);
  assert.equal(mentionsGrammar('🤖 done'), true);
});
