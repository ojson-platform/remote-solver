import type {Openspec, QueueConfig, Review, Runtime, Tracker, Vcs} from '../machine.ts';

import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {performIssue} from '../machine/flow/flow.ts';
import {adapterMachine} from '../machine.ts';

import {openspecExecutable} from './openspec/openspec.ts';
import {githubAdapters} from './tracker/github.ts';
import {gitVcs, packageLinks} from './vcs/vcs.ts';

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
  openspec: Openspec;
};

/** Anything omitted is the adapter this repository ships: GitHub, git, sandcastle, the OpenSpec binary. */
export type MachineOptions = {
  config?: Partial<MachineConfig>;
  tracker?: Tracker;
  review?: Review;
  vcs?: Vcs;
  runtime?: Runtime;
  openspec?: Openspec;
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
    options.tracker && options.review
      ? undefined
      : githubAdapters({prBase: config.base, ignoreComments: config.ignoreComments}, adapterMachine);
  return {
    root,
    config,
    tracker: options.tracker ?? github!.tracker,
    review: options.review ?? github!.review,
    vcs:
      options.vcs ??
      gitVcs(root, {branchPrefix: config.branchScope, defaultBranch: `origin/${config.base}`}, adapterMachine),
    runtime: options.runtime,
    openspec: options.openspec ?? openspecExecutable,
  };
}

/** One settlement of one issue. The reading performs a merge and settles again. */
export function turn(box: Machine, key: string): ReturnType<typeof performIssue> {
  const pending = box.vcs.tipMessage ? box.vcs.tipMessage(key) : Promise.resolve(undefined);
  return pending.then(async tip =>
    performIssue(key, {
      tracker: box.tracker,
      review: box.review,
      files: box.vcs.filesAt(key),
      queues: box.config.queues,
      root: box.root,
      login: await box.tracker.login(),
      tip,
      checkout: () =>
        box.vcs.prepare(key, {worktreesDir: '.worktrees', links: packageLinks(solverRoot())}),
      readTip: () => (box.vcs.tipMessage ? box.vcs.tipMessage(key) : Promise.resolve(undefined)),
      openspec: box.openspec,
    }),
  );
}
