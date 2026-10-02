import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {performIssue} from '../machine/flow.ts';
import type {Review, Runtime, Tracker, Vcs} from '../machine/port.ts';
import {githubAdapters} from './github.ts';
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
    vcs: options.vcs ?? gitVcs(root, {branchPrefix: config.branchPrefix, defaultBranch: config.defaultBranch}),
    runtime: options.runtime,
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
