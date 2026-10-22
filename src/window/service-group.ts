import {mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';

import {stringify} from 'yaml';

import {ACTION_SKILL} from '../machine/route.ts';

import {queueNames, readServiceFile, serviceFile} from './checkout.ts';
import {
  isDoc,
  type Doc,
  type ServiceConfigGroup,
  type ServiceHookChoice,
  type ServiceHookField,
  type ServiceIgnoreField,
  type ServiceQueueField,
} from './types.ts';

type ServiceQueueDraft = {name: string; description: string};

type ServiceIgnoreDraft = {value: string; removeOnly?: true};

type ServiceDraft = {
  queues: ServiceQueueDraft[];
  base: string;
  branchScope: string;
  ignore: ServiceIgnoreDraft[];
  hooks: ServiceHookField[];
};

function queueDraft(value: unknown): ServiceQueueDraft[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(item => {
    if (typeof item === 'string') {
      return {name: item, description: ''};
    }
    if (!isDoc(item)) {
      return {name: '', description: ''};
    }
    return {
      name: typeof item.name === 'string' ? item.name : '',
      description: typeof item.description === 'string' ? item.description : '',
    };
  });
}

function ignoreText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value === null) {
    return 'null';
  }
  try {
    return stringify(value).trim();
  } catch {
    return '';
  }
}

function ignoreDraft(value: unknown): ServiceIgnoreDraft[] {
  if (value === undefined) {
    return [];
  }
  if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
    return value.map(item => ({value: item}));
  }
  return [{value: ignoreText(value), removeOnly: true}];
}

function blank(value: string): boolean {
  return value.trim() === '';
}

/** A string or a list of strings. Anything else has no field. Spaces are not an entry. */
function stringValues(value: unknown): string[] | undefined {
  if (typeof value === 'string') {
    return blank(value) ? [] : [value];
  }
  if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
    return value.filter(item => !blank(item));
  }
  return undefined;
}

function hooksFrom(sdd: Doc): ServiceHookField[] {
  if (!isDoc(sdd.hooks)) {
    return [];
  }
  const hooks: ServiceHookField[] = [];
  for (const [action, points] of Object.entries(sdd.hooks)) {
    if (!isDoc(points)) {
      continue;
    }
    for (const [point, value] of Object.entries(points)) {
      const values = stringValues(value);
      if (!values || values.length === 0) {
        continue;
      }
      hooks.push({action, point, values});
    }
  }
  return hooks;
}

const HOOK_POINTS = ['before', 'after'] as const;

function hookId(action: string, point: string): string {
  return `${action}\0${point}`;
}

/** Points already shown, plus a non-string value that still occupies the key. */
function takenIds(draft: ServiceDraft, doc: Doc | null): Set<string> {
  const taken = new Set(draft.hooks.map(item => hookId(item.action, item.point)));
  const sdd = doc && isDoc(doc.sdd) ? doc.sdd : undefined;
  const hooks = sdd && isDoc(sdd.hooks) ? sdd.hooks : undefined;
  if (!hooks) {
    return taken;
  }
  for (const [action, points] of Object.entries(hooks)) {
    if (!isDoc(points)) {
      continue;
    }
    for (const [point, value] of Object.entries(points)) {
      if (stringValues(value) === undefined) {
        taken.add(hookId(action, point));
      }
    }
  }
  return taken;
}

/** Free points of the actions the agent decision prints. An action with none is absent. */
function hookChoices(draft: ServiceDraft, doc: Doc | null): ServiceHookChoice[] {
  const taken = takenIds(draft, doc);
  const choices: ServiceHookChoice[] = [];
  for (const action of Object.keys(ACTION_SKILL)) {
    for (const point of HOOK_POINTS) {
      if (!taken.has(hookId(action, point))) {
        choices.push({action, point});
      }
    }
  }
  return choices;
}

function textField(value: unknown, fallback: string): string {
  return typeof value === 'string' && value !== '' ? value : fallback;
}

function draftFrom(doc: Doc): ServiceDraft {
  const sdd = isDoc(doc.sdd) ? doc.sdd : {};
  return {
    queues: queueDraft(sdd.queues),
    base: textField(sdd.base, 'trunk'),
    branchScope: textField(sdd['branch-scope'], 'sdd'),
    ignore: ignoreDraft(sdd['ignore-comments']),
    hooks: hooksFrom(sdd),
  };
}

function blankDraft(): ServiceDraft {
  return {queues: [], base: 'trunk', branchScope: 'sdd', ignore: [], hooks: []};
}

/** Same flags as `compileIgnore`: a pattern that throws is not saved. */
function patternCompiles(pattern: string): boolean {
  try {
    new RegExp(pattern, 'i');
    return true;
  } catch {
    return false;
  }
}

function queueFields(queues: readonly ServiceQueueDraft[]): {
  items: ServiceQueueField[];
  warning?: true;
} {
  const items = queues.map(queue => {
    const field: ServiceQueueField = {name: queue.name, description: queue.description};
    if (queue.name === '') {
      field.warning = true;
    }
    return field;
  });
  if (items.length === 0) {
    return {items, warning: true};
  }
  return {items};
}

