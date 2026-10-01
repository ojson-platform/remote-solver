import {machine} from './adapters/compose.ts';
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
  if (chosen.kind === 'spy') {
    await runSpy(chosen.argv);
    return 0;
  }
  if (chosen.kind === 'review') {
    return runReview(machine());
  }
  return runIssue(chosen.key);
}

if (process.argv[1]?.endsWith('cli.ts')) {
  process.exit(await runCli(process.argv.slice(2)));
}
