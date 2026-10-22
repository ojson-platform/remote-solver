import {ACTION_SKILL} from '../machine/route.ts';

import {isDoc, type Doc, type ServiceHookChoice, type ServiceHookField} from './types.ts';

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

function hookId(action: string, point: string): string {
  return `${action}\0${point}`;
}

/** Points the group can show. A non-string value is not a field. */
export function hooksFrom(sdd: Doc): ServiceHookField[] {
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
      if (!values) {
        continue;
      }
      hooks.push({action, point, values});
    }
  }
  return hooks;
}

const HOOK_POINTS = ['before', 'after'] as const;

/** Points already shown, plus a non-string value that still occupies the key. */
function takenIds(hooks: readonly ServiceHookField[], doc: Doc | null): Set<string> {
  const taken = new Set(hooks.map(item => hookId(item.action, item.point)));
  const sdd = doc && isDoc(doc.sdd) ? doc.sdd : undefined;
  const stored = sdd && isDoc(sdd.hooks) ? sdd.hooks : undefined;
  if (!stored) {
    return taken;
  }
  for (const [action, points] of Object.entries(stored)) {
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
export function hookChoices(
  hooks: readonly ServiceHookField[],
  doc: Doc | null,
): ServiceHookChoice[] {
  const taken = takenIds(hooks, doc);
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

/** Draft lists replace string points. A non-string stays. An empty list does not write the point. */
export function applyHooks(original: unknown, draft: readonly ServiceHookField[]): unknown {
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

/** Adds a free point. A blank first string and a taken point do nothing. */
export function chooseHook(
  hooks: ServiceHookField[],
  doc: Doc | null,
  action: string,
  point: string,
  first: string,
): void {
  if (blank(first)) {
    return;
  }
  const allowed = hookChoices(hooks, doc).some(
    item => item.action === action && item.point === point,
  );
  if (!allowed) {
    return;
  }
  hooks.push({action, point, values: [first]});
}

/** Replaces one point. An empty list removes it. An unknown point does nothing. */
export function setHook(
  hooks: ServiceHookField[],
  action: string,
  point: string,
  values: readonly string[],
): void {
  const index = hooks.findIndex(item => item.action === action && item.point === point);
  if (index < 0) {
    return;
  }
  const next = values.filter(item => !blank(item));
  if (next.length === 0) {
    hooks.splice(index, 1);
    return;
  }
  hooks[index] = {action, point, values: next};
}
