import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';

import {parse} from 'yaml';

import {staysInside} from './inside.ts';
import {
  ROLE_OUTCOMES,
  isDoc,
  stringList,
  type Doc,
  type RoleOutcome,
  type RoleRecord,
} from './types.ts';

const ABSENT_FILE = 'файла нет';

const FIELD_LABELS = ['sdd:auto-plan', 'sdd:auto-spec', 'sdd:auto-design'] as const;

function isOutcome(value: unknown): value is RoleOutcome {
  return typeof value === 'string' && (ROLE_OUTCOMES as readonly string[]).includes(value);
}

function fieldLabels(value: unknown): string[] {
  return stringList(value).filter(label => (FIELD_LABELS as readonly string[]).includes(label));
}

/** Records the home file already holds. Another outcome is not a role. */
export function rolesFrom(value: unknown): RoleRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const out: RoleRecord[] = [];
  for (const item of value) {
    if (!isDoc(item) || typeof item.name !== 'string' || item.name === '') {
      continue;
    }
    if (!isOutcome(item.outcome) || typeof item.text !== 'string') {
      continue;
    }
    const role: RoleRecord = {name: item.name, outcome: item.outcome, text: item.text};
    if (Array.isArray(item.labels)) {
      role.labels = stringList(item.labels);
    }
    out.push(storedRole(role));
  }
  return out;
}

/** The shelf shows the outcome kind. The drag has not happened yet. */
export function shelfOf(roles: readonly RoleRecord[]): {name: string; outcome: RoleOutcome}[] {
  return roles.map(role => ({name: role.name, outcome: role.outcome}));
}

/** The home file shape. A `ticket-fields` role keeps `labels` only when it names some. */
export function storedRoles(roles: readonly RoleRecord[]): Doc[] {
  return roles.map(role => {
    const next = storedRole(role);
    const stored: Doc = {name: next.name, outcome: next.outcome, text: next.text};
    if (next.labels) {
      stored.labels = [...next.labels];
    }
    return stored;
  });
}

/** A stored role. Labels stay only on `ticket-fields`, and only when that list names some. */
function storedRole(role: RoleRecord): RoleRecord {
  const stored: RoleRecord = {name: role.name, outcome: role.outcome, text: role.text};
  if (role.outcome === 'ticket-fields') {
    const labels = fieldLabels(role.labels);
    if (labels.length > 0) {
      stored.labels = labels;
    }
  }
  return stored;
}

/** The user block. Each edit writes the collection at once. There is no wizard. */
export function openRoleEditor(read: () => unknown, write: (roles: readonly RoleRecord[]) => void) {
  function list(): RoleRecord[] {
    return rolesFrom(read());
  }

  return {
    list,
    add(role: RoleRecord): void {
      if (role.name === '' || !isOutcome(role.outcome)) {
        return;
      }
      write([...list(), storedRole(role)]);
    },
    rename(name: string, nextName: string): void {
      if (nextName === '') {
        return;
      }
      const roles = list();
      const role = roles.find(item => item.name === name);
      if (!role || role.name === nextName) {
        return;
      }
      role.name = nextName;
      write(roles);
    },
    choose(name: string, outcome: RoleOutcome): void {
      if (!isOutcome(outcome)) {
        return;
      }
      const roles = list();
      const role = roles.find(item => item.name === name);
      if (!role || role.outcome === outcome) {
        return;
      }
      role.outcome = outcome;
      if (outcome !== 'ticket-fields') {
        delete role.labels;
      }
      write(roles.map(storedRole));
    },
    setText(name: string, text: string): void {
      const roles = list();
      const role = roles.find(item => item.name === name);
      if (!role) {
        return;
      }
      role.text = text;
      write(roles);
    },
    setLabels(name: string, labels: readonly string[]): void {
      const roles = list();
      const role = roles.find(item => item.name === name);
      if (!role || role.outcome !== 'ticket-fields') {
        return;
      }
      const next = fieldLabels(labels);
      if (next.length === 0) {
        delete role.labels;
      } else {
        role.labels = next;
      }
      write(roles);
    },
    remove(name: string): void {
      const roles = list();
      const next = roles.filter(role => role.name !== name);
      if (next.length === roles.length) {
        return;
      }
      write(next);
    },
  };
}

/** YAML text with at least one non-empty string point. Anything else is not that map. */
export function readsAsPointMap(text: string): boolean {
  let parsed: unknown;
  try {
    parsed = parse(text);
  } catch {
    return false;
  }
  if (!isDoc(parsed)) {
    return false;
  }
  let points = 0;
  for (const inner of Object.values(parsed)) {
    if (!isDoc(inner)) {
      return false;
    }
    for (const value of Object.values(inner)) {
      if (typeof value !== 'string') {
        return false;
      }
      if (value.trim() !== '') {
        points += 1;
      }
    }
  }
  return points > 0;
}

/** The file's text, or the absent line. This read does not create the file. */
function cycleFilePopup(checkout: string | undefined, text: string): string {
  if (!checkout || text === '') {
    return ABSENT_FILE;
  }
  const target = path.resolve(checkout, text);
  if (!staysInside(checkout, target) || !existsSync(target)) {
    return ABSENT_FILE;
  }
  try {
    return readFileSync(target, 'utf8');
  } catch {
    return ABSENT_FILE;
  }
}

/**
 * One drag. The role does not stay on the cycle.
 * An empty model, a silent agent, and an empty factory config do not gate this.
 */
export function runRole(input: {
  role: RoleRecord;
  openPullRequests: number;
  checkout: string | undefined;
  editLabels: (add: readonly string[]) => void;
  writeHooks: (text: string) => void;
  commentPull: (body: string) => void;
}): {popup: string} | undefined {
  if (input.role.outcome === 'ticket-fields') {
    const labels = input.role.labels ?? [];
    if (labels.length > 0) {
      input.editLabels(labels);
    }
    if (readsAsPointMap(input.role.text)) {
      input.writeHooks(input.role.text);
    }
    return undefined;
  }
  if (input.role.outcome === 'pull-comment') {
    if (input.openPullRequests === 1) {
      input.commentPull(input.role.text);
    }
    return undefined;
  }
  if (input.role.outcome === 'html') {
    return {popup: input.role.text};
  }
  return {popup: cycleFilePopup(input.checkout, input.role.text)};
}
