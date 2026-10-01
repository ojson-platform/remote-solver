import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {performIssue} from '../machine/flow.ts';
import type {Review, Runtime, Tracker, Vcs} from '../machine/port.ts';
import {githubAdapters} from './github.ts';
import {sandcastleRuntime} from './runtime.ts';
import {gitVcs} from './vcs.ts';

export type MachineConfig = {
  queueLabel: string;
  branchPrefix: string;
  /** Ref a missing issue branch is cut from. */
  defaultBranch: string;
  prBase: string;
};

export type Machine = {
  root: string;
  config: MachineConfig;
  tracker: Tracker;
  review: Review;
  vcs: Vcs;
  runtime: Runtime;
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
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
}

export function machine(root = process.cwd(), options: MachineOptions = {}): Machine {
  const config: MachineConfig = {
    queueLabel: 'Sandcastle',
    branchPrefix: 'sdd',
    defaultBranch: 'origin/master',
    prBase: 'master',
    ...options.config,
  };
  const github =
    options.tracker && options.review ? undefined : githubAdapters({prBase: config.prBase, root});
  return {
    root,
    config,
    tracker: options.tracker ?? github!.tracker,
    review: options.review ?? github!.review,
    vcs: options.vcs ?? gitVcs(root, {branchPrefix: config.branchPrefix}),
    runtime:
      options.runtime ??
      sandcastleRuntime({
        root,
        skillsDir: path.join(solverRoot(), 'skills'),
        branchPrefix: config.branchPrefix,
        baseBranch: config.defaultBranch,
        queueLabel: config.queueLabel,
        prBase: config.prBase,
        solverRoot: solverRoot(),
      }),
  };
}

/** One settlement of one issue. The reading performs a merge and settles again. */
export function turn(box: Machine, key: string): ReturnType<typeof performIssue> {
  return performIssue(key, {
    tracker: box.tracker,
    review: box.review,
    files: box.vcs.filesAt(key),
    queueLabel: box.config.queueLabel,
  });
}
