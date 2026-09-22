import path from 'node:path';

import {archiveDir, changeDir} from './naming.ts';
import type {FileSource} from './port.ts';

export type ChangeView = {
  proposal: boolean;
  delta: boolean;
  design: boolean;
  tasks: boolean;
  archived: boolean;
  openQuestions: number;
  openDecisions: number;
  openTasks: number;
  missingBaseline: string[];
};

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

function openCount(text: string, headings: string[]): number {
  return headings.reduce((count, heading) => count + unchecked(text, heading), 0);
}

function modifiedCapabilities(proposal: string): string[] {
  const body = section(proposal, 'Capabilities');
  const modified = /### Modified\s*([\s\S]*?)(?:\n### |\s*$)/.exec(body);
  if (!modified) {
    return [];
  }
  return modified[1]
    .split('\n')
    .map(line => line.match(/^-\s+(\S+)/)?.[1])
    .filter((id): id is string => Boolean(id));
}

export function readChange(key: string, files: FileSource): ChangeView {
  const dir = changeDir(key);
  const proposalPath = path.join(dir, 'proposal.md');
  const designPath = path.join(dir, 'design.md');
  const tasksPath = path.join(dir, 'tasks.md');
  const proposal = files.read(proposalPath);
  const missing = modifiedCapabilities(proposal).filter(
    id => !files.exists(path.join('openspec', 'specs', id, 'spec.md')),
  );
  const specs = path.join(dir, 'specs');
  return {
    proposal: files.exists(proposalPath),
    delta: files.list(specs).some(line => line.endsWith('spec.md')),
    design: files.exists(designPath),
    tasks: files.exists(tasksPath),
    archived: files.exists(archiveDir(key)) || files.list(archiveDir(key)).length > 0,
    openQuestions: openCount(proposal, ['Open questions', 'Открытые вопросы']),
    openDecisions: openCount(files.read(designPath), ['Open decisions', 'Открытые решения']),
    openTasks: files
      .read(tasksPath)
      .split('\n')
      .filter(line => line.trimStart().startsWith('- [ ]')).length,
    missingBaseline: missing,
  };
}
