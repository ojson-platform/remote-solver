import assert from 'node:assert/strict';
import {chmodSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'vitest';

import type {AgentProvider, ParsedStreamEvent} from '@ai-hero/sandcastle';

import {runAgent} from './agent.ts';

function provider(bin: string, extra: Partial<AgentProvider> = {}): AgentProvider {
  return {
    name: 'fake',
    buildPrintCommand: () => ({command: bin}),
    parseStreamLine(line: string): ParsedStreamEvent[] {
      if (line.startsWith('session ')) {
        return [{type: 'session_id', sessionId: line.slice('session '.length)}];
      }
      if (line === 'result') {
        return [{type: 'result'}];
      }
      if (line.startsWith('text ')) {
        return [{type: 'text', text: line.slice('text '.length)}];
      }
      return [];
    },
    env: {},
    captureSessions: false,
    ...extra,
  };
}

function script(dir: string, body: string): string {
  const file = path.join(dir, 'fake-agent');
  writeFileSync(file, `#!/bin/sh\n${body}\n`);
  chmodSync(file, 0o755);
  return file;
}

test('a result line is the answer, and a recorded session is captured', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'sdd-agent-'));
  const bin = script(dir, 'echo "session abc"\necho "text hello <verdict>clean</verdict>"\necho result');
  const captured: string[] = [];
  const answer = await runAgent({
    cwd: dir,
    hostCwd: dir,
    provider: provider(bin, {
      captureSessions: true,
      sessionStorage: {
        async resumeIntoSandbox() {},
        async captureToHost(input) {
          captured.push(input.sessionId);
        },
        hostSessionFilePath: (root, id) => path.join(root, `${id}.session`),
        async readHostSession() {
          return '{"usage":true}';
        },
        async existsOnHost() {
          return false;
        },
        async findByIdOnHost() {
          return null;
        },
      },
      parseSessionUsage: () => ({
        inputTokens: 1,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
        outputTokens: 2,
      }),
    }),
    name: 'review',
    promptFile: writePrompt(dir),
    promptArgs: {KEY: '7'},
    logPath: path.join(dir, 'agent.log'),
    outputTag: 'verdict',
  });
  assert.equal(answer.text, 'clean');
  assert.equal(answer.sessionId, 'abc');
  assert.deepEqual(captured, ['abc']);
  assert.equal(answer.usage?.outputTokens, 2);
  assert.match(readFileSync(path.join(dir, 'agent.log'), 'utf8'), /session abc/);
});

test('a process that stays up after result stops on the grace timer', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'sdd-agent-'));
  const bin = script(dir, 'echo "text done"\necho result\nsleep 30');
  const started = Date.now();
  const answer = await runAgent({
    cwd: dir,
    hostCwd: dir,
    provider: provider(bin),
    name: 'step',
    promptFile: writePrompt(dir),
    promptArgs: {},
    logPath: path.join(dir, 'agent.log'),
    resultGraceMs: 200,
    idleTimeoutSeconds: 5,
  });
  assert.equal(answer.text, 'done');
  assert.ok(Date.now() - started < 5000);
});

function writePrompt(dir: string): string {
  const file = path.join(dir, 'prompt.md');
  writeFileSync(file, 'issue {{KEY}}');
  return file;
}
