import type {GateStation} from './types.ts';

import {changeDir} from '../machine/naming.ts';

import {changeFiles, changeRel, listedSpecs} from './change-files.ts';

export const SPINE_LAYERS = [
  'Change',
  'Plan',
  'Specify',
  'Design',
  'Tasks',
  'Code',
  'Accept',
] as const;

export type SpineLayer = (typeof SPINE_LAYERS)[number];

export type SpineLine = {
  layer: Exclude<SpineLayer, 'Accept'>;
  /** The focus line as written, so a Code place can keep its link. */
  raw: string;
  text: string;
};

export type SpineScenario = {name: string; when: string; then: string};

export type SpineRequirement = {
  kind: string;
  title: string;
  prose: string;
  added: string[];
  scenarios: SpineScenario[];
};

export type SpineCapability = {id: string; requirements: SpineRequirement[]};

export type SpineTask = {
  id: string;
  done: boolean;
  scenarios: {name: string; capability: string}[];
};

export type SpineQuestion = {text: string; open: boolean};

export type SpineSection = {heading: string; lines: string[]};

export type Spine = {
  open: SpineLayer;
  station?: string;
  lines: SpineLine[];
  rest: string[];
  proposal: {
    present: boolean;
    /** First line of Outcome. The closed Plan row shows it; the open row hides it. */
    excerpt: string;
    sections: SpineSection[];
    questions: SpineQuestion[];
  };
  capabilities: SpineCapability[];
  design: {
    present: boolean;
    boundary: string;
    approach: string;
    rejected: string[];
    decisions: string;
  };
  tasks: SpineTask[];
  checks?: string;
  diff: boolean;
  pull: boolean;
  /** The review gate this plaque can still close. */
  reviewGate?: ReviewGate;
  readPath: string;
  accept: string;
};

const LAYER_NAMES = ['Change', 'Plan', 'Specify', 'Design', 'Tasks', 'Code'] as const;

type DocLayer = (typeof LAYER_NAMES)[number];

function isDocLayer(value: string): value is DocLayer {
  return (LAYER_NAMES as readonly string[]).includes(value);
}

function section(text: string, heading: string): string {
  const match = new RegExp(`^## ${heading}\\s*$`, 'm').exec(text);
  if (!match) {
    return '';
  }
  const rest = text.slice(match.index + match[0].length);
  const next = rest.search(/^## /m);
  return (next === -1 ? rest : rest.slice(0, next)).trim();
}

function paragraph(text: string): string {
  const trimmed = text.trim();
  if (trimmed === '') {
    return '';
  }
  const end = trimmed.search(/\n\s*\n/);
  const chunk = end === -1 ? trimmed : trimmed.slice(0, end);
  return chunk.replace(/\s+/g, ' ').trim();
}

function oneLine(text: string): string {
  const found = text
    .split('\n')
    .map(line => line.trim())
    .find(line => line !== '');
  return found ? found.replace(/\s+/g, ' ') : '';
}

function sectionsOf(text: string): SpineSection[] {
  const out: SpineSection[] = [];
  for (const part of text.split(/^## /m).slice(1)) {
    const breakAt = part.indexOf('\n');
    const heading = (breakAt === -1 ? part : part.slice(0, breakAt)).trim();
    const raw = breakAt === -1 ? '' : part.slice(breakAt + 1).replace(/\n+$/, '');
    const lines = raw.split('\n');
    let start = 0;
    while (start < lines.length && lines[start]?.trim() === '') {
      start += 1;
    }
    out.push({heading, lines: lines.slice(start)});
  }
  return out;
}

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=\.)\s+/)
    .map(item => item.trim())
    .filter(item => item.endsWith('.') && item.length > 12);
}

/** Layer lines in a focus body. A line that names no layer stays in `rest`. */
export function linesFromFocus(body: string): {lines: SpineLine[]; rest: string[]} {
  const lines: SpineLine[] = [];
  const rest: string[] = [];
  for (const raw of body.split('\n')) {
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed === 'sdd:focus') {
      continue;
    }
    const token = trimmed.split(/\s+/)[0]?.replace(/:$/, '') ?? '';
    if (!isDocLayer(token)) {
      rest.push(raw.trimEnd());
      continue;
    }
    lines.push({
      layer: token,
      raw: trimmed,
      text: trimmed.slice(token.length).replace(/^:?\s*/, ''),
    });
  }
  return {lines, rest};
}

