import type {SpecEntry} from '../spec-diff.ts';
import type {SpineLayer} from '../spine.ts';
import type {WindowSnapshot} from '../snapshot.ts';
import type {LineDraft} from './gesture.ts';

import {createRoot} from 'react-dom/client';

import {App} from './app.tsx';
import {postForm} from './forms.tsx';
import {
  draftsAfterClick,
  focusStaysInForm,
  gesture,
  headClickToggles,
  lineFieldClosesOnEscape,
  payload,
  scenarioTarget,
  SHEET_FIELD_KEY,
  SHEET_SCROLL_KEY,
  toggleFold,
} from './gesture.ts';

type FoldMemory = {id: string; rows: readonly SpecEntry[]; open: number[]};

type Memory = {
  key?: string;
  station?: string;
  layer?: SpineLayer | '';
  drafts: LineDraft[];
  folds: FoldMemory[];
  openCaps: string[];
  scroll?: {id: string; name: string};
};

function lineDrafts(): LineDraft[] {
  return Array.from(document.querySelectorAll('.spine form.line-note')).map(form => {
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

function sameRows(left: readonly SpecEntry[], right: readonly SpecEntry[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function gapIndex(value: string | null): number | undefined {
  if (value === null || !/^\d+$/.test(value)) {
    return undefined;
  }
  return Number(value);
}

function rememberFold(
  memory: Memory,
  id: string,
  rows: readonly SpecEntry[],
  open: readonly number[],
): void {
  const rest = memory.folds.filter(item => item.id !== id);
  if (open.length === 0) {
    memory.folds = rest;
    return;
  }
  memory.folds = [...rest, {id, rows, open: [...open]}];
}

function reconcileFolds(memory: Memory, shot: WindowSnapshot): void {
  const opened = shot.opened;
  if (opened === undefined) {
    memory.folds = [];
    memory.openCaps = [];
    return;
  }
  const next: FoldMemory[] = [];
  for (const fold of memory.folds) {
    const cap = opened.spine.capabilities.find(item => item.id === fold.id);
    if (cap === undefined || !sameRows(cap.rows, fold.rows)) {
      continue;
    }
    next.push(fold);
  }
  memory.folds = next;
}

function revealCaps(memory: Memory): void {
  for (const id of memory.openCaps) {
    const cap = document.getElementById(`cap-${id}`);
    if (cap instanceof HTMLDetailsElement) {
      cap.open = true;
    }
  }
  const pending = memory.scroll;
  memory.scroll = undefined;
  if (pending === undefined || pending.name === '') {
    return;
  }
  const cap = document.getElementById(`cap-${pending.id}`);
  if (cap instanceof HTMLDetailsElement) {
    cap.open = true;
  }
  const row = cap?.querySelector(`[data-scenario=${CSS.escape(pending.name)}]`);
  if (row instanceof HTMLElement) {
    row.scrollIntoView({block: 'nearest'});
  }
}

function onFold(memory: Memory, shot: WindowSnapshot, bar: HTMLElement): boolean {
  const opened = shot.opened;
  if (opened === undefined) {
    return false;
  }
  const id = bar.getAttribute('data-cap') ?? '';
  const index = gapIndex(bar.getAttribute('data-gap'));
  const cap = opened.spine.capabilities.find(item => item.id === id);
  if (id === '' || index === undefined || cap === undefined) {
    return false;
  }
  memory.drafts = lineDrafts();
  const current = memory.folds.find(item => item.id === id && sameRows(item.rows, cap.rows));
  const open = toggleFold(current === undefined ? [] : current.open, index);
  rememberFold(memory, id, cap.rows, open);
  return true;
}

function onJump(memory: Memory, shot: WindowSnapshot, jump: HTMLElement): boolean {
  const opened = shot.opened;
  if (opened === undefined) {
    return false;
  }
  const id = jump.getAttribute('data-cap') ?? '';
  const name = jump.textContent?.trim() ?? '';
  const cap = opened.spine.capabilities.find(item => item.id === id);
  if (id === '' || name === '' || cap === undefined) {
    return false;
  }
  const found = scenarioTarget(cap.rows, id, name);
  if (found === undefined) {
    return false;
  }
  memory.drafts = lineDrafts();
  const current = memory.folds.find(item => item.id === id && sameRows(item.rows, cap.rows));
  const open = current === undefined ? [] : [...current.open];
  if (found.gap !== undefined && !open.includes(found.gap)) {
    open.push(found.gap);
  }
  rememberFold(memory, id, cap.rows, open);
  if (!memory.openCaps.includes(found.capability)) {
    memory.openCaps = [...memory.openCaps, found.capability];
  }
  memory.scroll = {id: found.capability, name: found.name};
  return true;
}

function keptLayer(memory: Memory, next: WindowSnapshot): SpineLayer | undefined {
  const opened = next.opened;
  if (!opened) {
    return undefined;
  }
  if (memory.key !== opened.key || memory.station !== opened.spine.station) {
    memory.drafts = [];
    if (memory.key !== opened.key) {
      memory.folds = [];
      memory.openCaps = [];
      memory.scroll = undefined;
    }
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
  const memory: Memory = {drafts: [], folds: [], openCaps: []};
  const draw = () => {
    if (!shot) {
      return;
    }
    const layer = keptLayer(memory, shot);
    memory.key = shot.opened?.key;
    memory.station = shot.opened?.spine.station;
    memory.layer = layer ?? '';
    reconcileFolds(memory, shot);
    view.render(
      <App
        snapshot={shot}
        layer={layer}
        drafts={memory.drafts}
        gaps={memory.folds}
        openCaps={memory.openCaps}
      />,
    );
    revealCaps(memory);
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
  document.addEventListener(
    'scroll',
    event => {
      const sheet = event.target;
      if (!(sheet instanceof HTMLElement) || !sheet.classList.contains('sheet')) {
        return;
      }
      sessionStorage.setItem(SHEET_SCROLL_KEY, String(sheet.scrollTop));
    },
    true,
  );
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
    const toggles =
      target !== null && (headClickToggles(target) || target.closest('label') !== null);
    if (row && toggles && target?.closest('.acts') === null && shot?.opened) {
      const pick = row.parentElement?.querySelector('.spine-pick');
      const layer = pick?.getAttribute('value');
      if (layer) {
        memory.layer = memory.layer === layer ? '' : (layer as SpineLayer);
        draw();
      }
    }
    const bar = target?.closest('button.fold-bar');
    if (bar instanceof HTMLElement) {
      if (shot && onFold(memory, shot, bar)) {
        draw();
      }
      return;
    }
    const jump = target?.closest('button.jump');
    if (jump instanceof HTMLElement) {
      if (shot && onJump(memory, shot, jump)) {
        draw();
      }
      return;
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
