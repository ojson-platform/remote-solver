import type {Decision} from './types.ts';
import type {Phase} from '../phase/phase.ts';

import {ACTION_SKILL, type AgentAction} from './route.ts';

/** A published artifact without an auto tag: the machine opens the human gate once. */
export function reviewGate(issue: string, artifact: string, from: Phase, to: Phase): Decision {
  return {
    kind: 'wait',
    issue,
    reason: `review the ${artifact}, then a person moves ${from} to ${to}`,
    gate: {artifact, from, to},
  };
}

export function agent(
  issue: string,
  action: AgentAction,
  phase: Phase,
  pr: string,
  reason: string,
): Decision {
  return {kind: 'agent', issue, action, skill: ACTION_SKILL[action], phase, pr, reason};
}
