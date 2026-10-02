import {spawn} from 'node:child_process';
import {appendFileSync, existsSync, mkdirSync, readFileSync} from 'node:fs';
import path from 'node:path';

import type {AgentProvider} from '@ai-hero/sandcastle';

import type {AgentResult} from '../machine/port.ts';
import {openHostHandle} from './host-sandbox.ts';

export type AgentRun = {
  cwd: string;
  /** Service root. Session files are stored under it. */
  hostCwd: string;
  provider: AgentProvider;
  name: string;
  promptFile: string;
  promptArgs: Record<string, string>;
  logPath: string;
  outputTag?: string;
  resumeSession?: string;
  forkSession?: boolean;
  /** Seconds of stdout silence before the run is rejected. Default 600. */
  idleTimeoutSeconds?: number;
  /** Milliseconds to wait after a result event before stopping a process that will not exit. Default 60_000. */
  resultGraceMs?: number;
};

function substitute(template: string, args: Record<string, string>): string {
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_match, key: string) => args[key] ?? '');
}

function envFile(hostCwd: string): Record<string, string> {
  const file = path.join(hostCwd, '.sandcastle', '.env');
  if (!existsSync(file)) {
    return {};
  }
  const values: Record<string, string> = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      values[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
    }
  }
  return values;
}

function tagged(text: string, tag: string | undefined): string {
  if (!tag) {
    return text;
  }
  const found = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(text);
  return found?.[1] ?? text;
}

type Capture = {text: string; sessionId?: string};

/** One agent process. Resolves on a clean exit, or after a result event if the process stays up. */
function runProcess(
  command: string,
  stdin: string | undefined,
  cwd: string,
  env: NodeJS.ProcessEnv,
  provider: AgentProvider,
  logPath: string,
  idleMs: number,
  graceMs: number,
): Promise<Capture> {
  mkdirSync(path.dirname(logPath), {recursive: true});
  return new Promise((resolve, reject) => {
    const child = spawn('sh', ['-c', command], {cwd, env, stdio: ['pipe', 'pipe', 'pipe']});
    if (stdin !== undefined && child.stdin) {
      child.stdin.write(stdin);
    }
    child.stdin?.end();
    let stderr = '';
    let text = '';
    let sessionId: string | undefined;
    let buffer = '';
    let settled = false;
    let sawResult = false;
    let grace: NodeJS.Timeout | undefined;
    const idle = setTimeout(() => stop(false), idleMs);
    const resetIdle = () => {
      idle.refresh();
    };
    const stop = (ok: boolean, code = 1) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(idle);
      if (grace) {
        clearTimeout(grace);
      }
      if (ok) {
        resolve({text, sessionId});
        return;
      }
      reject(new Error(`agent exited ${code}: ${stderr.slice(-500)}`));
    };
    child.stdout?.on('data', (chunk: Buffer) => {
      resetIdle();
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        appendFileSync(logPath, `${line}\n`);
        for (const event of provider.parseStreamLine(line)) {
          if (event.type === 'text') {
            text += event.text;
          }
          if (event.type === 'session_id') {
            sessionId = event.sessionId;
          }
          if (event.type === 'result' && !sawResult) {
            sawResult = true;
            grace = setTimeout(() => {
              child.kill();
              stop(true);
            }, graceMs);
          }
        }
      }
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', () => stop(false, 1));
    child.on('close', code => {
      if (buffer) {
        appendFileSync(logPath, `${buffer}\n`);
      }
      stop(code === 0 || sawResult, code ?? 1);
    });
  });
}

/** Run one agent in a directory that is already the right checkout. */
export async function runAgent(run: AgentRun): Promise<AgentResult> {
  const prompt = substitute(readFileSync(run.promptFile, 'utf8'), run.promptArgs);
  const handle = await openHostHandle(run.cwd);
  if (run.resumeSession && run.provider.sessionStorage) {
    await run.provider.sessionStorage.resumeIntoSandbox({
      hostCwd: run.hostCwd,
      sandboxCwd: run.cwd,
      sessionId: run.resumeSession,
      handle,
    });
  }
  const printed = run.provider.buildPrintCommand({
    prompt,
    dangerouslySkipPermissions: true,
    resumeSession: run.resumeSession,
    forkSession: run.forkSession,
  });
  const captured = await runProcess(
    printed.command,
    printed.stdin,
    run.cwd,
    {...process.env, ...envFile(run.hostCwd), ...run.provider.env},
    run.provider,
    run.logPath,
    (run.idleTimeoutSeconds ?? 600) * 1000,
    run.resultGraceMs ?? 60_000,
  );
  const storage = run.provider.sessionStorage;
  let sessionFilePath: string | undefined;
  let usage = undefined;
  if (run.provider.captureSessions && storage && captured.sessionId) {
    await storage.captureToHost({
      hostCwd: run.hostCwd,
      sandboxCwd: run.cwd,
      sessionId: captured.sessionId,
      handle,
    });
    sessionFilePath = storage.hostSessionFilePath(run.hostCwd, captured.sessionId);
    if (run.provider.parseSessionUsage) {
      const content = await storage.readHostSession(run.hostCwd, captured.sessionId);
      if (content) {
        usage = run.provider.parseSessionUsage(content);
      }
    }
  }
  return {
    text: tagged(captured.text, run.outputTag),
    sessionId: captured.sessionId,
    sessionFilePath,
    usage,
  };
}
