import {pathToFileURL} from 'node:url';

import type {Review, Runtime, Tracker, Vcs} from '../machine/port.ts';
import {adapterFile} from './locate.ts';
import {machine, type Machine, type MachineConfig} from './compose.ts';

type AdapterModule = {
  createAdapters(
    root: string,
    config: MachineConfig,
  ): {config?: Partial<MachineConfig>; tracker: Tracker; review: Review; vcs: Vcs};
};

/** GitHub ports, unless the Arcadia adapter file is on disk. Runtime only when the caller builds one. */
export async function openMachine(
  root: string,
  options: {runtime?: (box: Omit<Machine, 'runtime'>) => Runtime} = {},
): Promise<Machine> {
  const file = adapterFile(process.argv[1] ?? '', root);
  let built = machine(root);
  if (file) {
    const loaded = (await import(pathToFileURL(file).href)) as AdapterModule;
    const made = loaded.createAdapters(root, built.config);
    built = machine(root, {
      config: made.config,
      tracker: made.tracker,
      review: made.review,
      vcs: made.vcs,
    });
  }
  return {...built, runtime: options.runtime?.(built)};
}
