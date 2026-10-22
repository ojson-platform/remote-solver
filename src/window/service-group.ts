import {mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';

import {stringify} from 'yaml';

import {queueNames, readServiceFile, serviceFile} from './checkout.ts';
import {
  isDoc,
  type Doc,
  type ServiceConfigGroup,
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
      if (typeof value === 'string') {
        hooks.push({action, point, values: [value]});
      } else if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
        hooks.push({action, point, values: [...value]});
      }
    }
  }
  return hooks;
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

function groupOf(checkout: string, draft: ServiceDraft): ServiceConfigGroup {
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
  };
}

function emptyService(checkout: string): ServiceConfigGroup {
  return {file: 'openspec/config.yaml', checkout, save: false};
}

function normalizeHooks(hooks: unknown): unknown {
  if (!isDoc(hooks)) {
    return hooks;
  }
  const next: Doc = {};
  for (const [action, points] of Object.entries(hooks)) {
    if (!isDoc(points)) {
      next[action] = points;
      continue;
    }
    const copy: Doc = {};
    for (const [point, value] of Object.entries(points)) {
      if (typeof value === 'string') {
        copy[point] = [value];
      } else if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
        copy[point] = [...value];
      } else {
        copy[point] = value;
      }
    }
    next[action] = copy;
  }
  return next;
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
  if (Object.prototype.hasOwnProperty.call(sdd, 'hooks')) {
    sdd.hooks = normalizeHooks(sdd.hooks);
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
      return groupOf(checkout, serviceDraft);
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
    return groupOf(checkout, serviceDraft);
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
    if (!groupOf(checkout, serviceDraft).save) {
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
    save,
    childQueue,
  };
}
