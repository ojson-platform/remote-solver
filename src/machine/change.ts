import type {FileSource} from './port.ts';

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