/** Layer lines between `sdd:begin` and `sdd:end` in the issue body. */
export function linesFromIssue(body: string): SpineLine[] {
  const begin = body.indexOf('sdd:begin');
  const end = body.indexOf('sdd:end');
  if (begin < 0 || end <= begin) {
    return [];
  }
  const from = body.lastIndexOf('\n', begin) + 1;
  const slice = body.slice(from, end);
  return linesFromFocus(slice).lines;
}

export type ReviewGate = 'proposed' | 'specified' | 'designed';

const REVIEW_GATES = [
  {phase: 'proposing', layer: 'Plan', gate: 'proposed'},
  {phase: 'specifying', layer: 'Specify', gate: 'specified'},
  {phase: 'designing', layer: 'Design', gate: 'designed'},
] as const satisfies readonly {phase: string; layer: SpineLayer; gate: ReviewGate}[];

/** The review label a writing phase can still close. A closed phase has none. */
export function reviewGateForPhase(phase: string | null | undefined): ReviewGate | undefined {
  return REVIEW_GATES.find(row => row.phase === phase)?.gate;
}

/** The review label of a spine layer. Plan, Specify, and Design have one. */
export function reviewGateForLayer(layer: SpineLayer): ReviewGate | undefined {
  return REVIEW_GATES.find(row => row.layer === layer)?.gate;
}

export function layerForStation(station: string | undefined): SpineLayer {
  switch (station) {
    case 'proposing':
    case 'proposed':
      return 'Plan';
    case 'specifying':
    case 'specified':
      return 'Specify';
    case 'designing':
    case 'designed':
      return 'Design';
    case 'tasking':
      return 'Tasks';
    case 'implementing':
    case 'verifying':
      return 'Code';
    case 'accepting':
    case 'accepted':
      return 'Accept';
    default:
      return 'Change';
  }
}

function checksLine(checks: string | undefined): string | undefined {
  if (checks === 'green') {
    return 'обязательные проверки зелёные';
  }
  if (checks === 'red') {
    return 'проверки красные';
  }
  if (checks === 'pending') {
    return 'проверки идут';
  }
  return undefined;
}

function questionsOf(proposal: string): SpineQuestion[] {
  const out: SpineQuestion[] = [];
  for (const line of section(proposal, 'Open questions').split('\n')) {
    const open = /^- \[ \] (.+)$/.exec(line.trim());
    const shut = /^- \[x\] (.+)$/i.exec(line.trim());
    if (open?.[1]) {
      out.push({text: open[1], open: true});
    } else if (shut?.[1]) {
      out.push({text: shut[1], open: false});
    }
  }
  return out;
}

function markerValue(chunk: string, marker: 'WHEN' | 'THEN'): string {
  const found: string[] = [];
  for (const match of chunk.matchAll(new RegExp(`\\*\\*${marker}\\*\\*\\s*(.*)`, 'g'))) {
    const value = match[1]?.trim() ?? '';
    if (value !== '') {
      found.push(value);
    }
  }
  return found.join('\n');
}

