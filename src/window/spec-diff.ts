export type SpecBadge = 'new' | 'changed' | 'removed';

export type SpecAnchor = {path: string; line: number; side: 'right' | 'left'};

export type SpecRow = {
  kind: 'add' | 'del' | 'ctx';
  text: string;
  left?: number;
  right?: number;
  bits?: {text: string; changed: boolean}[];
  anchor?: SpecAnchor;
};

export type SpecGap = {kind: 'gap'; count: number; hidden: SpecRow[]};

export type SpecEntry = SpecRow | SpecGap;

const CONTEXT = 3;

type Marked = {text: string; anchor?: SpecAnchor};

type SourceLine = {text: string; line: number};

type SectionName = 'ADDED' | 'MODIFIED' | 'REMOVED' | 'RENAMED';

type Step =
  | {op: 'ctx'; leftIndex: number; rightIndex: number}
  | {op: 'del'; leftIndex: number}
  | {op: 'add'; rightIndex: number};

export function specDiff(
  baseline: string,
  delta: string,
  path: string,
): {badge?: SpecBadge; rows: SpecEntry[]} {
  const left = splitLines(baseline).map(text => ({text}));
  const right = applyDelta(left, delta, path);
  const rows = fold(assignBits(lineRows(left, right)));
  const badge = chooseBadge(
    left.length === 0,
    right.length === 0,
    normalize(baseline) === joinMarked(right),
  );
  if (!badge) return {rows};
  return {badge, rows};
}

export function unchangedLabel(count: number): string {
  return `${count} ${lineWord(count)} без изменений`;
}

function applyDelta(baseline: readonly Marked[], delta: string, path: string): Marked[] {
  const doc = baseline.map(line => ({text: line.text}));
  const parts = sectionLines(delta);
  applyRenames(doc, parts.RENAMED, path);
  applyRemovals(doc, parts.REMOVED);
  applyModifies(doc, parts.MODIFIED, path);
  applyAdditions(doc, parts.ADDED, path);
  return doc;
}

function sectionLines(delta: string): Record<SectionName, SourceLine[]> {
  const found: Record<SectionName, SourceLine[]> = {
    ADDED: [],
    MODIFIED: [],
    REMOVED: [],
    RENAMED: [],
  };
  let current: SectionName | null = null;
  const lines = splitLines(delta);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === undefined) continue;
    if (line.startsWith('## ')) {
      current = sectionName(line);
      continue;
    }
    if (!current) continue;
    found[current].push({text: line, line: index + 1});
  }
  return found;
}

function sectionName(line: string): SectionName | null {
  if (line === '## ADDED Requirements') return 'ADDED';
  if (line === '## MODIFIED Requirements') return 'MODIFIED';
  if (line === '## REMOVED Requirements') return 'REMOVED';
  if (line === '## RENAMED Requirements') return 'RENAMED';
  return null;
}

function applyRenames(doc: Marked[], lines: readonly SourceLine[], path: string): void {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) continue;
    const from = renameName(line.text, 'FROM');
    if (from === null) continue;
    const next = lines[index + 1];
    if (!next) continue;
    const to = renameName(next.text, 'TO');
    if (to === null) continue;
    index += 1;
    const found = findRequirement(doc, from);
    if (!found) continue;
    doc[found.start] = {
      text: `### Requirement: ${to}`,
      anchor: {path, line: next.line, side: 'right'},
    };
  }
}

function applyRemovals(doc: Marked[], lines: readonly SourceLine[]): void {
  for (const name of removedNames(lines)) {
    const found = findRequirement(doc, name);
    if (!found) continue;
    doc.splice(found.start, found.end - found.start);
  }
}

function applyModifies(doc: Marked[], lines: readonly SourceLine[], path: string): void {
  for (const block of requirementBlocks(lines)) {
    const header = block[0];
    if (!header) continue;
    const name = requirementName(header.text);
    if (name === null) continue;
    const next = copyBlock(block, path);
    const found = findRequirement(doc, bareName(name));
    if (!found) {
      insertBlock(doc, next);
      continue;
    }
    doc.splice(found.start, found.end - found.start, ...next);
  }
}

function applyAdditions(doc: Marked[], lines: readonly SourceLine[], path: string): void {
  for (const block of requirementBlocks(lines)) {
    insertBlock(doc, copyBlock(block, path));
  }
}

function insertBlock(doc: Marked[], block: readonly Marked[]): void {
  doc.splice(insertionIndex(doc), 0, ...block);
}

function insertionIndex(doc: readonly Marked[]): number {
  const start = doc.findIndex(line => line.text === '## Requirements');
  if (start < 0) return doc.length;
  for (let index = start + 1; index < doc.length; index += 1) {
    const line = doc[index];
    if (line?.text.startsWith('## ')) return index;
  }
  return doc.length;
}

