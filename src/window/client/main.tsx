import type {SpecEntry} from '../spec-diff.ts';
import type {SpineLayer} from '../spine.ts';
import type {WindowSnapshot} from '../snapshot.ts';
import type {LineDraft, SpecOpen} from './gesture.ts';
import type {BusyEdges, FrameHold} from './frame.ts';
import type {DocumentRemark} from './sidebar.tsx';

import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';

import {App} from './app.tsx';
import {postForm} from './forms.tsx';
import {busyEdges, emptyHold, holdGesture, paintFrame, releaseHold, settingsAct} from './frame.ts';
import {
  draftsAfterClick,
  foldsAfterSpec,
  focusStaysInForm,
  forcedAfterSpec,
  gesture,
  headClickToggles,
  keptSpineLayer,
  lineFieldClosesOnEscape,
  payload,
  rememberedSpec,
  revealFold,
  scenarioTarget,
  toggledSpineLayer,
  SHEET_FIELD_KEY,
  SHEET_SCROLL_KEY,
} from './gesture.ts';

type FoldMemory = {id: string; rows: readonly SpecEntry[]; open: number[]};

type Memory = {
  key?: string;
  station?: string;
  layer?: SpineLayer | '';
  drafts: LineDraft[];
  remark: DocumentRemark;
  folds: FoldMemory[];
  openCaps: string[];
  specs: SpecOpen[];
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

function blankRemark(): DocumentRemark {
  return {Plan: '', Specify: '', Design: ''};
}

function copyRemark(remark: DocumentRemark): DocumentRemark {
  return {Plan: remark.Plan, Specify: remark.Specify, Design: remark.Design};
}

function documentRemark(): DocumentRemark {
  const remark = blankRemark();
  for (const field of Array.from(document.querySelectorAll('.spine form.note textarea'))) {
    if (!(field instanceof HTMLTextAreaElement)) {
      continue;
    }
    const section = field.closest('.spine > section');
    const pick = section?.querySelector(':scope > .spine-pick');
    const layer = pick?.getAttribute('value') ?? '';
    if (layer === 'Plan' || layer === 'Specify' || layer === 'Design') {
      remark[layer] = field.value;
    }
  }
  return remark;
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
  if (pending === undefined || pending.name === '') {
    return;
  }
  const cap = document.getElementById(`cap-${pending.id}`);
  if (cap instanceof HTMLDetailsElement) {
    cap.open = true;
  }
  const row = cap?.querySelector(`[data-scenario=${CSS.escape(pending.name)}]`);
  if (!(row instanceof HTMLElement)) {
    return;
  }
  row.scrollIntoView({block: 'nearest'});
  memory.scroll = undefined;
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
  const open = revealFold(current === undefined ? [] : current.open, index);
  rememberFold(memory, id, cap.rows, open);
  return true;
}

function onSpecToggle(memory: Memory, details: HTMLDetailsElement): boolean {
  if (!details.classList.contains('cap') || !details.id.startsWith('cap-')) {
    return false;
  }
  const id = details.id.slice('cap-'.length);
  if (id === '') {
    return false;
  }
  const open = details.open;
  const specs = rememberedSpec(memory.specs, id, open);
  const folds = foldsAfterSpec(memory.folds, id, open);
  const openCaps = forcedAfterSpec(memory.openCaps, id, open);
  if (
    JSON.stringify(memory.specs) === JSON.stringify(specs) &&
    JSON.stringify(memory.folds) === JSON.stringify(folds) &&
    JSON.stringify(memory.openCaps) === JSON.stringify(openCaps)
  ) {
    return false;
  }
  memory.specs = specs;
  memory.folds = folds;
  memory.openCaps = openCaps;
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
  memory.layer = 'Specify';
  memory.scroll = {id: found.capability, name: found.name};
  return true;
}

function copyMemory(memory: Memory): Memory {
  const saved: Memory = {
    key: memory.key,
    station: memory.station,
    layer: memory.layer,
    drafts: memory.drafts.map(draft => ({
      line: draft.line,
      text: draft.text,
      question: draft.question,
    })),
    remark: copyRemark(memory.remark),
    folds: memory.folds.map(fold => ({
      id: fold.id,
      rows: structuredClone(fold.rows),
      open: [...fold.open],
    })),
    openCaps: [...memory.openCaps],
    specs: memory.specs.map(spec => ({id: spec.id, open: spec.open})),
  };
  if (memory.scroll !== undefined) {
    saved.scroll = {id: memory.scroll.id, name: memory.scroll.name};
  }
  return saved;
}

function restoreMemory(memory: Memory, saved: Memory): void {
  memory.key = saved.key;
  memory.station = saved.station;
  memory.layer = saved.layer;
  memory.drafts = saved.drafts;
  memory.remark = copyRemark(saved.remark);
  memory.folds = saved.folds;
  memory.openCaps = saved.openCaps;
  memory.specs = saved.specs;
  memory.scroll = saved.scroll;
}

function keptLayer(memory: Memory, next: WindowSnapshot): SpineLayer | '' | undefined {
  const opened = next.opened;
  if (opened && (memory.key !== opened.key || memory.station !== opened.spine.station)) {
    memory.drafts = [];
    memory.remark = blankRemark();
    if (memory.key !== opened.key) {
      memory.folds = [];
      memory.openCaps = [];
      memory.specs = [];
      memory.scroll = undefined;
    }
  }
  return keptSpineLayer(
    memory,
    opened ? {key: opened.key, station: opened.spine.station, open: opened.spine.open} : undefined,
  );
}

async function readSnapshot(): Promise<WindowSnapshot> {
  const response = await fetch('/snapshot');
  return response.json() as Promise<WindowSnapshot>;
}

function holdsSeq(hold: FrameHold, mine: number): boolean {
  return (
    hold.open?.seq === mine ||
    hold.settings?.seq === mine ||
    hold.gates.some(gate => gate.seq === mine)
  );
}

function boot(): void {
  const root = document.getElementById('root');
  if (!root) {
    return;
  }
  const view = createRoot(root);
  let shot: WindowSnapshot | undefined;
  let base: WindowSnapshot | undefined;
  let hold = emptyHold();
  let seq = 0;
  let gestures = 0;
  let settingsGestures = 0;
  let reading = false;
  const memory: Memory = {
    drafts: [],
    remark: blankRemark(),
    folds: [],
    openCaps: [],
    specs: [],
  };
  const draw = () => {
    if (base === undefined) {
      return;
    }
    const frame = paintFrame(base, hold);
    shot = frame;
    const layer = keptLayer(memory, frame);
    memory.key = frame.opened?.key;
    memory.station = frame.opened?.spine.station;
    memory.layer = layer ?? '';
    reconcileFolds(memory, frame);
    const busy: BusyEdges = busyEdges({
      gestures,
      reading,
      drawer: frame.opened !== undefined,
      spineReady: frame.opened?.spineReady !== false,
      settingsOpen: frame.settings.open,
      settingsGesture: settingsGestures > 0,
    });
    flushSync(() => {
      view.render(
        <App
          snapshot={frame}
          layer={layer}
          drafts={memory.drafts}
          remark={memory.remark}
          gaps={memory.folds}
          openCaps={memory.openCaps}
          specOpen={memory.specs}
          busy={busy}
        />,
      );
    });
    revealCaps(memory);
    const show = frame.show;
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
  const keep = (next: WindowSnapshot) => {
    if (base !== undefined && next.generation < base.generation) {
      return;
    }
    base = next;
  };
  const take = async (next: WindowSnapshot) => {
    keep(next);
    draw();
  };
  document.addEventListener('submit', event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.method.toLowerCase() !== 'post') {
      return;
    }
    event.preventDefault();
    const path = new URL(form.action, location.href).pathname;
    const params = postForm(form);
    const act = params.get('act') ?? '';
    const tracked = base !== undefined;
    let mine = 0;
    let drawerBefore: Memory | undefined;
    if (base !== undefined) {
      mine = ++seq;
      if (
        act === 'open' ||
        act === 'close-card' ||
        act === 'open-settings' ||
        act === 'close-settings' ||
        act === 'gate'
      ) {
        hold = holdGesture(hold, mine, act, params, paintFrame(base, hold));
      }
      if (act === 'open' || act === 'close-card') {
        memory.drafts = lineDrafts();
        memory.remark = documentRemark();
        drawerBefore = copyMemory(memory);
      }
      gestures += 1;
      if (settingsAct(act)) {
        settingsGestures += 1;
      }
      draw();
    }
    let settled = false;
    const finish = (snapshot: WindowSnapshot | undefined) => {
      if (settled) {
        return;
      }
      settled = true;
      if (tracked) {
        gestures -= 1;
        if (settingsAct(act)) {
          settingsGestures -= 1;
        }
        if (snapshot !== undefined && (mine === seq || holdsSeq(hold, mine))) {
          keep(snapshot);
          hold = releaseHold(hold, mine);
        } else if (snapshot === undefined) {
          hold = releaseHold(hold, mine);
        }
      } else if (snapshot !== undefined) {
        keep(snapshot);
      }
      if (snapshot === undefined && drawerBefore !== undefined) {
        restoreMemory(memory, drawerBefore);
      }
      draw();
    };
    void fetch(path, {
      method: 'POST',
      headers: {'content-type': 'application/x-www-form-urlencoded'},
      body: params,
    })
      .then(async response => {
        if (!response.ok) {
          return undefined;
        }
        return (await response.json()) as WindowSnapshot;
      })
      .then(snapshot => {
        finish(snapshot);
      })
      .catch(() => {
        finish(undefined);
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
    gestures += 1;
    draw();
    let dropped: WindowSnapshot | undefined;
    void fetch('/take', {
      method: 'POST',
      headers: {'content-type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({key: value}),
    })
      .then(async response => {
        if (response.ok) {
          dropped = (await response.json()) as WindowSnapshot;
        }
      })
      .catch(() => {
        dropped = undefined;
      })
      .finally(() => {
        gestures -= 1;
        if (dropped !== undefined) {
          void take(dropped);
          return;
        }
        draw();
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
  document.addEventListener(
    'toggle',
    event => {
      const details = event.target;
      if (!(details instanceof HTMLDetailsElement)) {
        return;
      }
      if (onSpecToggle(memory, details)) {
        draw();
      }
    },
    true,
  );
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    const row = target?.closest('.spine .row');
    const toggles =
      target !== null && (headClickToggles(target) || target.closest('label') !== null);
    if (row && toggles && target?.closest('.acts') === null && shot?.opened) {
      const pick = row.parentElement?.querySelector('.spine-pick');
      const next = toggledSpineLayer(memory.layer ?? '', pick?.getAttribute('value') ?? '');
      if (next !== undefined) {
        event.preventDefault();
        memory.layer = next;
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
    const line = target?.closest('button.line, button.diff-row');
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
  let reads = 0;
  source.addEventListener('change', () => {
    reads += 1;
    reading = true;
    draw();
    void readSnapshot()
      .then(body => {
        keep(body);
      })
      .catch(() => undefined)
      .finally(() => {
        reads -= 1;
        reading = reads > 0;
        draw();
      });
  });
  void readSnapshot().then(take);
}

boot();
