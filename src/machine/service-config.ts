import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {parse} from 'yaml';

export type QueueConfig = {name: string; description?: string};

export type ServiceConfig = {
  queues: QueueConfig[];
  base: string;
  branchScope: string;
  ignoreComments: RegExp[];
};

export function loadServiceConfig(serviceRoot: string): ServiceConfig {
  const file = path.join(serviceRoot, 'openspec', 'config.yaml');
  if (!existsSync(file)) {
    throw new Error('openspec/config.yaml is missing');
  }
  const raw = parse(readFileSync(file, 'utf8')) as {sdd?: unknown} | null;
  const sdd = raw && typeof raw === 'object' ? raw.sdd : undefined;
  if (!sdd || typeof sdd !== 'object') {
    throw new Error('openspec/config.yaml: sdd is missing');
  }
  const section = sdd as {
    base?: unknown;
    'branch-scope'?: unknown;
    'ignore-comments'?: unknown;
    queues?: unknown;
  };
  if (!Array.isArray(section.queues)) {
    throw new Error('openspec/config.yaml: queues is missing');
  }
  if (section.queues.length === 0) {
    throw new Error('openspec/config.yaml: queues is empty');
  }
  const queues = section.queues.map(item => {
    const record = item && typeof item === 'object' ? (item as {name?: unknown; description?: unknown}) : {};
    if (typeof record.name !== 'string' || record.name === '') {
      throw new Error('openspec/config.yaml: queue name is missing');
    }
    const queue: QueueConfig = {name: record.name};
    if (typeof record.description === 'string') {
      queue.description = record.description;
    }
    return queue;
  });
  const ignoreComments = compileIgnore(section['ignore-comments']);
  return {
    queues,
    base: typeof section.base === 'string' && section.base !== '' ? section.base : 'trunk',
    branchScope:
      typeof section['branch-scope'] === 'string' && section['branch-scope'] !== ''
        ? section['branch-scope']
        : 'sdd',
    ignoreComments,
  };
}

function compileIgnore(value: unknown): RegExp[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
    throw new Error('openspec/config.yaml: ignore-comments is missing');
  }
  return value.map(item => {
    try {
      return new RegExp(item, 'i');
    } catch {
      throw new Error(`openspec/config.yaml: ignore-comments pattern ${JSON.stringify(item)} does not compile`);
    }
  });
}
