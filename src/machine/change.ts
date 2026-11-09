import type {FileSource} from './port.ts';

import {createHash} from 'node:crypto';
import path from 'node:path';

import {archiveChangePath, archiveDir, changeDir} from './naming.ts';

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
  /** Added ids `## Shelf` does not list yet. The baseline look has not been published. */
  unjudged: string[];
  /** Hash of `proposal.md`. Empty when the caller did not read a checkout. */
  proposalRevision: string;
  /** Hash of the delta specs. */
  specsRevision: string;
  /** Hash of the delta specs and `design.md`, the input `tasks.md` absorbs. */
  tasksInputRevision: string;
  /** `sdd-absorbed` shared by every delta spec. Empty when any spec omits it. */
  specStamp: string;
  /** `sdd-absorbed` in `design.md`. */
  designStamp: string;
  /** `sdd-absorbed` in `tasks.md`. */
  tasksStamp: string;
  /** Scenario titles under ADDED and MODIFIED in the delta. */
  deltaScenarios: string[];
  /** Scenario titles named on the task cards. */
  cardScenarios: string[];
  /** `sdd-delta` shared by every task card. Empty when any card omits it. */
  cardRevision: string;
  /** Scenario titles named by an open or checked line in `tasks.md`. */
  slicedScenarios: string[];
};

/** The `sdd-absorbed` line a phase file moves when it folds its input. */
export function absorbedStamp(text: string): string {
  return /^sdd-absorbed: ([0-9a-f]+)\s*$/m.exec(text)?.[1] ?? '';
}