function requirementsOf(text: string, baseline: string): SpineRequirement[] {
  const out: SpineRequirement[] = [];
  for (const part of text.split(/^## /m).slice(1)) {
    const kind = part.startsWith('ADDED')
      ? 'ADDED'
      : part.startsWith('MODIFIED')
        ? 'MODIFIED'
        : part.startsWith('REMOVED')
          ? 'REMOVED'
          : '';
    if (kind === '') {
      continue;
    }
    for (const req of part.split(/^### Requirement: /m).slice(1)) {
      const title = req.split('\n')[0]?.trim() ?? '';
      const chunks = req.split(/^#### Scenario: /m);
      const body = chunks[0]?.split('\n').slice(1).join('\n').trim() ?? '';
      const known = baseline.replace(/\s+/g, ' ');
      const added =
        kind === 'MODIFIED' && known.trim() !== ''
          ? sentences(body).filter(item => !known.includes(item))
          : [];
      const scenarios: SpineScenario[] = [];
      for (const chunk of chunks.slice(1)) {
        scenarios.push({
          name: chunk.split('\n')[0]?.trim() ?? '',
          when: markerValue(chunk, 'WHEN'),
          then: markerValue(chunk, 'THEN'),
        });
      }
      out.push({kind, title, prose: body.replace(/\s+/g, ' ').trim(), added, scenarios});
    }
  }
  return out;
}

function tasksOf(text: string, owner: Map<string, string>): SpineTask[] {
  const out: SpineTask[] = [];
  for (const line of text.split('\n')) {
    const match = /^- \[([ x])\] `([^`]+)`/.exec(line.trim());
    if (!match?.[2]) {
      continue;
    }
    const names = [...line.matchAll(/«([^»]+)»/g)]
      .map(item => item[1] ?? '')
      .filter(name => name !== '');
    out.push({
      id: match[2],
      done: match[1] === 'x',
      scenarios: names.map(name => ({name, capability: owner.get(name) ?? ''})),
    });
  }
  return out;
}

function mergeLines(issue: SpineLine[], focus: SpineLine[]): SpineLine[] {
  const replaced = new Set(focus.map(line => line.layer));
  return [...issue.filter(line => !replaced.has(line.layer)), ...focus];
}

/** The spine of the open ticket: mirror lines, and the change files on the issue branch. */
export function buildSpine(input: {
  key: string;
  checkout?: string;
  station?: string;
  focusBody?: string;
  issueBody?: string;
  checks?: 'green' | 'red' | 'pending' | 'none';
  diff?: boolean;
  pull?: boolean;
  reviewGate?: Spine['reviewGate'];
  gateOff?: Partial<Record<GateStation, true>>;
}): Spine {
  const focus = linesFromFocus(input.focusBody ?? '');
  const lines = mergeLines(linesFromIssue(input.issueBody ?? ''), focus.lines);
  const files = changeFiles(input.checkout, input.key);
  const proposal = files.read(changeRel(input.key, 'proposal.md'));
  const design = files.read(changeRel(input.key, 'design.md'));
  const taskText = files.read(changeRel(input.key, 'tasks.md'));
  const capabilities: SpineCapability[] = [];
  const owner = new Map<string, string>();
  for (const spec of listedSpecs(files, input.key)) {
    const baseline = files.read(`openspec/specs/${spec.id}/spec.md`);
    const requirements = requirementsOf(files.read(spec.rel), baseline);
    for (const requirement of requirements) {
      for (const scenario of requirement.scenarios) {
        if (!owner.has(scenario.name)) {
          owner.set(scenario.name, spec.id);
        }
      }
    }
    capabilities.push({id: spec.id, requirements});
  }
  return {
    open: layerForStation(input.station),
    station: input.station,
    lines,
    rest: focus.rest.filter(line => !line.includes('sdd:begin') && !line.includes('sdd:end')),
    proposal: {
      present: proposal.trim() !== '',
      excerpt: oneLine(section(proposal, 'Outcome')),
      sections: sectionsOf(proposal),
      questions: questionsOf(proposal),
    },
    capabilities,
    design: {
      present: design.trim() !== '',
      boundary: paragraph(section(design, 'Verification boundary')),
      approach: paragraph(section(design, 'Approach')),
      rejected: design
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('Отклонено:')),
      decisions: section(design, 'Open decisions').trim(),
    },
    tasks: tasksOf(taskText, owner),
    checks: checksLine(input.checks),
    diff: input.diff === true,
    pull: input.pull === true,
    ...(input.reviewGate ? {reviewGate: input.reviewGate} : {}),
    readPath: changeDir(input.key),
    accept: input.gateOff?.accepting
      ? 'На приёмке машина мержит сама.'
      : 'На приёмке мерж ждёт человека.',
  };
}
