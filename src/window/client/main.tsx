import {createRoot} from 'react-dom/client';

import type {SpineLayer} from '../spine.ts';
import type {WindowSnapshot} from '../snapshot.ts';

import {App} from './app.tsx';
import {postForm} from './forms.tsx';
import {
  draftsAfterClick,
  focusStaysInForm,
  gesture,
  headClickToggles,
  lineFieldClosesOnEscape,
  payload,
  SHEET_FIELD_KEY,
  SHEET_SCROLL_KEY,
  type LineDraft,
} from './gesture.ts';

type Memory = {key?: string; station?: string; layer?: SpineLayer | ''; drafts: LineDraft[]};

function lineDrafts(): LineDraft[] {
  return Array.from(document.querySelectorAll('.doc form.line-note')).map(form => {
    const line = form.previousElementSibling;
    const field = form.querySelector('textarea');
    const question = form.querySelector('[name="question"]');
    return {
      line: line instanceof HTMLElement ? (line.getAttribute('data-line') ?? '') : '',
      text: field instanceof HTMLTextAreaElement ? field.value : '',
      question: question instanceof HTMLInputElement ? question.value : '',
    };
  });
}

function keptLayer(memory: Memory, next: WindowSnapshot): SpineLayer | undefined {
  const opened = next.opened;
  if (!opened) {
    return undefined;
  }
  if (memory.key !== opened.key || memory.station !== opened.spine.station) {
    memory.drafts = [];
    return opened.spine.open;
  }
  if (memory.layer === '') {
    return undefined;
  }
  return memory.layer ?? opened.spine.open;
}

async function readSnapshot(): Promise<WindowSnapshot> {
  const response = await fetch('/snapshot');
  return response.json() as Promise<WindowSnapshot>;
}

