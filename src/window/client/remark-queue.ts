import type {LineDraft} from './gesture.ts';
import type {DocumentRemark} from './sidebar.tsx';

/**
 * Builds POST bodies for every non-empty unsent remark: line drafts, then Plan, Specify, Design.
 * Order matches what the send control must post when several fields hold text.
 */
export function buildAnswerPostsFromState(
  key: string,
  drafts: readonly LineDraft[],
  anchorForLine: (line: string) => {path?: string; at?: string; side?: string} | undefined,
  remark: DocumentRemark,
): URLSearchParams[] {
  const out: URLSearchParams[] = [];
  for (const draft of drafts) {
    if (draft.text.trim() === '') {
      continue;
    }
    const anchor = anchorForLine(draft.line);
    const body = new URLSearchParams();
    body.set('act', 'answer');
    body.set('key', key);
    body.set('hold', '1');
    body.set('reply', draft.text.trim());
    body.set('line', draft.line);
    body.set('question', draft.question);
    if (anchor?.path !== undefined && anchor.path !== '') {
      body.set('path', anchor.path);
    }
    if (anchor?.at !== undefined && anchor.at !== '') {
      body.set('at', anchor.at);
    }
    if (anchor?.side !== undefined && anchor.side !== '') {
      body.set('side', anchor.side);
    }
    out.push(body);
  }
  for (const layer of ['Plan', 'Specify', 'Design'] as const) {
    const text = remark[layer].trim();
    if (text === '') {
      continue;
    }
    const body = new URLSearchParams();
    body.set('act', 'answer');
    body.set('key', key);
    body.set('hold', '1');
    body.set('reply', text);
    body.set('layer', layer);
    out.push(body);
  }
  return out;
}
