import type {Vcs} from './machine/port.ts';

import {solverRoot, type Machine} from './adapters/compose.ts';
import {repo} from './adapters/tracker/github.ts';
import {openMachine} from './adapters/load.ts';
import {agentRuntime, type AgentRuntimeConfig} from './adapters/runtime/runtime.ts';
import {runIssue, runSpy} from './main.ts';
import {runReview} from './reviewer/run.ts';
import {
  boardModel,
  defaultHomePath,
  serveLiveBoard,
  createBoardSpyState,
  watchSpy,
} from './window/live.ts';

export {bundleClient} from './window/client/bundle.ts';

const usage = `Usage:
  remote-solver spy [--parallel N] [--interval S]
  remote-solver review
  remote-solver issue <key>
  remote-solver board [--home PATH] [--port N]

Cycle verbs are the sdd bin.`;

export type Route =
  | {kind: 'help'}
  | {kind: 'spy'; argv: string[]}
  | {kind: 'review'}
  | {kind: 'issue'; key: string}
  | {kind: 'board'; home?: string; port?: number};

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
  if (command === 'board') {
    return boardRoute(rest);
  }
  return {kind: 'help'};
}

/** `--home` and `--port` in either order. A bad port is refused before the page starts. */
function boardRoute(rest: string[]): Route {
  let home: string | undefined;
  let port: number | undefined;
  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index];
    const value = rest[index + 1];
    if (flag === '--home' && value !== undefined && value !== '' && !value.startsWith('-')) {
      if (home !== undefined) {
        return {kind: 'help'};
      }
      home = value;
      index += 1;
      continue;
    }
    if (flag === '--port' && value !== undefined && /^[1-9]\d*$/.test(value)) {
      const number = Number(value);
      if (port !== undefined || number > 65535) {
        return {kind: 'help'};
      }
      port = number;
      index += 1;
      continue;
    }
    return {kind: 'help'};
  }
  return {
    kind: 'board',
    ...(home !== undefined ? {home} : {}),
    ...(port !== undefined ? {port} : {}),
  };
}

type LauncherSource = {
  root: string;
  vcs: Vcs;
  config: Pick<Machine['config'], 'queues' | 'branchScope' | 'base'>;
};

/** Runtime whose prompt `QUEUE` is the first configured queue name. */
export function launcherRuntime(
  built: LauncherSource,
  modelOf?: AgentRuntimeConfig['modelOf'],
): ReturnType<typeof agentRuntime> {
  const queue = built.config.queues[0];
  if (!queue) {
    throw new Error('openspec/config.yaml: queues is missing');
  }
  const config: AgentRuntimeConfig = {
    root: built.root,
    vcs: built.vcs,
    branchPrefix: built.config.branchScope,
    queueLabel: queue.name,
    prBase: built.config.base,
    solverRoot: solverRoot(),
    ...(modelOf ? {modelOf} : {}),
  };
  return agentRuntime(config);
}

export async function runCli(argv: string[]): Promise<number> {
  const chosen = route(argv);
  if (chosen.kind === 'help') {
    console.error(usage);
    const asked = argv[0] === 'help' || argv[0] === '--help' || argv[0] === '-h';
    return asked ? 0 : 1;
  }
  if (chosen.kind === 'board') {
    await runBoard(chosen.home, chosen.port);
    return 0;
  }
  const box = await openMachine(process.cwd(), {
    runtime: launcherRuntime,
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

/** Serve the window and run the machine spy for this repository. */
async function runBoard(home: string | undefined, port: number | undefined): Promise<void> {
  const root = process.cwd();
  const homePath = home ?? defaultHomePath();
  const box = await openMachine(root, {
    runtime: built => launcherRuntime(built, mode => boardModel(homePath, root, mode)),
  });
  let pageNote: () => void = () => {};
  const spy = createBoardSpyState(() => {
    pageNote();
  });
  const page = await serveLiveBoard({
    homePath,
    repo: repo().slug,
    tracker: box.tracker,
    review: box.review,
    vcs: box.vcs,
    checkout: root,
    leading: spy.leading,
    spyNote: () => spy.turnsLine(),
    turn: spy.turn,
    decision: spy.decision,
    ...(port !== undefined ? {port} : {}),
  });
  pageNote = () => {
    page.note();
  };
  console.log(page.url);
  void watchSpy(box, {
    ...spy.sink,
    refresh: () => page.refresh(),
    apply: snapshot => {
      page.apply(snapshot);
    },
  }).catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
  });
  await new Promise<void>(() => {});
}

if (process.argv[1]?.endsWith('cli.ts') || process.argv[1]?.endsWith('remote-solver.mjs')) {
  process.exit(await runCli(process.argv.slice(2)));
}
