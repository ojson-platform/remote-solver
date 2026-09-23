import path from 'node:path';

import {solverRoot} from '../adapters/compose.ts';
import type {Runtime} from '../machine/port.ts';
import type {Dossier} from './dossier.ts';
import {parseVerdict, type Verdict} from './verdict.ts';

function failureReason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** One runtime pass. A missing or broken answer is unjudged, never a clean merge. */
export async function sandcastleJudge(
  runtime: Pick<Runtime, 'ask'>,
  dossier: Dossier,
): Promise<Verdict> {
  try {
    const text = await runtime.ask({
      name: 'review',
      mode: 'judgment',
      promptFile: path.join(solverRoot(), 'prompts', 'review.md'),
      promptArgs: {
        COMMITS: dossier.commits,
        DIFF: dossier.diff,
        CHANGE: dossier.change,
        STANDARDS: dossier.standards,
      },
      branch: `reviewer/${dossier.head.slice(0, 12)}`,
      outputTag: 'verdict',
    });
    return parseVerdict(text);
  } catch (error) {
    return {kind: 'unjudged', reason: failureReason(error)};
  }
}
