import type {Openspec, Review, Runtime, Tracker, Vcs} from '../machine.ts';

import {pathToFileURL} from 'node:url';

import {loadServiceConfig} from '../machine/spy/service-config.ts';
import {adapterMachine} from '../machine.ts';

import {machine, type Machine, type MachineConfig} from './compose.ts';
import {adapterFile} from './locate.ts';

type AdapterModule = {
  createAdapters(
    root: string,
    config: MachineConfig,
    machine: typeof adapterMachine,
  ): {config?: Partial<MachineConfig>; tracker: Tracker; review: Review; vcs: Vcs; openspec?: Openspec};
};

/** GitHub ports, unless the Arcadia adapter file is on disk. Runtime only when the caller builds one. */
export async function openMachine(
  root: string,
  options: {runtime?: (box: Omit<Machine, 'runtime'>) => Runtime} = {},
): Promise<Machine> {
  const config = loadServiceConfig(root);
  const file = adapterFile(process.argv[1] ?? '', root);
  let built = machine(root, {config});
  if (file) {
    const loaded = (await import(pathToFileURL(file).href)) as AdapterModule;
    const made = loaded.createAdapters(root, built.config, adapterMachine);
    built = machine(root, {
      config,
      tracker: made.tracker,
      review: made.review,
      vcs: made.vcs,
      openspec: made.openspec,
    });
  }
  return {...built, runtime: options.runtime?.(built)};
}
