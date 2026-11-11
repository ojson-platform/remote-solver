import {focusMarkerLine, isFocusRecord, type FocusMarkerLine} from './marker.ts';

/** Prose after the marker line of a focus comment. */
export function focusProse(body: string): string | undefined {
  if (!isFocusRecord(body)) {
    return undefined;
  }
  const prose = body.split('\n').slice(1).join('\n').replace(/\s+$/, '');
  return prose === '' ? undefined : prose;
}

/** Paragraphs separated by a blank line; trailing empty segments dropped. */
export function focusProseParagraphs(prose: string): string[] {
  return prose
    .split(/\n\s*\n/)
    .map(part => part.trim())
    .filter(part => part.length > 0);
}

const PHASE_NEXT =
  /\b(proposing|specifying|designing|tasking|implementing|accepting)\b|следующ(?:ая|ую)\s+фаз/i;
const DIFF_MARK = /^(\+\+\+|---|@@|\s*diff )/m;
const OPEN_ITEM = /-\s*\[\s*[ xX]\]/;
const LEDGER_MARK = /Plan solid|thread PRRT|^## /m;
const CYRILLIC = /[\u0400-\u04FF]/;

const MARKER_SHAPE: Record<FocusMarkerLine, {need: RegExp[]; maxParas: number}> = {
  'sdd:focus:plan': {
    need: [/читател|тикет|reader of the ticket/i, /отказ|refused/i],
    maxParas: 2,
  },
  'sdd:focus:spec': {
    need: [
      /нов|new promise/i,
      /измен|existing promise changed/i,
      /сценар|scenario without/i,
      /не даём|does not make/i,
    ],
    maxParas: 2,
  },
  'sdd:focus:design': {
    need: [
      /жив|behavior lives/i,
      /отверг|rejected/i,
      /не стро|deliberately not/i,
      /наблюд|observed/i,
    ],
    maxParas: 2,
  },
  'sdd:focus:tasks': {
    need: [/слайс|slice/i, /порядок|порядк|order|Сначала|затем/i, /ждёт|waits/i],
    maxParas: 2,
  },
  'sdd:focus:code': {
    need: [/после коммита|became true/i, /не трог|left untouched/i, /не доказ|does not prove/i],
    maxParas: 2,
  },
  'sdd:focus:accept': {
    need: [/есть|легло|has now|person has now/i, /намерен|left out on purpose/i],
    maxParas: 2,
  },
  'sdd:focus': {
    need: [/pull request|PR|whole|весь/i],
    maxParas: 2,
  },
};

const THREAD_FIX_REMARK = /замечан|remark|ревью/i;
const FURTHER_PARA = /отказ|refused|слаб|weak|слабое место|открыт|open questions/i;
const LOOK_AT = /смотреть|look at/i;
const ARCHIVE_COUNT = /\d+[^\n]{0,40}(?:capabilit|сценари|тест)|сколько\s+(?:способност|сценари|тест)|how many capabilities/i;
const WEAK_SPOT_SENTENCE = /слабое\s+место/i;

/** Clean visit: one paragraph, or plan with open questions as the only second paragraph. */
function isCleanPhaseVisit(
  marker: FocusMarkerLine,
  paras: readonly string[],
  prose: string,
  threadFix: boolean,
): boolean {
  if (threadFix) {
    return false;
  }
  if (marker === 'sdd:focus:plan') {
    const hasPointer = /\d+\s+открыт|open questions/i.test(prose);
    return paras.length === 1 && !hasPointer;
  }
  return paras.length === 1;
}

function markerContentOk(marker: FocusMarkerLine, prose: string): boolean {
  const shape = MARKER_SHAPE[marker];
  return shape.need.every(re => re.test(prose));
}

/** Thread-fix visits name remarks in the second paragraph or add a third look-at paragraph. */
function isThreadFixVisit(paras: readonly string[]): boolean {
  if (paras.length >= 3) {
    return true;
  }
  if (paras.length >= 2 && THREAD_FIX_REMARK.test(paras[1] ?? '')) {
    return true;
  }
  return false;
}

/**
 * When prose breaks Publish paragraph rules, a short reason; otherwise undefined.
 * Skills pass bodies the focus verb posts unchanged.
 */
export function validateFocusBody(body: string): string | undefined {
  const marker = focusMarkerLine(body);
  const prose = focusProse(body);
  if (marker === null || prose === undefined) {
    return 'focus body needs a recognized marker and prose';
  }
  if (!CYRILLIC.test(prose)) {
    return 'prose must be Russian';
  }
  if (prose.length > 900) {
    return 'prose must stay short';
  }
  if (LEDGER_MARK.test(prose) || DIFF_MARK.test(prose) || OPEN_ITEM.test(prose)) {
    return 'prose must not include ledger, diff, or open-question text';
  }
  if (PHASE_NEXT.test(prose)) {
    return 'prose must not choose the next phase';
  }
  const paras = focusProseParagraphs(prose);
  const shape = MARKER_SHAPE[marker];
  const threadFix = isThreadFixVisit(paras);
  const maxParas = threadFix ? 3 : shape.maxParas;
  if (paras.length > maxParas) {
    return 'too many paragraphs for this marker';
  }
  if (marker === 'sdd:focus:accept' && ARCHIVE_COUNT.test(prose)) {
    return 'archive prose must not count capabilities, scenarios, or tests';
  }
  if (!threadFix && !markerContentOk(marker, prose)) {
    return 'prose missing required shape for marker';
  }
  if (threadFix) {
    if (!markerContentOk(marker, paras[0] ?? '')) {
      return 'thread-fix first paragraph answers the phase question';
    }
    if (paras.length >= 2 && !THREAD_FIX_REMARK.test(paras[1] ?? '')) {
      return 'thread-fix second paragraph names remarks';
    }
    if (paras.length === 3 && !LOOK_AT.test(paras[2] ?? '')) {
      return 'last paragraph must say what to look at';
    }
    return undefined;
  }
  if (marker === 'sdd:focus:plan') {
    const hasPointer = /\d+\s+открыт|open questions/i.test(prose);
    if (hasPointer && paras.length !== 2) {
      return 'plan with open questions needs two paragraphs';
    }
    if (!hasPointer && paras.length !== 1) {
      return 'clean plan focus is one paragraph';
    }
    if (hasPointer && paras[1] && OPEN_ITEM.test(paras[1])) {
      return 'open-question pointer must not restate items';
    }
  }
  if (isCleanPhaseVisit(marker, paras, prose, threadFix) && WEAK_SPOT_SENTENCE.test(prose)) {
    return 'clean phase omits weak-spot wording';
  }
  if (paras.length === 2 && marker !== 'sdd:focus:plan') {
    const second = paras[1] ?? '';
    if (!FURTHER_PARA.test(second)) {
      return 'further paragraph must be refusal, open questions, or weak check';
    }
  }
  return undefined;
}

/** First sentence of focus prose through `.`, `!`, or `?`, or the first line when none appear. */
export function firstFocusSentence(body: string): string | undefined {
  const prose = focusProse(body);
  if (prose === undefined) {
    return undefined;
  }
  const flat = prose.replace(/\n+/g, ' ').trim();
  const match = flat.match(/^([\s\S]*?[.!?])(?:\s|$)/);
  if (match) {
    return match[1].trim();
  }
  const firstLine = prose.split('\n')[0]?.trim() ?? '';
  return firstLine === '' ? undefined : firstLine;
}
