import type {ChangeView} from './types.ts';

import path from 'node:path';

/** Change-file headings the machine reads; `skills/sdd-flow/CONTEXT.md` § Artifacts states them. */
export const HEADINGS = {
  capabilities: 'Capabilities',
  added: 'Added',
  modified: 'Modified',
  openQuestions: 'Open questions',
  openDecisions: 'Open decisions',
} as const;

export function section(text: string, heading: string): string {
  const match = new RegExp(`^## ${heading}\\s*$`, 'm').exec(text);
  if (!match) {
    return '';
  }
  const rest = text.slice(match.index + match[0].length);
  const next = rest.search(/^## /m);
  return next === -1 ? rest : rest.slice(0, next);
}

export function unchecked(text: string, heading: string): number {
  return section(text, heading)
    .split('\n')
    .filter(line => line.trimStart().startsWith('- [ ]')).length;
}

/** Scenario titles in the ADDED and MODIFIED blocks of one delta. */
export function deltaScenarioNames(text: string): string[] {
  const names: string[] = [];
  let take = false;
  for (const line of text.split('\n')) {
    if (line.startsWith('## ')) {
      const title = line.slice(3);
      take = title.startsWith('ADDED') || title.startsWith('MODIFIED');
      continue;
    }
    if (!take || !line.startsWith('#### Scenario: ')) {
      continue;
    }
    const name = line.slice('#### Scenario: '.length).trim();
    if (name !== '') {
      names.push(name);
    }
  }
  return names;
}

export function cardScenarioNames(text: string): string[] {
  const head = text.split(/^## /m)[0] ?? '';
  return head.split('\n').flatMap(line => {
    const item = /^- (?!\[)(.+)$/.exec(line.trim());
    const name = item?.[1]?.trim() ?? '';
    return name === '' || name.startsWith('sdd-') ? [] : [name];
  });
}

function deltaStamp(text: string): string {
  return /^sdd-delta: ([0-9a-f]+)\s*$/m.exec(text)?.[1] ?? '';
}

export function sharedDelta(texts: string[]): string {
  if (texts.length === 0) {
    return '';
  }
  const stamps = texts.map(deltaStamp);
  const first = stamps[0] ?? '';
  return first !== '' && stamps.every(stamp => stamp === first) ? first : '';
}

export function slicedScenarioNames(tasks: string): string[] {
  const names: string[] = [];
  for (const line of tasks.split('\n')) {
    const marked = /^- \[[ x]\] `[^`]+`\s*(.*)$/.exec(line.trim());
    if (marked) {
      for (const name of (marked[1] ?? '').replace(/^[—–-]\s*/, '').split(';')) {
        const trimmed = name.trim();
        if (trimmed !== '') {
          names.push(trimmed);
        }
      }
      continue;
    }
    for (const item of line.matchAll(/«([^»]+)»/g)) {
      const name = (item[1] ?? '').trim();
      if (name !== '') {
        names.push(name);
      }
    }
  }
  return names;
}

/** The card is not the live delta. Empty revisions are the test harness. */
export function cardGap(change: ChangeView): string | null {
  if (change.specsRevision === '' || change.deltaScenarios.length === 0) {
    return null;
  }
  if (change.cardRevision !== change.specsRevision) {
    return 'the delta revision is not the card';
  }
  const named = new Set(change.cardScenarios);
  const missing = change.deltaScenarios.find(name => !named.has(name));
  return missing ? `no card for ${missing}` : null;
}

/** A delta scenario with neither an open nor a checked task line. */
export function unslicedScenario(change: ChangeView): string | null {
  if (change.deltaScenarios.length === 0) {
    return null;
  }
  const named = new Set(change.slicedScenarios);
  const missing = change.deltaScenarios.find(name => !named.has(name));
  return missing ? `no task for ${missing}` : null;
}

function idsUnder(proposal: string, heading: string): string[] {
  const body = section(proposal, HEADINGS.capabilities);
  const subsection = new RegExp(`### ${heading}\\s*([\\s\\S]*?)(?:\\n### |\\s*$)`);
  const found = subsection.exec(body);
  if (!found?.[1]) {
    return [];
  }
  return found[1]
    .split('\n')
    .map(line => line.match(/^-\s+(\S+)/)?.[1])
    .map(token => (token ? capabilityId(token) : token))
    .filter((id): id is string => Boolean(id));
}

/** The bare id. `` `board`: `` and `` `cache-first` `` both name the spec directory. */
function capabilityId(token: string): string {
  const uncolon = token.endsWith(':') ? token.slice(0, -1) : token;
  if (uncolon.length >= 2 && uncolon.startsWith('`') && uncolon.endsWith('`')) {
    return uncolon.slice(1, -1);
  }
  return uncolon;
}

/** Added and Modified ids, in that order, without duplicates. */
export function namedCapabilities(proposal: string): string[] {
  return [
    ...new Set([...idsUnder(proposal, HEADINGS.added), ...idsUnder(proposal, HEADINGS.modified)]),
  ];
}

function modifiedCapabilities(proposal: string): string[] {
  return idsUnder(proposal, HEADINGS.modified);
}

/** Modified ids whose `openspec/specs/<id>/spec.md` is absent. */
export function missingBaselineIds(proposal: string, exists: (rel: string) => boolean): string[] {
  return modifiedCapabilities(proposal).filter(
    id => !exists(path.join('openspec', 'specs', id, 'spec.md')),
  );
}

/** Ids already placed by the baseline look. */
function shelvedIds(proposal: string): string[] {
  return section(proposal, 'Shelf')
    .split('\n')
    .map(line => line.match(/^-\s+(\S+)/)?.[1])
    .map(token => (token ? capabilityId(token) : token))
    .filter((id): id is string => Boolean(id));
}

/** Added ids the baseline look has not published. A missing spec file is not this list. */
export function unjudgedAddedIds(proposal: string): string[] {
  const shelved = new Set(shelvedIds(proposal));
  return idsUnder(proposal, HEADINGS.added).filter(id => !shelved.has(id));
}

/** A delta file, or a proposal that names no capability, is enough to leave specifying. */
export function specsReady(
  change: Pick<ChangeView, 'proposal' | 'delta' | 'capabilities'>,
): boolean {
  return change.delta || (change.proposal && change.capabilities.length === 0);
}
