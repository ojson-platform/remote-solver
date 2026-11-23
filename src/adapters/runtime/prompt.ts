import {runtimeMachine, type RuntimeMachine} from '../../machine.ts';

import {upstreamBlock} from './upstream.ts';

/** Title and body for the skill prompt. The run already has the issue, so it does not look it up. */
export function issueText(title: string, body: string): string {
  const heading = title.trim();
  const description = body.trim();
  const lines = [
    'The issue text follows. It is the whole description. Do not search the repository for this issue, and do not read the service source to recover it.',
    '',
    `# ${heading}`,
    '',
    description,
  ];
  if (description === '') {
    lines.push('', 'The issue has no description.');
  }
  return lines.join('\n');
}

function linkedIssues(block: string, skill: string, links: readonly string[] | undefined): string {
  if (skill !== 'tasks') {
    return block;
  }
  const ids = [...new Set(links ?? [])];
  const list = ids.length === 0 ? 'none' : ids.map(id => `#${id}`).join(', ');
  return `${block}\n\nLinked issues: ${list}.`;
}

export type SkillPrompt = {
  issue: string;
  upstream: string;
  step: string;
  /** Issue text, the upstream block, then the assembled step. The chat prints this. The runtime prompt places the three fields in this order. */
  body: string;
};

/** The blocks the writing prompt and the printed step share. */
export function skillPrompt(input: {
  title: string;
  body: string;
  cwd: string;
  skill: string;
  key: string;
  links?: readonly string[];
  step: string;
  machine?: RuntimeMachine;
}): SkillPrompt {
  const issue = issueText(input.title, input.body);
  const upstream = linkedIssues(
    upstreamBlock(input.cwd, input.skill, input.key, input.machine ?? runtimeMachine),
    input.skill,
    input.links,
  );
  const step = input.step;
  return {
    issue,
    upstream,
    step,
    body: [issue, upstream, step].filter(part => part !== '').join('\n\n'),
  };
}
