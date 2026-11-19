import {existsSync, readdirSync, statSync} from 'node:fs';
import path from 'node:path';

import {runtimeMachine, type RuntimeMachine} from '../../machine.ts';
import {readChange} from '../../machine/change/read.ts';
import {cardGap, cardScenarioNames, deltaScenarioNames} from '../../machine/change/text.ts';
import {workingTree} from '../../window/change-files.ts';

const heading = '## Upstream';

function change(key: string): string {
  return `openspec/changes/issue-${key}`;
}

type Chunk = {path: string; text: string};

function readFile(cwd: string, rel: string): string | null {
  const abs = path.join(cwd, rel);
  if (!existsSync(abs)) {
    return null;
  }
  if (!statSync(abs).isFile()) {
    throw new Error(`not a file: ${abs}`);
  }
  return workingTree(cwd).read(rel);
}

function specChunks(cwd: string, key: string): Chunk[] {
  const dir = path.join(cwd, change(key), 'specs');
  if (!existsSync(dir)) {
    return [];
  }
  if (!statSync(dir).isDirectory()) {
    throw new Error(`not a directory: ${dir}`);
  }
  return readdirSync(dir, {recursive: true})
    .map(rel => String(rel))
    .filter(rel => rel.endsWith('spec.md'))
    .sort()
    .map(rel => {
      const specRel = path.join(change(key), 'specs', rel);
      const text = readFile(cwd, specRel);
      if (text === null) {
        throw new Error(`missing ${path.join(cwd, specRel)}`);
      }
      return {path: specRel, text};
    });
}

function missing(file: string): string {
  return [heading, '', `\`${file}\` does not exist yet.`].join('\n');
}

function matched(file: string): string {
  return [heading, '', `The stamp in \`${file}\` matches the input revision.`].join('\n');
}

function folded(file: string, stamp: string, revision: string, chunks: Chunk[]): string {
  const shown = stamp === '' ? 'absent' : stamp;
  return [
    heading,
    '',
    `The stamp in \`${file}\` is \`${shown}\`. The input revision is \`${revision}\`. Fold this text and move the stamp to that revision. Do not blank a section this file owns.`,
    '',
    chunks.map(chunk => `# ${chunk.path}\n${chunk.text}`).join('\n\n'),
  ].join('\n');
}

function coverBlock(cwd: string, key: string): string {
  const triples = readChange(key, workingTree(cwd)).untracedBaseline;
  const lines = triples.map(triple => `- ${triple.spec} / ${triple.requirement} / ${triple.scenario}`);
  return [heading, '', 'Untraced baseline scenarios:', ...lines].join('\n');
}

function unreadable(): string {
  return [
    heading,
    '',
    'The previous artifact could not be read. Do not treat the existing file as already right.',
  ].join('\n');
}

function taskCards(cwd: string, key: string): string[] {
  const dir = path.join(cwd, change(key), 'tasks');
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    return [];
  }
  return readdirSync(dir)
    .filter(name => name.endsWith('.md'))
    .sort()
    .map(name => readFile(cwd, path.join(change(key), 'tasks', name)) ?? '');
}

/** The delta revision and any Scenario title the cards do not list. The step reads this and does not judge a live revision. */
function implementBlock(cwd: string, key: string, machine: RuntimeMachine): string {
  const specs = specChunks(cwd, key);
  const revision = machine.contentRevision(specs);
  const onCard = new Set(taskCards(cwd, key).flatMap(cardScenarioNames));
  const missing = specs
    .flatMap(chunk => deltaScenarioNames(chunk.text))
    .filter(name => !onCard.has(name));
  const titles =
    missing.length === 0
      ? 'Every delta Scenario title is on a card.'
      : ['Scenario titles on no card:', ...missing.map(name => `- ${name}`)].join('\n');
  return [
    heading,
    '',
    'This action has no previous artifact.',
    '',
    `The delta revision is \`${revision}\`.`,
    '',
    titles,
  ].join('\n');
}

/** The prompt block for the input this step absorbs. A matching stamp is one sentence. */
export function upstreamBlock(
  cwd: string,
  skill: string,
  key: string,
  machine: RuntimeMachine = runtimeMachine,
): string {
  const root = change(key);
  if (skill === 'plan') {
    return [
      heading,
      '',
      'The issue text above is the upstream of `proposal.md`. A caller-visible sentence in it that `proposal.md` has never stated is an edit. The file existing is not a reason to leave that sentence. A sentence `proposal.md` already replaced is not copied back.',
    ].join('\n');
  }
  if (skill !== 'specify' && skill !== 'design' && skill !== 'tasks') {
    if (skill === 'implement') {
      try {
        return implementBlock(cwd, key, machine);
      } catch {
        return unreadable();
      }
    }
    if (skill === 'cover-baseline') {
      try {
        return coverBlock(cwd, key);
      } catch {
        return unreadable();
      }
    }
    return [heading, '', 'This action has no previous artifact.'].join('\n');
  }
  try {
    if (skill === 'specify') {
      const proposalPath = `${root}/proposal.md`;
      const proposal = readFile(cwd, proposalPath);
      const specs = specChunks(cwd, key);
      if (specs.length === 0) {
        return missing(`${root}/specs`);
      }
      const revision = machine.contentRevision([{path: proposalPath, text: proposal ?? ''}]);
      const stamp = machine.sharedStamp(specs.map(chunk => chunk.text));
      const file = specs.map(chunk => chunk.path).join(' and ');
      const input = [{path: proposalPath, text: proposal ?? ''}];
      return stamp !== '' && stamp === revision
        ? matched(file)
        : folded(file, stamp, revision, input);
    }
    const file = skill === 'design' ? `${root}/design.md` : `${root}/tasks.md`;
    const text = readFile(cwd, file);
    const specs = specChunks(cwd, key);
    const deltaRevision = machine.contentRevision(specs);
    if (text === null) {
      const absent = missing(file);
      return skill === 'tasks'
        ? `${absent}\n\nThe delta revision is \`${deltaRevision}\`.`
        : absent;
    }
    const input =
      skill === 'design'
        ? specs
        : [
            ...specs,
            {path: `${root}/design.md`, text: readFile(cwd, `${root}/design.md`) ?? ''},
          ];
    const revision = machine.contentRevision(input);
    const stamp = machine.absorbedStamp(text);
    const block =
      stamp !== '' && stamp === revision ? matched(file) : folded(file, stamp, revision, input);
    if (skill !== 'tasks') {
      return block;
    }
    const gap = cardGap(readChange(key, workingTree(cwd)));
    const cut = gap ? `\n\n${gap}. Cut that card in this run. Do not Publish.` : '';
    return `${block}\n\nThe delta revision is \`${deltaRevision}\`.${cut}`;
  } catch {
    return unreadable();
  }
}
