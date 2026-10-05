import type {QueueConfig} from './service-config.ts';

export function queueOf(
  labels: readonly string[],
  queues: readonly QueueConfig[],
): QueueConfig | undefined {
  return queues.find(queue => labels.includes(queue.name));
}
