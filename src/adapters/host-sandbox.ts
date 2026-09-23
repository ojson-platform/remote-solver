import {spawn} from 'node:child_process';
import {copyFile} from 'node:fs/promises';
import {createInterface} from 'node:readline';

import {createBindMountSandboxProvider, type BindMountSandboxHandle} from '@ai-hero/sandcastle';

type ExecOptions = {
  onLine?: (line: string) => void;
  cwd?: string;
  sudo?: boolean;
  stdin?: string;
};

type ExecResult = {stdout: string; stderr: string; exitCode: number};

/**
 * Sandcastle copies the host git identity with `git config --global` during
 * setup. This host has `user.name` more than once, so that write fails and
 * would rewrite `~/.gitconfig`. The commands are answered here, before a
 * process starts. Commits keep the identity already configured for the repo.
 */
export function skipsGlobalGitConfig(command: string): boolean {
  return command.startsWith('git config --global ');
}

export function hostSandbox(): ReturnType<typeof createBindMountSandboxProvider> {
  return createBindMountSandboxProvider({
    name: 'host',
    create: options => openHostHandle(options.worktreePath, options.env),
  });
}

/** A bind-mount handle whose commands run on this machine, in the worktree. */
export function openHostHandle(worktreePath: string, env: Record<string, string> = {}): Promise<BindMountSandboxHandle> {
  const processEnv = {...process.env, ...env};
  const handle: BindMountSandboxHandle = {
    worktreePath,
    exec(command, opts) {
      if (skipsGlobalGitConfig(command)) {
        return Promise.resolve({stdout: '', stderr: '', exitCode: 0});
      }
      return spawnShell(command, opts?.cwd ?? worktreePath, processEnv, opts);
    },
    copyFileIn: (hostPath, sandboxPath) => copyFile(hostPath, sandboxPath),
    copyFileOut: (sandboxPath, hostPath) => copyFile(sandboxPath, hostPath),
    close: async () => {},
  };
  return Promise.resolve(handle);
}

function spawnShell(command: string, cwd: string, env: NodeJS.ProcessEnv, opts?: ExecOptions): Promise<ExecResult> {
  const isWindows = process.platform === 'win32';
  const shell = isWindows ? 'cmd.exe' : 'sh';
  const args = isWindows ? ['/d', '/s', '/c', command] : ['-c', command];
  return new Promise((resolve, reject) => {
    const child = spawn(shell, args, {
      cwd,
      env,
      stdio: [opts?.stdin !== undefined ? 'pipe' : 'ignore', 'pipe', 'pipe'],
      windowsVerbatimArguments: isWindows,
    });
    let settled = false;
    const finish = (result: ExecResult) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(result);
    };
    const fail = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    };
    child.on('error', error => fail(new Error(`exec failed: ${error.message}`)));
    if (!child.stdout || !child.stderr) {
      fail(new Error('exec failed: missing pipes'));
      return;
    }
    if (opts?.stdin !== undefined && child.stdin) {
      child.stdin.write(opts.stdin);
      child.stdin.end();
    }
    if (opts?.onLine) {
      const onLine = opts.onLine;
      const stdout: string[] = [];
      const stderr: string[] = [];
      const lines = createInterface({input: child.stdout});
      lines.on('line', line => {
        stdout.push(line);
        onLine(line);
      });
      child.stderr.on('data', chunk => {
        stderr.push(chunk.toString());
      });
      child.on('close', code => finish({stdout: stdout.join('\n'), stderr: stderr.join(''), exitCode: code ?? 0}));
      return;
    }
    const stdout: string[] = [];
    const stderr: string[] = [];
    child.stdout.on('data', chunk => stdout.push(chunk.toString()));
    child.stderr.on('data', chunk => stderr.push(chunk.toString()));
    child.on('close', code => finish({stdout: stdout.join(''), stderr: stderr.join(''), exitCode: code ?? 0}));
  });
}
