import type {QueueConfig} from './service-config.ts';
import type {PullSnapshot} from '../decide/policy.ts';
import type {OpenItemFile} from '../mark/review.ts';
import type {Conversation, FileSource, IssueRecord, Pull, Review, Tracker} from '../port.ts';

import {readBranch, type BranchFacts, type BranchText, type ChangeView} from '../change/change.ts';
import {emptyReview, reviewOf} from '../mark/review.ts';

import {queueOf} from './queues.ts';

export type CycleSnapshot = {
  issues: IssueRecord[];
  cycles: IssueRecord[];
  pulls: Map<string, PullSnapshot[]>;
  changes: Map<string, ChangeView>;
  /** Branch summary for the cycles this poll read. Absent when the caller did not read branches. */
  facts?: Map<string, BranchFacts>;
  /** Bytes of that same read. The spine projects them instead of opening the branch again. */
  texts?: Map<string, BranchText>;
  /** Tip commit message of each cycle this poll read. Absent when the caller did not read tips. */
  tips?: Map<string, string>;
};

/** Pulls of one issue, each open pull carrying the one review reading. */
function openItemFile(files: FileSource | undefined): OpenItemFile | undefined {
  if (!files) {
    return undefined;
  }
  return rel => (rel && files.exists(rel) ? files.read(rel) : undefined);
}

async function pullRecords(
  review: Review,
  pulls: readonly Pull[],
  files?: FileSource,
  shared?: Map<string, Conversation[]>,
): Promise<PullSnapshot[]> {
  const fileAt = openItemFile(files);
  const openIds = pulls.filter(pull => pull.state === 'OPEN').map(pull => pull.id);
  let conversations = shared;
  if (!conversations && openIds.length > 1 && review.conversations) {
    conversations = await review.conversations(openIds);
  }
  const snapshots: PullSnapshot[] = [];
  for (const pull of pulls) {
    if (pull.state !== 'OPEN') {
      snapshots.push({...pull, review: emptyReview});
      continue;
    }
    const threads = await review.threadList(pull.id);
    const notes = conversations
      ? conversationOf(conversations, pull.id)
      : await review.comments(pull.id);
    snapshots.push({
      ...pull,
      review: reviewOf(threads, notes, fileAt),
      reading: {threads, notes},
    });
  }
  return snapshots;
}

function conversationOf(conversations: Map<string, Conversation[]>, pull: string): Conversation[] {
  const notes = conversations.get(pull);
  if (!notes) {
    throw new Error(`pull request ${pull} conversation was not read`);
  }
  return notes;
}

export async function pullSnapshots(
  review: Review,
  key: string,
  files?: FileSource,
): Promise<PullSnapshot[]> {
  return pullRecords(review, await review.pulls(key), files);
}

/** A cycle this login holds: the queue, the cycle label, and this assignee. */
export function ownCycle(issue: IssueRecord, login: string, queues: QueueConfig[]): boolean {
  return (
    (issue.assignee ?? '') === login &&
    queueOf(issue.labels, queues) !== undefined &&
    issue.labels.includes('sdd:cycle')
  );
}

export async function loadCycle(
  tracker: Tracker,
  review: Review,
  filesAt: (key: string) => FileSource,
  queues: QueueConfig[],
  contentAt: (key: string) => FileSource = filesAt,
  tipMessage?: (key: string) => Promise<string>,
): Promise<CycleSnapshot> {
  const issues = await tracker.listOpen();
  const me = await tracker.login();
  const cycles = issues
    .filter(issue => ownCycle(issue, me, queues))
    .sort((a, b) => a.key.localeCompare(b.key, undefined, {numeric: true}));
  const pulls = new Map<string, PullSnapshot[]>();
  const changes = new Map<string, ChangeView>();
  const facts = new Map<string, BranchFacts>();
  const texts = new Map<string, BranchText>();
  const tips = tipMessage ? new Map<string, string>() : undefined;
  const prepared: {
    issue: IssueRecord;
    files: FileSource;
    read: ReturnType<typeof readBranch>;
    listed: Pull[];
  }[] = [];
  for (const issue of cycles) {
    const files = filesAt(issue.key);
    const read = readBranch(issue.key, files, contentAt(issue.key));
    prepared.push({issue, files, read, listed: await review.pulls(issue.key)});
  }
  const openIds = [
    ...new Set(
      prepared.flatMap(item =>
        item.listed.filter(pull => pull.state === 'OPEN').map(pull => pull.id),
      ),
    ),
  ];
  const shared =
    openIds.length > 1 && review.conversations ? await review.conversations(openIds) : undefined;
  for (const item of prepared) {
    pulls.set(item.issue.key, await pullRecords(review, item.listed, item.files, shared));
    const {read} = item;
    changes.set(item.issue.key, read.change);
    if (!item.files.failed?.()) {
      facts.set(item.issue.key, read.facts);
      texts.set(item.issue.key, read.text);
    }
    if (tips && tipMessage) {
      try {
        tips.set(item.issue.key, await tipMessage(item.issue.key));
      } catch {
        tips.set(item.issue.key, '');
      }
    }
  }
  return {issues, cycles, pulls, changes, facts, texts, tips};
}
