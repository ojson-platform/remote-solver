import {createHash} from 'node:crypto';

import type {FileSource} from '../machine/port.ts';
import type {SpecBadge, SpecEntry} from './spec-diff.ts';
import type {GateStation} from './types.ts';

import {missingBaselineIds, namedCapabilities, readBranch, type BranchText} from '../machine/change.ts';
import {changeDir} from '../machine/naming.ts';

import {strictChangeFiles} from './change-files.ts';
import {specDiff} from './spec-diff.ts';

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

export type SpineSourceLine = {text: string; line: number};

export type SpineCapability = {id: string; badge?: SpecBadge; rows: SpecEntry[]};

export type SpineTask = {
  id: string;
  done: boolean;
  scenarios: {name: string; capability: string}[];
};

export type SpineQuestion = {text: string; open: boolean};

export type SpineSection = {heading: string; lines: SpineSourceLine[]};

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
  /** Capability ids named under Added and Modified. */
  named: string[];
  /** Modified ids whose baseline spec is absent. */
  missingBaseline: string[];
  design: {
    present: boolean;
    sections: SpineSection[];
    questions: SpineQuestion[];
  };
  tasks: SpineTask[];
  checks?: string;
  diff: boolean;
  pull: boolean;
  /** The review gate this plaque can still close. */
  reviewGate?: ReviewGate;
  readPath: string;
  accept: string;
  /** Revisions of the parts. A comment changes focus and leaves plan. */
  sections: SpinePartRevisions;
};

export type SpinePartRevisions = {
  focus: string;
  plan: string;
  specify: string;
  design: string;
  tasks: string;
};

function partRevision(source: string): string {
  return createHash('sha256').update(source).digest('hex');
}

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

function oneLine(text: string): string {
  const found = text
    .split('\n')
    .map(line => line.trim())
    .find(line => line !== '');
  return found ? found.replace(/\s+/g, ' ') : '';
}

function sectionsOf(text: string): SpineSection[] {
  const source = text.split('\n');
  const out: SpineSection[] = [];
  let heading: string | undefined;
  let body: SpineSourceLine[] = [];
  const flush = (): void => {
    if (heading === undefined) {
      return;
    }
    let start = 0;
    while (start < body.length && body[start]?.text.trim() === '') {
      start += 1;
    }
    let end = body.length;
    while (end > start && body[end - 1]?.text.trim() === '') {
      end -= 1;
    }
    out.push({heading, lines: body.slice(start, end)});
  };
  for (let index = 0; index < source.length; index += 1) {
    const raw = source[index] ?? '';
    if (raw.startsWith('## ')) {
      flush();
      heading = raw.slice(3).trim();
      body = [];
      continue;
    }
    if (heading === undefined) {
      continue;
    }
    body.push({text: raw, line: index + 1});
  }
  flush();
  return out;
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

function scenarioNames(delta: string): string[] {
  const names: string[] = [];
  let take = false;
  for (const line of delta.split('\n')) {
    if (line.startsWith('## ')) {
      const title = line.slice(3);
      take = title.startsWith('ADDED') || title.startsWith('MODIFIED');
      continue;
    }
    if (!take || !line.startsWith('#### Scenario: ')) {
      continue;
    }
    const name = line.slice('#### Scenario: '.length).trim();
    if (name === '') {
      continue;
    }
    names.push(name);
  }
  return names;
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

function baselineListed(rel: string, baselines: readonly string[]): boolean {
  const match = rel.split('\\').join('/').match(/^openspec\/specs\/(.+)\/spec\.md$/);
  return match !== null && baselines.includes(match[1] ?? '');
}

/** The spine of one ticket from branch bytes already read, plus the ticket fields the row shows. */
export function projectSpine(
  text: BranchText,
  input: {
    key: string;
    station?: string;
    focusBody?: string;
    issueBody?: string;
    checks?: 'green' | 'red' | 'pending' | 'none';
    diff?: boolean;
    pull?: boolean;
    reviewGate?: Spine['reviewGate'];
    gateOff?: Partial<Record<GateStation, true>>;
  },
  previous?: Spine,
): Spine {
  const sections: SpinePartRevisions = {
    focus: partRevision(`${input.focusBody ?? ''}\0${input.issueBody ?? ''}`),
    plan: partRevision(text.proposal),
    specify: partRevision(
      JSON.stringify({proposal: text.proposal, specs: text.specs, baselines: text.baselines}),
    ),
    design: partRevision(text.design),
    tasks: partRevision(JSON.stringify({tasks: text.tasks, deltas: text.specs.map(spec => spec.delta)})),
  };
  const kept = previous?.sections;
  const focus = linesFromFocus(input.focusBody ?? '');
  const lines =
    kept?.focus === sections.focus && previous ? previous.lines : mergeLines(linesFromIssue(input.issueBody ?? ''), focus.lines);
  const rest =
    kept?.focus === sections.focus && previous
      ? previous.rest
      : focus.rest.filter(line => !line.includes('sdd:begin') && !line.includes('sdd:end'));
  const proposalText = text.proposal;
  const proposal =
    kept?.plan === sections.plan && previous
      ? previous.proposal
      : {
          present: proposalText.trim() !== '',
          excerpt: oneLine(section(proposalText, 'Outcome')),
          sections: sectionsOf(proposalText),
          questions: questionsOf(proposalText),
        };
  const designText = text.design;
  const design =
    kept?.design === sections.design && previous
      ? previous.design
      : {
          present: designText.trim() !== '',
          sections: sectionsOf(designText),
          questions: questionsOf(designText),
        };
  let capabilities: SpineCapability[];
  let named: string[];
  let missingBaseline: string[];
  if (kept?.specify === sections.specify && previous) {
    capabilities = previous.capabilities;
    named = previous.named;
    missingBaseline = previous.missingBaseline;
  } else {
    capabilities = [];
    for (const spec of text.specs) {
      capabilities.push({id: spec.id, ...specDiff(spec.baseline, spec.delta, spec.rel)});
    }
    named = namedCapabilities(proposalText);
    missingBaseline = missingBaselineIds(proposalText, rel => baselineListed(rel, text.baselines));
  }
  const owner = new Map<string, string>();
  if (!(kept?.tasks === sections.tasks && previous)) {
    for (const spec of text.specs) {
      for (const name of scenarioNames(spec.delta)) {
        if (!owner.has(name)) {
          owner.set(name, spec.id);
        }
      }
    }
  }
  const tasks = kept?.tasks === sections.tasks && previous ? previous.tasks : tasksOf(text.tasks, owner);
  return {
    open: layerForStation(input.station),
    station: input.station,
    lines,
    rest,
    proposal,
    capabilities,
    named,
    missingBaseline,
    design,
    tasks,
    checks: checksLine(input.checks),
    diff: input.diff === true,
    pull: input.pull === true,
    ...(input.reviewGate ? {reviewGate: input.reviewGate} : {}),
    readPath: changeDir(input.key),
    accept: input.gateOff?.accepting
      ? 'На приёмке машина мержит сама.'
      : 'На приёмке мерж ждёт человека.',
    sections,
  };
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
  /** A tree the store already holds for this checkout and ref. */
  files?: FileSource;
  previous?: Spine;
}): Spine {
  const text = readBranch(input.key, input.files ?? strictChangeFiles(input.checkout, input.key)).text;
  return projectSpine(text, input, input.previous);
}
