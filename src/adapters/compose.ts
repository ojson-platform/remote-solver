import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {performIssue} from '../machine/flow.ts';
import type {Review, Runtime, Tracker, Vcs} from '../machine/port.ts';
import type {QueueConfig} from '../machine/service-config.ts';
import {githubAdapters} from './github.ts';
import {gitVcs} from './vcs.ts';

export type MachineConfig = {
  queues: QueueConfig[];
  base: string;
  branchScope: string;
  ignoreComments: RegExp[];
};

export type Machine = {
  root: string;
  config: MachineConfig;
  tracker: Tracker;
  review: Review;
  vcs: Vcs;
  runtime?: Runtime;
};

/** Anything omitted is the adapter this repository ships: GitHub, git, sandcastle. */
export type MachineOptions = {
  config?: Partial<MachineConfig>;
  tracker?: Tracker;
  review?: Review;
  vcs?: Vcs;
  runtime?: Runtime;
};

/** This package, not the service the machine is pointed at. */
export function solverRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  let dir = here;
  for (;;) {
    const pkg = path.join(dir, 'package.json');
    if (existsSync(pkg)) {
      const name = (JSON.parse(readFileSync(pkg, 'utf8')) as {name?: string}).name;
      if (name === '@ojson/remote-solver') {
        return dir;
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return path.resolve(here, '../..');
    }
    dir = parent;
  }
}

export function machine(root = process.cwd(), options: MachineOptions = {}): Machine {
  const given = options.config ?? {};
  const config: MachineConfig = {
    queues: given.queues ?? [],
    base: given.base ?? 'trunk',
    branchScope: given.branchScope ?? 'sdd',
    ignoreComments: given.ignoreComments ?? [],
  };
  if (config.queues.length === 0) {
    throw new Error('openspec/config.yaml: queues is missing');
  }
  const github =
    options.tracker && options.review ? undefined : githubAdapters({prBase: config.base, root});
  return {
    root,
    config,
    tracker: options.tracker ?? github!.tracker,
    review: options.review ?? github!.review,
    vcs:
      options.vcs ??
      gitVcs(root, {branchPrefix: config.branchScope, defaultBranch: `origin/${config.base}`}),
    runtime: options.runtime,
  };
}

/** One settlement of one issue. The reading performs a merge and settles again. */
export function turn(box: Machine, key: string): ReturnType<typeof performIssue> {
  return performIssue(key, {
    tracker: box.tracker,
    review: box.review,
    files: box.vcs.filesAt(key),
    queues: box.config.queues,
  });
}
