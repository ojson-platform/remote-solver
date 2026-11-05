import type {Decision} from './policy.ts';

export type State = {
  running: string[];
  idle: Record<string, string>;
  reported: Record<string, string>;
};

export type Report = {issue: string | null; reason: string};

export function signature(decision: Extract<Decision, {kind: 'agent'}>): string {
  return `${decision.phase}\0${decision.action}\0${decision.reason}`;
}

export function tick(
  state: State,
  decisions: Decision[],
  parallel: number,
): {
  state: State;
  start: Extract<Decision, {kind: 'agent'}>[];
  held: Extract<Decision, {kind: 'agent'}>[];
  report: Report[];
} {
  const idle = {...state.idle};
  const reported = {...state.reported};
  const report: Report[] = [];
  const ready: Extract<Decision, {kind: 'agent'}>[] = [];
  const say = (issue: string | null, reason: string) => {
    const slot = issue ?? '';
    if (reported[slot] === reason) {
      return;
    }
    reported[slot] = reason;
    report.push({issue, reason});
  };
  for (const decision of decisions) {
    if (decision.issue !== null && state.running.includes(decision.issue)) {
      continue;
    }
    if (decision.kind !== 'agent') {
      if (decision.issue !== null) {
        delete idle[decision.issue];
      }
      say(decision.issue, decision.reason);
      continue;
    }
    ready.push(decision);
  }
  const start: Extract<Decision, {kind: 'agent'}>[] = [];
  const held: Extract<Decision, {kind: 'agent'}>[] = [];
  for (let index = 0; index < ready.length; index += 1) {
    const decision = ready[index];
    if (state.running.length + start.length >= parallel) {
      for (let rest = index; rest < ready.length; rest += 1) {
        const waiting = ready[rest];
        if (start.some(item => item.issue === waiting.issue)) {
          continue;
        }
        const sig = signature(waiting);
        if (idle[waiting.issue] === sig) {
          say(waiting.issue, `idle ${waiting.action}: ${waiting.reason}`);
          continue;
        }
        held.push(waiting);
      }
      break;
    }
    const sig = signature(decision);
    if (idle[decision.issue] === sig) {
      say(decision.issue, `idle ${decision.action}: ${decision.reason}`);
      continue;
    }
    start.push(decision);
  }
  return {state: {running: state.running, idle, reported}, start, held, report};
}

export function exited(state: State, issue: string, code: number | null, sig: string): State {
  const idle = {...state.idle};
  if (code === 2) {
    idle[issue] = sig;
  } else {
    delete idle[issue];
  }
  return {running: state.running.filter(item => item !== issue), idle, reported: state.reported};
}
