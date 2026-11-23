import type {Decision} from '../decide/types.ts';
import type {Review, Vcs} from '../port.ts';

import path from 'node:path';

import {changeDir} from '../change/naming.ts';
import {HEADINGS, openItems} from '../change/text.ts';
import {readReason} from '../decide/reason.ts';

export type DialogEntry = {text: string; record: string};

type DialogPorts = {
  review: Pick<Review, 'pulls' | 'threadList'>;
  vcs: Pick<Vcs, 'filesAt'>;
};

const ITEM = {
  questions: {
    heading: HEADINGS.openQuestions,
    file: 'proposal.md',
    layer: 'proposal',
    phase: 'proposing',
  },
  decisions: {
    heading: HEADINGS.openDecisions,
    file: 'design.md',
    layer: 'design',
    phase: 'designing',
  },
} as const;

function slash(file: string): string {
  return file.split('\\').join('/');
}

/** One entry per open item. An open thread on that line is the layer's action, so it is not asked again. */
export function itemDialog(input: {
  pull: string;
  file: string;
  text: string;
  heading: string;
  layer: string;
  phase: string;
  threads: readonly {resolved: boolean; path: string; line: number | null}[];
}): DialogEntry[] {
  const file = slash(input.file);
  const taken = new Set(
    input.threads
      .filter(thread => !thread.resolved && thread.line !== null)
      .map(thread => `${slash(thread.path)}:${thread.line}`),
  );
  return openItems(input.text, input.heading)
    .filter(item => !taken.has(`${file}:${item.line}`))
    .map(item => ({
      text: item.text,
      record: `sdd thread open ${input.pull} ${file} ${item.line} 'sdd:layer=${input.layer} → ${input.phase} <answer>'`,
    }));
}

/**
 * The questions a printed wait carries. The poll counted these items on the
 * issue branch, so the record anchors that line and not a dirty checkout.
 * The record names one pull. Several open pulls are already their own wait.
 */
export async function waitDialog(box: DialogPorts, decision: Decision): Promise<DialogEntry[]> {
  if (decision.kind !== 'wait' || decision.issue === null) {
    return [];
  }
  const reason = readReason(decision.reason);
  const which = reason.questions ? ITEM.questions : reason.decisions ? ITEM.decisions : null;
  if (!which) {
    return [];
  }
  const open = (await box.review.pulls(decision.issue)).filter(pull => pull.state === 'OPEN');
  if (open.length !== 1) {
    return [];
  }
  const pull = open[0]?.id ?? '';
  const file = slash(path.join(changeDir(decision.issue), which.file));
  const files = box.vcs.filesAt(decision.issue);
  if (!files.exists(file) || files.failed?.()) {
    return [];
  }
  return itemDialog({
    pull,
    file,
    text: files.read(file),
    heading: which.heading,
    layer: which.layer,
    phase: which.phase,
    threads: await box.review.threadList(pull),
  });
}
