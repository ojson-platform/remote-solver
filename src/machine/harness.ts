import type {ChangeView} from './change.ts';
import type {Decision, PullSnapshot} from './policy.ts';
import type {FileSource, IssueRecord} from './port.ts';

export const files: FileSource = {exists: () => false, read: () => '', list: () => []};


export function change(over: Partial<ChangeView> = {}): ChangeView {
  return {
    proposal: false,
    delta: false,
    design: false,
    tasks: false,
    archived: false,
    openQuestions: 0,
    openDecisions: 0,
    openTasks: 0,
    capabilities: [],
    missingBaseline: [],
    unjudged: [],
    ...over,
  };
}


export function issue(
  key: number | string,
  labels: string[],
  extra: Partial<IssueRecord> = {},
): IssueRecord {
  return {
    key: String(key),
    title: `#${key}: title`,
    body: '',
    state: 'OPEN',
    labels,
    dependsOn: [],
    blockedBy: [],
    blocks: [],
    ...extra,
  };
}


export function pull(id: number | string, over: Partial<PullSnapshot> = {}): PullSnapshot {
  return {
    id: String(id),
    title: '#1: title',
    state: 'OPEN',
    review: {unanswered: false, rollback: null, layers: []},
    checks: 'none',
    ...over,
  };
}


export const ready = change({proposal: true, delta: true, design: true, tasks: true});


export function action(decision: Decision): string {
  return decision.kind === 'agent' ? decision.action : decision.kind;
}


export function planIssue(
  key: string,
  labels: string[],
  body = '',
  assignee?: string,
  service?: string,
): {
  key: string;
  title: string;
  body: string;
  state: string;
  labels: string[];
  assignee?: string;
  service?: string;
} {
  return {
    key,
    title: `#${key}: title`,
    body,
    state: 'OPEN',
    labels,
    ...(assignee === undefined ? {} : {assignee}),
    ...(service === undefined ? {} : {service}),
  };
}


export function planFiles(key: string): FileSource {
  if (key === '2') {
    const tasks = 'openspec/changes/issue-2/tasks.md';
    return {
      exists: rel => rel === tasks,
      read: rel => (rel === tasks ? '- [ ] slice\n' : ''),
      list: () => [],
    };
  }
  if (key === '3') {
    return {
      exists: rel => rel === 'openspec/changes/archive/issue-3',
      read: () => '',
      list: () => [],
    };
  }
  return files;
}
