import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';

import {parse} from 'yaml';

function isDoc(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function filled(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * The cycle field as non-empty points. A string of spaces is not a point.
 * A missing value, an empty value, or a value that is not a map is an empty map.
 * The machine does not create the field.
 */
export function cycleHooks(value: unknown): Record<string, Record<string, string>> {
  if (!isDoc(value)) {
    return {};
  }
  const map: Record<string, Record<string, string>> = {};
  for (const [action, points] of Object.entries(value)) {
    if (!isDoc(points)) {
      continue;
    }
    const kept: Record<string, string> = {};
    for (const [point, text] of Object.entries(points)) {
      if (!filled(text)) {
        continue;
      }
      kept[point] = text;
    }
    if (Object.keys(kept).length > 0) {
      map[action] = kept;
    }
  }
  return map;
}

/** `sdd.hooks` from a checkout. A missing or unreadable file has none. */
export function serviceHookDoc(root: string): unknown {
  const file = path.join(root, 'openspec', 'config.yaml');
  if (!existsSync(file)) {
    return undefined;
  }
  try {
    const raw = parse(readFileSync(file, 'utf8')) as {sdd?: unknown} | null;
    if (!isDoc(raw) || !isDoc(raw.sdd)) {
      return undefined;
    }
    return raw.sdd.hooks;
  } catch {
    return undefined;
  }
}

function paragraphs(value: unknown): string[] {
  if (filled(value)) {
    return [value];
  }
  if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
    return value.filter(filled);
  }
  return [];
}

function serviceParagraphs(hooks: unknown, action: string, point: string): string[] {
  if (!isDoc(hooks)) {
    return [];
  }
  const points = hooks[action];
  if (!isDoc(points)) {
    return [];
  }
  return paragraphs(points[point]);
}

function block(service: readonly string[], cycle: string | undefined): string {
  const parts = [...service];
  if (filled(cycle)) {
    parts.push(cycle);
  }
  return parts.join('\n\n');
}

function headingIndex(lines: readonly string[], heading: string): number {
  return lines.findIndex(line => line.trim() === heading);
}

function nextHeading(lines: readonly string[], after: number): number {
  for (let index = after + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith('## ')) {
      return index;
    }
  }
  return -1;
}

/** One blank line between the previous paragraph, the block, and the heading. */
function insertBefore(lines: readonly string[], index: number, blockText: string): string[] {
  if (blockText === '' || index < 0) {
    return [...lines];
  }
  let start = index;
  while (start > 0 && lines[start - 1].trim() === '') {
    start -= 1;
  }
  const lead = start === 0 ? [] : [...lines.slice(0, start), ''];
  return [...lead, ...blockText.split('\n'), '', ...lines.slice(index)];
}

function appendBlock(lines: readonly string[], blockText: string): string[] {
  if (blockText === '') {
    return [...lines];
  }
  let end = lines.length;
  while (end > 0 && lines[end - 1] === '') {
    end -= 1;
  }
  return [...lines.slice(0, end), '', ...blockText.split('\n'), ...lines.slice(end)];
}

function place(file: string, heading: string, before: string, after: string): string | undefined {
  const lines = file.split('\n');
  const index = headingIndex(lines, heading);
  if (index < 0) {
    return undefined;
  }
  const next = nextHeading(lines, index);
  const withAfter =
    after === '' ? lines : next < 0 ? appendBlock(lines, after) : insertBefore(lines, next, after);
  if (before === '') {
    return withAfter.join('\n');
  }
  return insertBefore(withAfter, index, before).join('\n');
}

/**
 * The step file with this action's service paragraphs and then its cycle paragraph.
 * `before` and `after` are the only points that enter. Another action does not.
 */
export function stepPrompt(
  file: string,
  action: string,
  serviceHooks: unknown,
  sddHooks: unknown,
): string {
  const cycle = cycleHooks(sddHooks)[action];
  const before = block(serviceParagraphs(serviceHooks, action, 'before'), cycle?.before);
  const after = block(serviceParagraphs(serviceHooks, action, 'after'), cycle?.after);
  if (before === '' && after === '') {
    return file;
  }
  const steps = headingIndex(file.split('\n'), '## Steps');
  const placed = place(file, steps >= 0 ? '## Steps' : `## ${action}`, before, after);
  return placed ?? file;
}
