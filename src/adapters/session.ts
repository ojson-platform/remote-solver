import {mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';

/** One Cursor chat left by a skill run. `resumed` is true after that chat was continued once. */
export type ChatRecord = {
  action: string;
  signature: string;
  sessionId: string;
  resumed: boolean;
};

export type ChatClaim =
  | {kind: 'fresh'}
  | {kind: 'resume'; sessionId: string}
  | {kind: 'spent'};

function chatPath(root: string, key: string): string {
  const safe = key.replace(/[/\\:*?"<>|]/g, '-');
  return path.join(root, '.sandcastle', 'sessions', `${safe}.json`);
}

function isRecord(value: unknown): value is ChatRecord {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as ChatRecord;
  return (
    typeof record.action === 'string' &&
    typeof record.signature === 'string' &&
    typeof record.sessionId === 'string' &&
    typeof record.resumed === 'boolean'
  );
}

/** The chat recorded for this issue, when the file is present and well formed. */
export function readChat(root: string, key: string): ChatRecord | undefined {
  try {
    const parsed: unknown = JSON.parse(readFileSync(chatPath(root, key), 'utf8'));
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function writeChat(root: string, key: string, record: ChatRecord): void {
  const file = chatPath(root, key);
  mkdirSync(path.dirname(file), {recursive: true});
  writeFileSync(file, `${JSON.stringify(record)}\n`);
}

/** Drop the chat so the next run starts a new one. */
export function clearChat(root: string, key: string): void {
  rmSync(chatPath(root, key), {force: true});
}

/**
 * Remember the chat id as soon as the agent reports it.
 * A decision already marked resumed stays resumed, even if the id changes.
 */
export function rememberChat(
  root: string,
  key: string,
  next: {action: string; signature: string; sessionId: string},
): void {
  const prior = readChat(root, key);
  const resumed = Boolean(
    prior && prior.action === next.action && prior.signature === next.signature && prior.resumed,
  );
  writeChat(root, key, {...next, resumed});
}

/**
 * How this decision should use the recorded chat.
 * The same decision resumes once. A second time is spent. Any other decision starts fresh.
 */
export function claimChat(root: string, key: string, action: string, signature: string): ChatClaim {
  const prior = readChat(root, key);
  if (!prior || prior.action !== action || prior.signature !== signature) {
    if (prior) {
      clearChat(root, key);
    }
    return {kind: 'fresh'};
  }
  if (prior.resumed) {
    return {kind: 'spent'};
  }
  writeChat(root, key, {...prior, resumed: true});
  return {kind: 'resume', sessionId: prior.sessionId};
}