function copyBlock(block: readonly SourceLine[], path: string): Marked[] {
  return block.map(line => ({
    text: line.text,
    anchor: {path, line: line.line, side: 'right'},
  }));
}

function requirementBlocks(lines: readonly SourceLine[]): SourceLine[][] {
  const found: SourceLine[][] = [];
  let current: SourceLine[] | null = null;
  for (const line of lines) {
    if (line.text.startsWith('## ')) {
      if (current) found.push(current);
      current = null;
      continue;
    }
    if (requirementName(line.text) !== null) {
      if (current) found.push(current);
      current = [line];
      continue;
    }
    if (current) current.push(line);
  }
  if (current) found.push(current);
  return found;
}

function findRequirement(
  doc: readonly Marked[],
  name: string,
): {start: number; end: number} | null {
  for (let start = 0; start < doc.length; start += 1) {
    const line = doc[start];
    if (!line) continue;
    const found = requirementName(line.text);
    if (found === null || bareName(found) !== name) continue;
    let end = start + 1;
    while (end < doc.length) {
      const next = doc[end];
      if (!next) break;
      if (requirementName(next.text) !== null || next.text.startsWith('## ')) break;
      end += 1;
    }
    return {start, end};
  }
  return null;
}

function removedNames(lines: readonly SourceLine[]): string[] {
  const names: string[] = [];
  for (const line of lines) {
    const header = requirementName(line.text);
    if (header !== null) {
      const name = bareName(header);
      if (name !== '') names.push(name);
      continue;
    }
    if (!line.text.startsWith('- ')) continue;
    const name = bareName(line.text.slice(2).trim());
    if (name !== '') names.push(name);
  }
  return names;
}

function renameName(line: string, label: 'FROM' | 'TO'): string | null {
  const prefix = `- ${label}:`;
  if (!line.startsWith(prefix)) return null;
  let rest = line.slice(prefix.length).trim();
  if (rest.startsWith('`') && rest.endsWith('`')) {
    rest = rest.slice(1, -1).trim();
  }
  const name = requirementName(rest);
  if (name === null) return null;
  const bare = bareName(name);
  if (bare === '') return null;
  return bare;
}

function requirementName(line: string): string | null {
  const marker = '### Requirement:';
  if (!line.startsWith(marker)) return null;
  return line.slice(marker.length).trim();
}

function bareName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('`') && trimmed.endsWith('`')) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function lineRows(left: readonly Marked[], right: readonly Marked[]): SpecRow[] {
  const steps = diffSteps(left, right, (leftLine, rightLine) => leftLine.text === rightLine.text);
  const rows: SpecRow[] = [];
  for (const step of steps) {
    if (step.op === 'del') {
      const line = left[step.leftIndex];
      if (!line) continue;
      rows.push({kind: 'del', text: line.text, left: step.leftIndex + 1});
      continue;
    }
    if (step.op === 'add') {
      const line = right[step.rightIndex];
      if (!line) continue;
      rows.push(anchored('add', line, undefined, step.rightIndex + 1));
      continue;
    }
    const line = right[step.rightIndex];
    if (!line) continue;
    rows.push(anchored('ctx', line, step.leftIndex + 1, step.rightIndex + 1));
  }
  return rows;
}

function anchored(
  kind: 'add' | 'ctx',
  line: Marked,
  left: number | undefined,
  right: number,
): SpecRow {
  const row: SpecRow = {kind, text: line.text, right};
  if (left !== undefined) row.left = left;
  if (line.anchor) row.anchor = line.anchor;
  return row;
}

function assignBits(rows: SpecRow[]): SpecRow[] {
  let index = 0;
  while (index < rows.length) {
    if (rows[index]?.kind !== 'del') {
      index += 1;
      continue;
    }
    let delEnd = index;
    while (delEnd < rows.length && rows[delEnd]?.kind === 'del') delEnd += 1;
    let addEnd = delEnd;
    while (addEnd < rows.length && rows[addEnd]?.kind === 'add') addEnd += 1;
    const pairs = Math.min(delEnd - index, addEnd - delEnd);
    for (let pair = 0; pair < pairs; pair += 1) {
      const red = rows[index + pair];
      const green = rows[delEnd + pair];
      if (!red || !green) continue;
      const bits = wordBits(red.text, green.text);
      red.bits = bits.left;
      green.bits = bits.right;
    }
    index = addEnd;
  }
  return rows;
}

