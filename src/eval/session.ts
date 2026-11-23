import type {EvalCase} from './cases.ts';

import {cpSync, existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const serviceConfig = `schema: spec-driven

sdd:
  base: trunk
  queues:
    - name: Sandcastle
      description: The queue this session drives
`;

/**
 * The live skill, the decision already printed, and the person's next message.
 * The first line is prose. A prompt that starts with `---` is an option to the agent CLI.
 */
export function sessionPrompt(item: EvalCase, root: string): string {
  const skill = readFileSync(path.join(root, 'skills/sdd-flow/SKILL.md'), 'utf8');
  const dir = path.join(root, 'eval', item.family, item.id);
  const decision = readFileSync(path.join(dir, 'decision.json'), 'utf8').trim();
  const message = readFileSync(path.join(dir, 'message.md'), 'utf8').trim();
  return [
    "The session is already on issue 1. Follow the skill for the person's next message.",
    '',
    skill.trimEnd(),
    '',
    '`sdd step 1` already ran and printed this decision:',
    '',
    decision,
    '',
    "The person's next message:",
    '',
    message,
  ].join('\n');
}

/**
 * The checkout is a service root before the fixture commit.
 * CONTEXT holds rebase and publish. The config names the printed queue and base.
 * The decision sits beside the stub so step can reprint it.
 */
export function prepareSession(cwd: string, root: string, item: EvalCase): void {
  const dir = path.join(root, 'eval', item.family, item.id);
  const bin = path.join(cwd, 'bin');
  mkdirSync(bin, {recursive: true});
  cpSync(path.join(dir, 'decision.json'), path.join(bin, 'decision.json'));
  const skillDir = path.join(cwd, 'skills/sdd-flow');
  mkdirSync(skillDir, {recursive: true});
  cpSync(path.join(root, 'skills/sdd-flow/CONTEXT.md'), path.join(skillDir, 'CONTEXT.md'));
  const config = path.join(cwd, 'openspec/config.yaml');
  if (!existsSync(config)) {
    mkdirSync(path.dirname(config), {recursive: true});
    writeFileSync(config, serviceConfig);
  }
}
