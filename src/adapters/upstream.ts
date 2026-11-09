import {execFileSync} from 'node:child_process';

const heading = '## Upstream';

function change(key: string): string {
  return `openspec/changes/issue-${key}`;
}

type Pair = {file: string; previous: string[]};

function pair(skill: string, key: string): Pair | 'plan' | 'none' {
  const root = change(key);
  if (skill === 'plan') {
    return 'plan';
  }
  if (skill === 'specify') {
    return {file: `${root}/specs`, previous: [`${root}/proposal.md`]};
  }
  if (skill === 'design') {
    return {file: `${root}/design.md`, previous: [`${root}/specs`]};
  }
  if (skill === 'tasks') {
    return {file: `${root}/tasks.md`, previous: [`${root}/specs`, `${root}/design.md`]};
  }
  return 'none';
}

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

/** The prompt block for what changed in the previous artifact since this step's file. */
export function upstreamBlock(cwd: string, skill: string, key: string): string {
  const which = pair(skill, key);
  if (which === 'plan') {
    return [
      heading,
      '',
      'The issue text above is the upstream of `proposal.md`. A caller-visible sentence in it that `proposal.md` does not say is an edit. The file existing is not a reason to leave it.',
    ].join('\n');
  }
  if (which === 'none') {
    return [heading, '', 'This action has no upstream diff.'].join('\n');
  }
  try {
    const last = git(cwd, ['log', '-1', '--format=%H', '--', which.file]);
    if (last === '') {
      return [heading, '', `\`${which.file}\` does not exist yet.`].join('\n');
    }
    const diff = git(cwd, ['diff', last, '--', ...which.previous]);
    if (diff === '') {
      return [
        heading,
        '',
        `The previous artifact has not changed since \`${which.file}\` was last committed.`,
      ].join('\n');
    }
    const paths = which.previous.map(item => `\`${item}\``).join(' and ');
    return [
      heading,
      '',
      `Diff of ${paths} since \`${last.slice(0, 7)}\` (\`${which.file}\`):`,
      '',
      '```diff',
      diff,
      '```',
    ].join('\n');
  } catch {
    return [
      heading,
      '',
      'The upstream diff could not be read. Do not treat the existing file as already right.',
    ].join('\n');
  }
}