function wordBits(
  left: string,
  right: string,
): {left: {text: string; changed: boolean}[]; right: {text: string; changed: boolean}[]} {
  const leftTokens = tokens(left);
  const rightTokens = tokens(right);
  const steps = diffSteps(
    leftTokens,
    rightTokens,
    (leftToken, rightToken) => leftToken === rightToken,
  );
  const leftBits: {text: string; changed: boolean}[] = [];
  const rightBits: {text: string; changed: boolean}[] = [];
  for (const step of steps) {
    if (step.op === 'ctx') {
      const token = leftTokens[step.leftIndex];
      if (token === undefined) continue;
      leftBits.push({text: token, changed: false});
      rightBits.push({text: token, changed: false});
      continue;
    }
    if (step.op === 'del') {
      const token = leftTokens[step.leftIndex];
      if (token === undefined) continue;
      leftBits.push({text: token, changed: true});
      continue;
    }
    const token = rightTokens[step.rightIndex];
    if (token === undefined) continue;
    rightBits.push({text: token, changed: true});
  }
  return {left: leftBits, right: rightBits};
}

function tokens(text: string): string[] {
  return text.split(/(\s+)/).filter(part => part !== '');
}

function diffSteps<T>(
  left: readonly T[],
  right: readonly T[],
  same: (leftItem: T, rightItem: T) => boolean,
): Step[] {
  const width = right.length + 1;
  const score = new Array<number>((left.length + 1) * width).fill(0);
  const at = (row: number, column: number) => row * width + column;
  for (let row = left.length - 1; row >= 0; row -= 1) {
    for (let column = right.length - 1; column >= 0; column -= 1) {
      const leftItem = left[row];
      const rightItem = right[column];
      if (leftItem !== undefined && rightItem !== undefined && same(leftItem, rightItem)) {
        score[at(row, column)] = (score[at(row + 1, column + 1)] ?? 0) + 1;
      } else {
        score[at(row, column)] = Math.max(
          score[at(row + 1, column)] ?? 0,
          score[at(row, column + 1)] ?? 0,
        );
      }
    }
  }
  const steps: Step[] = [];
  let row = 0;
  let column = 0;
  while (row < left.length && column < right.length) {
    const leftItem = left[row];
    const rightItem = right[column];
    if (leftItem !== undefined && rightItem !== undefined && same(leftItem, rightItem)) {
      steps.push({op: 'ctx', leftIndex: row, rightIndex: column});
      row += 1;
      column += 1;
      continue;
    }
    if ((score[at(row + 1, column)] ?? 0) >= (score[at(row, column + 1)] ?? 0)) {
      steps.push({op: 'del', leftIndex: row});
      row += 1;
      continue;
    }
    steps.push({op: 'add', rightIndex: column});
    column += 1;
  }
  while (row < left.length) {
    steps.push({op: 'del', leftIndex: row});
    row += 1;
  }
  while (column < right.length) {
    steps.push({op: 'add', rightIndex: column});
    column += 1;
  }
  return steps;
}

function fold(rows: readonly SpecRow[]): SpecEntry[] {
  const changed: number[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    if (rows[index]?.kind !== 'ctx') changed.push(index);
  }
  if (changed.length === 0) return [...rows];
  const shown = new Array<boolean>(rows.length).fill(false);
  for (const index of changed) {
    const start = Math.max(0, index - CONTEXT);
    const end = Math.min(rows.length, index + CONTEXT + 1);
    for (let cursor = start; cursor < end; cursor += 1) shown[cursor] = true;
  }
  const entries: SpecEntry[] = [];
  let index = 0;
  while (index < rows.length) {
    if (shown[index]) {
      const row = rows[index];
      if (row) entries.push(row);
      index += 1;
      continue;
    }
    const hidden: SpecRow[] = [];
    while (index < rows.length && !shown[index]) {
      const row = rows[index];
      if (row) hidden.push(row);
      index += 1;
    }
    if (hidden.length === 0) continue;
    entries.push({kind: 'gap', count: hidden.length, hidden});
  }
  return entries;
}

function chooseBadge(
  baselineEmpty: boolean,
  resultEmpty: boolean,
  same: boolean,
): SpecBadge | undefined {
  if (baselineEmpty && resultEmpty) return undefined;
  if (baselineEmpty) return 'new';
  if (resultEmpty) return 'removed';
  if (same) return undefined;
  return 'changed';
}

function lineWord(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'строка';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'строки';
  return 'строк';
}

function normalize(text: string): string {
  if (text === '') return '';
  if (text.endsWith('\n')) return text;
  return `${text}\n`;
}

function splitLines(text: string): string[] {
  const normalized = normalize(text);
  if (normalized === '') return [];
  const parts = normalized.split('\n');
  parts.pop();
  return parts;
}

function joinMarked(lines: readonly Marked[]): string {
  if (lines.length === 0) return '';
  return `${lines.map(line => line.text).join('\n')}\n`;
}