function ignoreFields(ignore: readonly ServiceIgnoreDraft[]): ServiceIgnoreField[] {
  return ignore.map(item => {
    const field: ServiceIgnoreField = {value: item.value};
    if (item.removeOnly) {
      field.removeOnly = true;
      field.warning = true;
      return field;
    }
    if (!patternCompiles(item.value)) {
      field.warning = true;
    }
    return field;
  });
}

function groupOf(checkout: string, draft: ServiceDraft, doc: Doc | null): ServiceConfigGroup {
  const queues = queueFields(draft.queues);
  const ignoreComments = ignoreFields(draft.ignore);
  const warned =
    queues.warning === true ||
    queues.items.some(item => item.warning === true) ||
    ignoreComments.some(item => item.warning === true);
  return {
    file: 'openspec/config.yaml',
    checkout,
    save: !warned,
    queues,
    base: draft.base,
    branchScope: draft.branchScope,
    ignoreComments,
    hooks: draft.hooks,
    hookChoices: hookChoices(draft, doc),
  };
}

function emptyService(checkout: string): ServiceConfigGroup {
  return {file: 'openspec/config.yaml', checkout, save: false};
}

/** Draft lists replace string points. A non-string stays. An empty list does not write the point. */
function applyHooks(original: unknown, draft: readonly ServiceHookField[]): unknown {
  const next: Doc = {};
  const seen = new Set<string>();
  if (isDoc(original)) {
    for (const [action, points] of Object.entries(original)) {
      if (!isDoc(points)) {
        next[action] = points;
        continue;
      }
      const copy: Doc = {};
      for (const [point, value] of Object.entries(points)) {
        seen.add(hookId(action, point));
        if (stringValues(value) === undefined) {
          copy[point] = value;
          continue;
        }
        const field = draft.find(item => item.action === action && item.point === point);
        const values = field?.values.filter(item => !blank(item)) ?? [];
        if (values.length > 0) {
          copy[point] = values;
        }
      }
      if (Object.keys(copy).length > 0) {
        next[action] = copy;
      }
    }
  }
  for (const field of draft) {
    if (seen.has(hookId(field.action, field.point))) {
      continue;
    }
    const current = next[field.action];
    if (current !== undefined && !isDoc(current)) {
      continue;
    }
    const values = field.values.filter(item => !blank(item));
    if (values.length === 0) {
      continue;
    }
    const points: Doc = isDoc(current) ? {...current} : {};
    points[field.point] = values;
    next[field.action] = points;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function writtenService(doc: Doc | null, draft: ServiceDraft): Doc {
  const next: Doc = {...(doc ?? {})};
  const sdd: Doc = {...(isDoc(next.sdd) ? next.sdd : {})};
  sdd.queues = draft.queues.map(queue => {
    const item: Doc = {name: queue.name};
    if (queue.description !== '') {
      item.description = queue.description;
    }
    return item;
  });
  if (draft.base === 'trunk') {
    delete sdd.base;
  } else {
    sdd.base = draft.base;
  }
  if (draft.branchScope === 'sdd') {
    delete sdd['branch-scope'];
  } else {
    sdd['branch-scope'] = draft.branchScope;
  }
  if (!draft.ignore.some(item => item.removeOnly)) {
    if (draft.ignore.length === 0) {
      delete sdd['ignore-comments'];
    } else {
      sdd['ignore-comments'] = draft.ignore.map(item => item.value);
    }
  }
  const hooks = applyHooks(sdd.hooks, draft.hooks);
  if (hooks === undefined) {
    delete sdd.hooks;
  } else {
    sdd.hooks = hooks;
  }
  next.sdd = sdd;
  return next;
}

export function openServiceGroup() {
  let checkout = '';
  let serviceBaseline: string | null = null;
  let serviceDoc: Doc | null = null;
  let serviceDraft: ServiceDraft | null = null;
  let serviceDirty = false;

  function load(next: string): void {
    serviceDirty = false;
    const read = readServiceFile(next);
    if (read.kind === 'broken') {
      serviceBaseline = read.text;
      serviceDoc = null;
      serviceDraft = null;
      return;
    }
    if (read.kind === 'missing') {
      serviceBaseline = null;
      serviceDoc = null;
      serviceDraft = null;
      return;
    }
    serviceBaseline = read.text;
    serviceDoc = read.doc;
    serviceDraft = draftFrom(read.doc);
  }

  function bind(next: string): void {
    checkout = next;
    load(next);
  }

  function view(): ServiceConfigGroup {
    if (checkout === '') {
      return emptyService('');
    }
    const live = readServiceFile(checkout);
    if (live.kind === 'broken') {
      serviceDirty = false;
      serviceBaseline = live.text;
      serviceDoc = null;
      serviceDraft = null;
      return emptyService(checkout);
    }
    if (serviceDirty && serviceDraft) {
      return groupOf(checkout, serviceDraft, serviceDoc);
    }
    if (live.kind === 'missing') {
      serviceBaseline = null;
      serviceDoc = null;
      serviceDraft = null;
      return emptyService(checkout);
    }
    serviceBaseline = live.text;
    serviceDoc = live.doc;
    serviceDraft = draftFrom(live.doc);
    return groupOf(checkout, serviceDraft, serviceDoc);
  }

  function editable(): ServiceDraft | null {
    if (checkout === '' || readServiceFile(checkout).kind === 'broken') {
      return null;
    }
    if (serviceDraft) {
      serviceDirty = true;
      return serviceDraft;
    }
    const live = readServiceFile(checkout);
    if (live.kind === 'missing') {
      serviceBaseline = null;
      serviceDoc = null;
      serviceDraft = blankDraft();
    } else if (live.kind === 'doc') {
      serviceBaseline = live.text;
      serviceDoc = live.doc;
      serviceDraft = draftFrom(live.doc);
    } else {
      return null;
    }
    serviceDirty = true;
    return serviceDraft;
  }

  function discard(): void {
    serviceDirty = false;
    if (checkout !== '') {
      load(checkout);
    }
  }

  function setBase(value: string): void {
    const draft = editable();
    if (!draft) {
      return;
    }
    draft.base = value === '' ? 'trunk' : value;
  }

  function setBranchScope(value: string): void {
    const draft = editable();
    if (!draft) {
      return;
    }
    draft.branchScope = value === '' ? 'sdd' : value;
  }

  function addQueue(): void {
    const draft = editable();
    if (!draft) {
      return;
    }
    draft.queues.push({name: '', description: ''});
  }

  function setQueue(index: number, name: string, description: string): void {
    const draft = editable();
    const queue = draft?.queues[index];
    if (!draft || !queue) {
      return;
    }
    queue.name = name;
    queue.description = description;
  }

  function removeQueue(index: number): void {
    const draft = editable();
    if (!draft || index < 0 || index >= draft.queues.length) {
      return;
    }
    draft.queues.splice(index, 1);
  }

  function moveQueue(from: number, to: number): void {
    const draft = editable();
    if (!draft || from === to) {
      return;
    }
    if (from < 0 || to < 0 || from >= draft.queues.length || to >= draft.queues.length) {
      return;
    }
    const [item] = draft.queues.splice(from, 1);
    if (!item) {
      return;
    }
    draft.queues.splice(to, 0, item);
  }

  function addIgnore(value: string): void {
    const draft = editable();
    if (!draft || draft.ignore.some(item => item.removeOnly)) {
      return;
    }
    draft.ignore.push({value});
  }

  function setIgnore(index: number, value: string): void {
    const draft = editable();
    if (!draft || draft.ignore.some(item => item.removeOnly)) {
      return;
    }
    if (!draft.ignore[index]) {
      return;
    }
    draft.ignore[index] = {value};
  }

  function removeIgnore(index: number): void {
    const draft = editable();
    if (!draft || index < 0 || index >= draft.ignore.length) {
      return;
    }
    draft.ignore.splice(index, 1);
  }

  function save(): void {
    if (checkout === '' || !serviceDraft) {
      return;
    }
    const live = readServiceFile(checkout);
    if (live.kind === 'broken') {
      serviceDirty = false;
      serviceBaseline = live.text;
      serviceDoc = null;
      serviceDraft = null;
      return;
    }
    if (!groupOf(checkout, serviceDraft, serviceDoc).save) {
      return;
    }
    const disk = live.kind === 'missing' ? null : live.text;
    if (disk !== serviceBaseline) {
      load(checkout);
      return;
    }
    const next = writtenService(serviceDoc, serviceDraft);
    const file = serviceFile(checkout);
    mkdirSync(path.dirname(file), {recursive: true});
    const text = stringify(next);
    writeFileSync(file, text);
    serviceBaseline = text;
    serviceDoc = next;
    serviceDraft = draftFrom(next);
    serviceDirty = false;
  }

  function chooseHook(action: string, point: string, first: string): void {
    if (blank(first)) {
      return;
    }
    const draft = editable();
    if (!draft) {
      return;
    }
    const allowed = hookChoices(draft, serviceDoc).some(
      item => item.action === action && item.point === point,
    );
    if (!allowed) {
      return;
    }
    draft.hooks.push({action, point, values: [first]});
  }

  function setHook(action: string, point: string, values: readonly string[]): void {
    const draft = editable();
    if (!draft) {
      return;
    }
    const index = draft.hooks.findIndex(item => item.action === action && item.point === point);
    if (index < 0) {
      return;
    }
    const next = values.filter(item => !blank(item));
    if (next.length === 0) {
      draft.hooks.splice(index, 1);
      return;
    }
    draft.hooks[index] = {action, point, values: next};
  }

  function childQueue(): string {
    if (checkout === '') {
      return '';
    }
    return queueNames(checkout)?.[0] ?? '';
  }

  return {
    bind,
    view,
    discard,
    setBase,
    setBranchScope,
    addQueue,
    setQueue,
    removeQueue,
    moveQueue,
    addIgnore,
    setIgnore,
    removeIgnore,
    chooseHook,
    setHook,
    save,
    childQueue,
  };
}
