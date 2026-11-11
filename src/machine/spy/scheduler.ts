import type {Decision} from '../decide/policy.ts';

export type State = {
  running: string[];
  reported: Record<string, string>;
};

export type Report = {issue: string | null; reason: string};

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
        held.push(waiting);
      }
      break;
    }
    start.push(decision);
  }
  return {state: {running: state.running, reported}, start, held, report};
}

export function exited(state: State, issue: string): State {
  return {running: state.running.filter(item => item !== issue), reported: state.reported};
}
