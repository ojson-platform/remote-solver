import {changeText} from '../machine/change.ts';
import type {FileSource} from '../machine/port.ts';

export type Dossier = {
  issue: string;
  pull: string;
  head: string;
  base: string;
  commits: string;
  diff: string;
  change: string;
  standards: string;
};

const STANDARD_FILES = ['CODING_STANDARDS.md', 'CONTRIBUTING.md', 'AGENTS.md'];

function standardsText(files: FileSource): string {
  return STANDARD_FILES.flatMap(name => {
    if (!files.exists(name)) {
      return [];
    }
    const text = files.read(name).trim();
    return text ? [`# ${name}\n${text}`] : [];
  }).join('\n\n');
}

export function assembleDossier(input: {
  issue: string;
  pull: string;
  head: string;
  base: string | null;
  commits: string;
  diff: string;
  files: FileSource;
}): {kind: 'wait'; reason: string} | {kind: 'ready'; dossier: Dossier} {
  if (!input.base) {
    return {kind: 'wait', reason: 'base does not resolve'};
  }
  if (!input.diff.trim()) {
    return {kind: 'wait', reason: 'diff is empty'};
  }
  const change = changeText(input.issue, input.files);
  if (!change) {
    return {kind: 'wait', reason: 'change has no files'};
  }
  return {
    kind: 'ready',
    dossier: {
      issue: input.issue,
      pull: input.pull,
      head: input.head,
      base: input.base,
      commits: input.commits,
      diff: input.diff,
      change,
      standards: standardsText(input.files),
    },
  };
}
