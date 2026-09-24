import {machine} from './adapters/compose.ts';
import {runIssue, runSpy} from './main.ts';
import {runReview} from './reviewer/run.ts';
import {runSdd} from './sdd.ts';

const usage = `Usage:
  remote-solver spy [--parallel N] [--interval S]
  remote-solver review
  remote-solver issue <key>
  remote-solver plan | set <key> <phase> | wait <key> "<what the person does>" | unwait <key> | accept <key> | publish <key> "<title>" | checks <pull> | thread open|reply|say|resolve ... | mirror <key> <Layer> <text>

Working directory is the service repository.`;

export type Route =
  | {kind: 'help'}
  | {kind: 'spy'; argv: string[]}
  | {kind: 'review'}
  | {kind: 'issue'; key: string}
  | {kind: 'sdd'; argv: string[]};

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
  return {kind: 'sdd', argv};
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
  if (chosen.kind === 'issue') {
    return runIssue(chosen.key);
  }
  runSdd(chosen.argv);
  return 0;
}

if (process.argv[1]?.endsWith('cli.ts')) {
  process.exit(await runCli(process.argv.slice(2)));
}
