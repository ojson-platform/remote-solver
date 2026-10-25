import assert from 'node:assert/strict';
import {test} from 'vitest';

import {crossButton, fieldClose, hairline, pill, rootCss, sendMark} from './face.ts';

test('the face emits the named controls', () => {
  assert.equal(pill('Настройки'), '<button class="cmd" type="submit">Настройки</button>');
  assert.equal(
    pill('Записать сервис', ' disabled'),
    '<button class="cmd" type="submit" disabled>Записать сервис</button>',
  );
  assert.equal(hairline('Удалить'), '<button class="quiet" type="submit">Удалить</button>');
  assert.match(crossButton('Закрыть'), /class="x"[^>]*aria-label="Закрыть"/);
  assert.match(sendMark(), /class="send"[^>]*aria-label="Записать"/);
  assert.match(fieldClose(), /class="shut"[^>]*aria-label="Закрыть"/);
  assert.match(rootCss, /--bg: #0e0d0b/);
  assert.match(rootCss, /--brass: #e6b35a/);
  assert.match(rootCss, /--line: rgba\(244, 240, 230, 0\.1\)/);
});
