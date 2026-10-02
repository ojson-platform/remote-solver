import {solverRoot} from './adapters/compose.ts';
import {openMachine} from './adapters/load.ts';
import {agentRuntime} from './adapters/runtime.ts';
import {runIssue, runSpy} from './main.ts';
import {runReview} from './reviewer/run.ts';

const usage = `Usage:
  remote-solver spy [--parallel N] [--interval S]
  remote-solver review
  remote-solver issue <key>

Cycle verbs are the sdd bin.`;

export type Route =
  | {kind: 'help'}
  | {kind: 'spy'; argv: string[]}
  | {kind: 'review'}
  | {kind: 'issue'; key: string};

export function route(argv: string[]): Route {
  const [command, ...rest] = argv;
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    return {kind: 'help'};
  }
  if (command === 'spy') {
    return {kind: 'spy', argv: rest};
  }
  if (command === 'review') {
    return {kind: 'review'};
  }
  if (command === 'issue') {
    const key = rest[0];
    if (!key || key.startsWith('-')) {
      return {kind: 'help'};
    }
    return {kind: 'issue', key};
  }
  return {kind: 'help'};
}

export async function runCli(argv: string[]): Promise<number> {
  const chosen = route(argv);
  if (chosen.kind === 'help') {
    console.error(usage);
    const asked = argv[0] === 'help' || argv[0] === '--help' || argv[0] === '-h';
    return asked ? 0 : 1;
  }
  const box = await openMachine(process.cwd(), {
    runtime: built =>
      agentRuntime({
        root: built.root,
        vcs: built.vcs,
        branchPrefix: built.config.branchPrefix,
        queueLabel: built.config.queueLabel,
        prBase: built.config.prBase,
        solverRoot: solverRoot(),
      }),
  });
  if (chosen.kind === 'spy') {
    await runSpy(box, chosen.argv);
    return 0;
  }
  if (chosen.kind === 'review') {
    return runReview(box);
  }
  return runIssue(box, chosen.key);
}

if (process.argv[1]?.endsWith('cli.ts') || process.argv[1]?.endsWith('remote-solver.mjs')) {
  process.exit(await runCli(process.argv.slice(2)));
}