/** A revision of the current input bytes. This is not a commit and not a diff. */
export function contentRevision(chunks: {path: string; text: string}[]): string {
  const body = [...chunks]
    .sort((a, b) => a.path.localeCompare(b.path))
    .map(chunk => `# ${chunk.path}\n${chunk.text}`)
    .join('\n');
  return createHash('sha256').update(body).digest('hex').slice(0, 16);
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

function cardScenarioNames(text: string): string[] {
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

function sharedDelta(texts: string[]): string {
  if (texts.length === 0) {
    return '';
  }
  const stamps = texts.map(deltaStamp);
  const first = stamps[0] ?? '';
  return first !== '' && stamps.every(stamp => stamp === first) ? first : '';
}

function slicedScenarioNames(tasks: string): string[] {
  const names: string[] = [];
  for (const line of tasks.split('\n')) {
    const quoted = [...line.matchAll(/«([^»]+)»/g)]
      .map(item => (item[1] ?? '').trim())
      .filter(name => name !== '');
    if (quoted.length > 0) {
      names.push(...quoted);
      continue;
    }
    const marked = /^- \[[ x]\] `[^`]+`\s*(.*)$/.exec(line.trim());
    if (!marked) {
      continue;
    }
    for (const name of (marked[1] ?? '').replace(/^[—–-]\s*/, '').split(';')) {
      const trimmed = name.trim();
      if (trimmed !== '') {
        names.push(trimmed);
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

export function sharedStamp(texts: string[]): string {
  if (texts.length === 0) {
    return '';
  }
  const stamps = texts.map(absorbedStamp);
  const first = stamps[0] ?? '';
  return first !== '' && stamps.every(stamp => stamp === first) ? first : '';
}

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

export function readChange(key: string, files: FileSource): ChangeView {
  const dir = changeDir(key);
  const proposalPath = path.join(dir, 'proposal.md');
  const designPath = path.join(dir, 'design.md');
  const tasksPath = path.join(dir, 'tasks.md');
  const docs = new Set(changeDocuments(dir, files));
  const proposal = files.read(proposalPath);
  const designText = files.read(designPath);
  const tasksText = files.read(tasksPath);
  const specRels = files
    .list(path.join(dir, 'specs'))
    .filter(rel => rel.endsWith('spec.md'))
    .sort();
  const specChunks = specRels.map(rel => ({path: rel, text: files.read(rel)}));
  const cardRels = files
    .list(path.join(dir, 'tasks'))
    .filter(rel => rel.endsWith('.md') && path.basename(rel) !== 'tasks.md')
    .sort();
  const cardTexts = cardRels.map(rel => files.read(rel));
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
    unjudged: unjudgedAddedIds(proposal),
    proposalRevision: contentRevision([{path: proposalPath, text: proposal}]),
    specsRevision: contentRevision(specChunks),
    tasksInputRevision: contentRevision([...specChunks, {path: designPath, text: designText}]),
    specStamp: sharedStamp(specChunks.map(chunk => chunk.text)),
    designStamp: absorbedStamp(designText),
    tasksStamp: absorbedStamp(tasksText),
    deltaScenarios: specChunks.flatMap(chunk => deltaScenarioNames(chunk.text)),
    cardScenarios: cardTexts.flatMap(cardScenarioNames),
    cardRevision: sharedDelta(cardTexts),
    slicedScenarios: slicedScenarioNames(tasksText),
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
  /** Bodies of `tasks/<id>.md` for the ids listed in `tasks.md`, in that order. */
  taskFiles?: {id: string; body: string}[];
  specs: BranchSpecText[];
  baselines: string[];
  /** Active change directory, or the archive when that is the only copy. */
  root?: string;
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

/**
 * Where the documents sit.
 * The active directory when it has any file. The archive when it is the only copy.
 * `readChange` stays on the active directory, so accepting still sees no open change.
 */
function documentDir(key: string, files: FileSource): string {
  const active = changeDir(key);
  if (changeDocuments(active, files).length > 0) {
    return active;
  }
  const archived = archiveDir(key);
  if (changeDocuments(archived, files).length > 0) {
    return archived;
  }
  return active;
}

function specEntries(files: FileSource, dir: string): {id: string; file: string}[] {
  const specs = slash(path.join(dir, 'specs'));
  const prefix = `${specs}/`;
  const found: {id: string; file: string}[] = [];
  for (const raw of files.list(specs)) {
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

/** True when `content` is the parent of an archive tip and `tip` is that archive. */
function readsParent(key: string, tip: FileSource, content: FileSource): boolean {
  if (tip === content) {
    return false;
  }
  return (
    changeDocuments(changeDir(key), tip).length === 0 &&
    changeDocuments(archiveDir(key), tip).length > 0 &&
    changeDocuments(changeDir(key), content).length > 0
  );
}

/**
 * The change view, the plaque summary, and the bytes both projections share.
 * `files` is the tip. `content` is the parent when the tip is this issue's archive commit.
 */
export function readBranch(
  key: string,
  files: FileSource,
  content: FileSource = files,
): {change: ChangeView; facts: BranchFacts; text: BranchText} {
  const change = readChange(key, files);
  const dir = documentDir(key, content);
  const proposalPath = path.join(dir, 'proposal.md');
  const designPath = path.join(dir, 'design.md');
  const tasksPath = path.join(dir, 'tasks.md');
  const proposal = content.exists(proposalPath) ? slash(proposalPath) : undefined;
  const design = content.exists(designPath) ? slash(designPath) : undefined;
  const tasksFile = content.exists(tasksPath) ? slash(tasksPath) : undefined;
  const specs = specEntries(content, dir);
  const pairs: [string, string][] = [];
  const body = new Map<string, string>();
  const take = (rel: string | undefined) => {
    if (!rel || body.has(rel)) {
      return;
    }
    const text = content.read(rel);
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
    if (content.exists(baseline)) {
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
  const tasksText = tasksFile ? (body.get(tasksFile) ?? '') : '';
  const taskFiles: {id: string; body: string}[] = [];
  for (const line of tasksText.split('\n')) {
    const id = /^- \[[ x]\] `([^`]+)`/.exec(line.trim())?.[1];
    if (!id || /[/\\]|\.\./.test(id)) {
      continue;
    }
    const rel = slash(path.join(dir, 'tasks', `${id}.md`));
    if (!content.exists(rel)) {
      continue;
    }
    take(rel);
    taskFiles.push({id, body: body.get(rel) ?? ''});
  }
  const baselines: string[] = [];
  for (const id of [...namedCapabilities(proposalText), ...specText.map(spec => spec.id)]) {
    if (content.exists(baselineRel(id)) && !baselines.includes(id)) {
      baselines.push(id);
    }
  }
  const fromParent = readsParent(key, files, content);
  const place = (rel: string): string => (fromParent ? archiveChangePath(key, rel) : rel);
  const shownProposal = proposal ? place(proposal) : undefined;
  const shownDesign = design ? place(design) : undefined;
  const shownTasks = tasksFile ? place(tasksFile) : undefined;
  const shownSpecs = specs.map(spec => ({...spec, file: place(spec.file)}));
  return {
    change,
    text: {
      proposal: proposalText,
      design: design ? (body.get(design) ?? '') : '',
      tasks: tasksText,
      taskFiles,
      specs: specText.map(spec => ({...spec, rel: place(spec.rel)})),
      baselines,
      root: place(slash(dir)),
    },
    facts: {
      fingerprint: markOf(pairs.map(([rel, text]) => [place(rel), text])),
      questions: change.openQuestions,
      decisions: change.openDecisions,
      ...(shownTasks ? {tasks: taskCounts(body.get(tasksFile ?? '') ?? '', true)} : {}),
      ...(shownProposal ? {proposal: shownProposal} : {}),
      ...(shownDesign ? {design: shownDesign} : {}),
      ...(shownTasks ? {tasksFile: shownTasks} : {}),
      specs: shownSpecs,
    },
  };
}
