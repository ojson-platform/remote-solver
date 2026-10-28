import type {FileSource} from './port.ts';

import {createHash} from 'node:crypto';
import path from 'node:path';

import {archiveDir, changeDir} from './naming.ts';

export type ChangeView = {
  proposal: boolean;
  delta: boolean;
  design: boolean;
  tasks: boolean;
  archived: boolean;
  openQuestions: number;
  openDecisions: number;
  openTasks: number;
  /** Ids under Added and Modified. Empty when the proposal names none. */
  capabilities: string[];
  missingBaseline: string[];
};

/** Change-file headings the machine reads; `skills/sdd-flow/CONTEXT.md` § Artifacts states them. */
export const HEADINGS = {
  capabilities: 'Capabilities',
  added: 'Added',
  modified: 'Modified',
  openQuestions: 'Open questions',
  openDecisions: 'Open decisions',
} as const;

function section(text: string, heading: string): string {
  const match = new RegExp(`^## ${heading}\\s*$`, 'm').exec(text);
  if (!match) {
    return '';
  }
  const rest = text.slice(match.index + match[0].length);
  const next = rest.search(/^## /m);
  return next === -1 ? rest : rest.slice(0, next);
}

function unchecked(text: string, heading: string): number {
  return section(text, heading)
    .split('\n')
    .filter(line => line.trimStart().startsWith('- [ ]')).length;
}

const CHANGE_FILES = ['proposal.md', 'design.md', 'tasks.md'];

/** Change documents in one directory, in dossier order. */
function changeDocuments(dir: string, files: FileSource): string[] {
  const named = CHANGE_FILES.map(name => path.join(dir, name)).filter(rel => files.exists(rel));
  const specs = files.list(path.join(dir, 'specs')).filter(rel => rel.endsWith('spec.md'));
  return [...named, ...specs];
}

function changeBody(dir: string, files: FileSource): string[] {
  return changeDocuments(dir, files).flatMap(rel => {
    const text = files.read(rel).trim();
    return text ? [`# ${rel}\n${text}`] : [];
  });
}

/** Active change text, or the archive copy once accepting has folded it. */
export function changeText(key: string, files: FileSource): string | null {
  const active = changeBody(changeDir(key), files);
  const text = active.length > 0 ? active : changeBody(archiveDir(key), files);
  return text.length > 0 ? text.join('\n\n') : null;
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
    .filter((id): id is string => Boolean(id));
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

/** A delta file, or a proposal that names no capability, is enough to leave specifying. */
export function specsReady(
  change: Pick<ChangeView, 'proposal' | 'delta' | 'capabilities'>,
): boolean {
  return change.delta || (change.proposal && change.capabilities.length === 0);
}

export function readChange(key: string, files: FileSource): ChangeView {
  const dir = changeDir(key);
  const proposalPath = path.join(dir, 'proposal.md');
  const designPath = path.join(dir, 'design.md');
  const tasksPath = path.join(dir, 'tasks.md');
  const docs = new Set(changeDocuments(dir, files));
  const proposal = files.read(proposalPath);
  const missing = missingBaselineIds(proposal, rel => files.exists(rel));
  return {
    proposal: docs.has(proposalPath),
    delta: [...docs].some(rel => rel.endsWith('spec.md')),
    design: docs.has(designPath),
    tasks: docs.has(tasksPath),
    archived: files.exists(archiveDir(key)) || files.list(archiveDir(key)).length > 0,
    openQuestions: unchecked(proposal, HEADINGS.openQuestions),
    openDecisions: unchecked(files.read(designPath), HEADINGS.openDecisions),
    openTasks: files
      .read(tasksPath)
      .split('\n')
      .filter(line => line.trimStart().startsWith('- [ ]')).length,
    capabilities: namedCapabilities(proposal),
    missingBaseline: missing,
  };
}

/** What a plaque and an open spine need from one branch, plus a mark of its text. */
export type BranchFacts = {
  fingerprint: string;
  questions: number;
  decisions: number;
  tasks?: {done: number; open: number};
  proposal?: string;
  design?: string;
  tasksFile?: string;
  specs: {id: string; file: string}[];
};

/** One delta spec and its baseline, as read for the plaque and the spine. */
export type BranchSpecText = {
  id: string;
  rel: string;
  delta: string;
  baseline: string;
};

/**
 * The branch bytes one read produced.
 * The plaque summary and the spine are projections of this text.
 * `baselines` lists capability ids whose `openspec/specs/<id>/spec.md` exists.
 */
export type BranchText = {
  proposal: string;
  design: string;
  tasks: string;
  specs: BranchSpecText[];
  baselines: string[];
};

function slash(rel: string): string {
  return rel.split(path.sep).join('/');
}

function taskCounts(text: string, present: boolean): {done: number; open: number} | undefined {
  if (!present) {
    return undefined;
  }
  let done = 0;
  let open = 0;
  for (const line of text.split('\n')) {
    const trimmed = line.trimStart();
    if (trimmed.startsWith('- [x]')) {
      done += 1;
    } else if (trimmed.startsWith('- [ ]')) {
      open += 1;
    }
  }
  return {done, open};
}

function specEntries(files: FileSource, key: string): {id: string; file: string}[] {
  const dir = slash(path.join(changeDir(key), 'specs'));
  const prefix = `${dir}/`;
  const found: {id: string; file: string}[] = [];
  for (const raw of files.list(dir)) {
    const rel = slash(raw);
    if (!rel.startsWith(prefix) || !rel.endsWith('/spec.md')) {
      continue;
    }
    const id = rel.slice(prefix.length, -'/spec.md'.length);
    if (id === '' || id === '.') {
      continue;
    }
    found.push({id, file: rel});
  }
  found.sort((left, right) => left.id.localeCompare(right.id));
  return found;
}

function markOf(pairs: readonly [string, string][]): string {
  const hash = createHash('sha256');
  for (const [rel, text] of [...pairs].sort((left, right) => left[0].localeCompare(right[0]))) {
    hash.update(rel);
    hash.update('\0');
    hash.update(text);
    hash.update('\0');
  }
  return hash.digest('hex');
}

function baselineRel(id: string): string {
  return `openspec/specs/${id}/spec.md`;
}

/** The change view, the plaque summary, and the bytes both projections share. */
export function readBranch(
  key: string,
  files: FileSource,
): {change: ChangeView; facts: BranchFacts; text: BranchText} {
  const change = readChange(key, files);
  const proposalPath = path.join(changeDir(key), 'proposal.md');
  const designPath = path.join(changeDir(key), 'design.md');
  const tasksPath = path.join(changeDir(key), 'tasks.md');
  const proposal = files.exists(proposalPath) ? slash(proposalPath) : undefined;
  const design = files.exists(designPath) ? slash(designPath) : undefined;
  const tasksFile = files.exists(tasksPath) ? slash(tasksPath) : undefined;
  const specs = specEntries(files, key);
  const pairs: [string, string][] = [];
  const body = new Map<string, string>();
  const take = (rel: string | undefined) => {
    if (!rel || body.has(rel)) {
      return;
    }
    const text = files.read(rel);
    body.set(rel, text);
    pairs.push([rel, text]);
  };
  take(proposal);
  take(design);
  take(tasksFile);
  const specText: BranchSpecText[] = [];
  for (const spec of specs) {
    take(spec.file);
    const baseline = baselineRel(spec.id);
    if (files.exists(baseline)) {
      take(baseline);
    }
    specText.push({
      id: spec.id,
      rel: spec.file,
      delta: body.get(spec.file) ?? '',
      baseline: body.get(baseline) ?? '',
    });
  }
  const proposalText = proposal ? (body.get(proposal) ?? '') : '';
  const baselines: string[] = [];
  for (const id of [...namedCapabilities(proposalText), ...specText.map(spec => spec.id)]) {
    if (files.exists(baselineRel(id)) && !baselines.includes(id)) {
      baselines.push(id);
    }
  }
  return {
    change,
    text: {
      proposal: proposalText,
      design: design ? (body.get(design) ?? '') : '',
      tasks: tasksFile ? (body.get(tasksFile) ?? '') : '',
      specs: specText,
      baselines,
    },
    facts: {
      fingerprint: markOf(pairs),
      questions: change.openQuestions,
      decisions: change.openDecisions,
      ...(tasksFile ? {tasks: taskCounts(body.get(tasksFile) ?? '', true)} : {}),
      ...(proposal ? {proposal} : {}),
      ...(design ? {design} : {}),
      ...(tasksFile ? {tasksFile} : {}),
      specs,
    },
  };
}
