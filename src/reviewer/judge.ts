import type {Dossier} from './dossier.ts';
import type {Runtime} from '../machine/port.ts';

import path from 'node:path';

import {solverRoot} from '../adapters/compose.ts';

import {parseVerdict, type Verdict} from './verdict.ts';

function failureReason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const RETRY = [
  'The previous answer was not a verdict.',
  'Reply with one line only: clean, or remark: <text>.',
  'Put that line inside <verdict> and </verdict>.',
  'Do not repeat the dossier.',
].join('\n');

/** One runtime pass. A missing or broken answer is asked once more in the same chat, then stays unjudged. */
export async function sandcastleJudge(
  runtime: Pick<Runtime, 'ask'>,
  dossier: Dossier,
): Promise<Verdict> {
  const promptFile = path.join(solverRoot(), 'prompts', 'review.md');
  const branch = `reviewer/${dossier.head.slice(0, 12)}`;
  let answer;
  try {
    answer = await runtime.ask({
      name: 'review',
      mode: 'judgment',
      promptFile,
      promptArgs: {
        COMMITS: dossier.commits,
        DIFF: dossier.diff,
        CHANGE: dossier.change,
        STANDARDS: dossier.standards,
      },
      branch,
      outputTag: 'verdict',
    });
  } catch (error) {
    return {kind: 'unjudged', reason: failureReason(error)};
  }
  const verdict = parseVerdict(answer.text);
  if (verdict.kind !== 'unjudged' || !answer.sessionId) {
    return verdict;
  }
  try {
    const retry = await runtime.ask({
      name: 'review',
      mode: 'judgment',
      promptFile,
      promptArgs: {},
      prompt: RETRY,
      branch,
      outputTag: 'verdict',
      resumeSession: answer.sessionId,
    });
    return parseVerdict(retry.text);
  } catch (error) {
    return {kind: 'unjudged', reason: failureReason(error)};
  }
}