function boot(): void {
  const root = document.getElementById('root');
  if (!root) {
    return;
  }
  const view = createRoot(root);
  let shot: WindowSnapshot | undefined;
  const memory: Memory = {drafts: []};
  const draw = () => {
    if (!shot) {
      return;
    }
    const layer = keptLayer(memory, shot);
    memory.key = shot.opened?.key;
    memory.station = shot.opened?.spine.station;
    memory.layer = layer ?? '';
    view.render(<App snapshot={shot} layer={layer} drafts={memory.drafts} />);
    const show = shot.show;
    if (show) {
      const card = document.querySelector(`article[data-key="${CSS.escape(show)}"]`);
      const board = document.querySelector('.board');
      if (card instanceof HTMLElement && board instanceof HTMLElement) {
        const cardRect = card.getBoundingClientRect();
        const boxRect = board.getBoundingClientRect();
        if (cardRect.top < boxRect.top) {
          board.scrollTop -= boxRect.top - cardRect.top;
        } else if (cardRect.bottom > boxRect.bottom) {
          board.scrollTop += cardRect.bottom - boxRect.bottom;
        }
      }
    }
    const sheet = document.querySelector('.sheet');
    if (sheet instanceof HTMLElement) {
      const saved = sessionStorage.getItem(SHEET_SCROLL_KEY);
      const fieldName = sessionStorage.getItem(SHEET_FIELD_KEY);
      if (fieldName) {
        const field = sheet.querySelector(`[name="${CSS.escape(fieldName)}"]`);
        if (field instanceof HTMLElement) {
          field.focus({preventScroll: true});
        }
      }
      if (saved !== null) {
        sheet.scrollTop = Number(saved);
      }
    }
  };
  const take = async (next: WindowSnapshot) => {
    shot = next;
    draw();
  };
  document.addEventListener('submit', event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.method.toLowerCase() !== 'post') {
      return;
    }
    event.preventDefault();
    const path = new URL(form.action, location.href).pathname;
    void fetch(path, {
      method: 'POST',
      headers: {'content-type': 'application/x-www-form-urlencoded'},
      body: postForm(form),
    }).then(async response => {
      if (!response.ok) {
        return;
      }
      await take((await response.json()) as WindowSnapshot);
    });
  });
  document.addEventListener('dragstart', event => {
    const card = event.target;
    if (!(card instanceof HTMLElement)) {
      return;
    }
    const article = card.closest('article.ticket.pool');
    if (!(article instanceof HTMLElement) || !event.dataTransfer) {
      return;
    }
    const key = article.getAttribute('data-key') ?? '';
    const raw = `pool\n${key}`;
    event.dataTransfer.setData('application/x-ai-factory', raw);
    event.dataTransfer.setData('text/plain', raw);
  });
  document.addEventListener('dragover', event => {
    const station = event.target instanceof Element ? event.target.closest('.station') : null;
    if (!station) {
      return;
    }
    event.preventDefault();
    station.classList.add('over');
  });
  document.addEventListener('drop', event => {
    const station = event.target instanceof Element ? event.target.closest('.station') : null;
    if (!station) {
      return;
    }
    station.classList.remove('over');
    const [type, value] = payload(event);
    if (gesture(type, value, 'station') !== 'take') {
      return;
    }
    event.preventDefault();
    void fetch('/take', {
      method: 'POST',
      headers: {'content-type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({key: value}),
    }).then(async response => {
      if (response.ok) {
        await take((await response.json()) as WindowSnapshot);
      }
    });
  });
  document.addEventListener('focusout', event => {
    const form = event.target instanceof Element ? event.target.closest('form.pair') : null;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }
    const next = event.relatedTarget instanceof Node ? event.relatedTarget : null;
    if (focusStaysInForm(form, next)) {
      return;
    }
    form.requestSubmit();
  });
  document.addEventListener('scroll', event => {
    const sheet = event.target;
    if (!(sheet instanceof HTMLElement) || !sheet.classList.contains('sheet')) {
      return;
    }
    sessionStorage.setItem(SHEET_SCROLL_KEY, String(sheet.scrollTop));
  }, true);
  document.addEventListener('focusin', event => {
    const sheet = event.target instanceof Element ? event.target.closest('.sheet') : null;
    const field = event.target;
    if (!(sheet instanceof HTMLElement) || !(field instanceof HTMLElement)) {
      return;
    }
    const name = field.getAttribute('name');
    if (name) {
      sessionStorage.setItem(SHEET_FIELD_KEY, name);
    }
  });
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    const row = target?.closest('.spine .row');
    const toggles = target !== null && (headClickToggles(target) || target.closest('label') !== null);
    if (row && toggles && target?.closest('.acts') === null && shot?.opened) {
      const pick = row.parentElement?.querySelector('.spine-pick');
      const layer = pick?.getAttribute('value');
      if (layer) {
        memory.layer = memory.layer === layer ? '' : (layer as SpineLayer);
        draw();
      }
    }
    const dismiss = target?.closest('[data-dismiss-line]');
    if (dismiss) {
      const form = dismiss.closest('form.line-note');
      const line = form?.previousElementSibling;
      const name = line instanceof HTMLElement ? (line.getAttribute('data-line') ?? '') : '';
      memory.drafts = lineDrafts().filter(item => item.line !== name && item.text.trim() !== '');
      draw();
      return;
    }
    const line = target?.closest('button.line');
    if (line instanceof HTMLElement) {
      const targetLine = line.getAttribute('data-line') ?? '';
      const current = lineDrafts();
      const next = draftsAfterClick(current, targetLine);
      memory.drafts = next.map(item => ({
        line: item.line,
        text: item.text,
        question:
          item.line === targetLine
            ? (line.getAttribute('data-question') ?? '')
            : (current.find(draft => draft.line === item.line)?.question ?? ''),
      }));
      draw();
    }
  });
  document.addEventListener('keydown', event => {
    const target = event.target;
    const form = target instanceof Element ? target.closest('form.line-note') : null;
    if (lineFieldClosesOnEscape(event.key, form instanceof HTMLFormElement)) {
      const line = form?.previousElementSibling;
      const name = line instanceof HTMLElement ? (line.getAttribute('data-line') ?? '') : '';
      memory.drafts = lineDrafts().filter(item => item.line !== name);
      draw();
    }
  });
  const source = new EventSource('/events');
  source.addEventListener('change', () => {
    void readSnapshot().then(take);
  });
  void readSnapshot().then(take);
}

boot();
