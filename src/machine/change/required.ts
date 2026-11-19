/** The fold of a baseline and its delta. The vitest reporter is not this file. */

export type ScenarioTriple = {
  spec: string;
  requirement: string;
  scenario: string;
};

const REQUIREMENT = '### Requirement: ';
const SCENARIO = '#### Scenario: ';

function tripleKey(triple: ScenarioTriple): string {
  return `${triple.spec}\0${triple.requirement}\0${triple.scenario}`;
}

/** Scenarios under Requirements, ADDED, and MODIFIED. REMOVED is skipped. */
export function scenariosIn(markdown: string, spec: string): ScenarioTriple[] {
  let keep = false;
  let requirement: string | null = null;
  const found: ScenarioTriple[] = [];
  for (const line of markdown.split('\n')) {
    if (line.startsWith('## ')) {
      const heading = line.slice(3).trim();
      keep =
        heading === 'Requirements' ||
        heading === 'ADDED Requirements' ||
        heading === 'MODIFIED Requirements';
      requirement = null;
      continue;
    }
    if (line.startsWith(REQUIREMENT)) {
      requirement = line.slice(REQUIREMENT.length).trim();
      continue;
    }
    if (keep && requirement && line.startsWith(SCENARIO)) {
      found.push({spec, requirement, scenario: line.slice(SCENARIO.length).trim()});
    }
  }
  return found;
}

function sectionBody(markdown: string, heading: string): string[] | undefined {
  const lines = markdown.split('\n');
  const start = lines.findIndex(line => line === heading);
  if (start < 0) {
    return undefined;
  }
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('## ')) {
      break;
    }
    body.push(line);
  }
  return body;
}

function renamesIn(markdown: string): Array<[string, string]> {
  const body = sectionBody(markdown, '## RENAMED Requirements');
  if (!body) {
    return [];
  }
  const pairs: Array<[string, string]> = [];
  let from: string | undefined;
  for (const line of body) {
    const fromMatch = line.match(/^-\s+FROM:\s+`### Requirement: ([^`]+)`\s*$/);
    if (fromMatch?.[1]) {
      from = fromMatch[1];
      continue;
    }
    const toMatch = line.match(/^-\s+TO:\s+`### Requirement: ([^`]+)`\s*$/);
    if (toMatch?.[1] && from !== undefined) {
      pairs.push([from, toMatch[1]]);
      from = undefined;
    }
  }
  return pairs;
}

function removedNames(markdown: string): string[] {
  const body = sectionBody(markdown, '## REMOVED Requirements');
  if (!body) {
    return [];
  }
  return body.flatMap(line => {
    const heading = line.match(/^### Requirement: (.+)$/);
    return heading?.[1] ? [heading[1].trim()] : [];
  });
}

/** Stable scenarios, then RENAMED, REMOVED, MODIFIED, and ADDED for one spec. */
export function foldTriples(
  stable: readonly ScenarioTriple[],
  delta: string,
  spec: string,
): ScenarioTriple[] {
  let next = stable.map(triple => ({...triple}));
  for (const [from, to] of renamesIn(delta)) {
    next = next.map(triple =>
      triple.spec === spec && triple.requirement === from ? {...triple, requirement: to} : triple,
    );
  }
  const removed = new Set(removedNames(delta));
  if (removed.size > 0) {
    next = next.filter(triple => !(triple.spec === spec && removed.has(triple.requirement)));
  }
  const modified = scenariosUnder(delta, '## MODIFIED Requirements', spec);
  const replaced = new Set(modified.map(triple => triple.requirement));
  if (replaced.size > 0) {
    next = next.filter(triple => !(triple.spec === spec && replaced.has(triple.requirement)));
    next.push(...modified);
  }
  next.push(...scenariosUnder(delta, '## ADDED Requirements', spec));
  return next;
}

function scenariosUnder(markdown: string, heading: string, spec: string): ScenarioTriple[] {
  const body = sectionBody(markdown, heading);
  if (!body) {
    return [];
  }
  return scenariosIn([heading, ...body].join('\n'), spec);
}

/** Triples the delta added or replaced. A kept baseline scenario is not among them. */
export function deltaOwnedTriples(delta: string, spec: string): ScenarioTriple[] {
  return [
    ...scenariosUnder(delta, '## ADDED Requirements', spec),
    ...scenariosUnder(delta, '## MODIFIED Requirements', spec),
  ];
}

/** The boundary names the spec-coverage trace, not some other format. */
export function tracesSpecCoverage(design: string): boolean {
  return design.split('\n').some(line => {
    const trimmed = line.trim();
    return trimmed.toLowerCase().startsWith('trace:') && trimmed.includes('@ojson/spec-coverage');
  });
}

/** Glob paths on the `test path:` line. Empty when the boundary names none. */
export function testPathGlobs(design: string): string[] {
  const line = design.split('\n').find(item => item.trim().toLowerCase().startsWith('test path:'));
  if (!line) {
    return [];
  }
  return [...line.matchAll(/`([^`]+)`/g)].map(match => match[1] ?? '').filter(item => item !== '');
}

function globToRegExp(glob: string): RegExp {
  let body = '';
  let index = 0;
  while (index < glob.length) {
    if (glob.startsWith('**/', index)) {
      body += '(?:.*/)?';
      index += 3;
      continue;
    }
    if (glob.startsWith('**', index)) {
      body += '.*';
      index += 2;
      continue;
    }
    if (glob[index] === '*') {
      body += '[^/]*';
      index += 1;
      continue;
    }
    const char = glob[index] ?? '';
    body += '.+^${}()|[]\\'.includes(char) ? `\\${char}` : char;
    index += 1;
  }
  return new RegExp(`^${body}$`);
}

export function matchesTestPath(rel: string, globs: readonly string[]): boolean {
  const slash = rel.split('\\').join('/');
  return globs.some(glob => globToRegExp(glob).test(slash));
}

function skipString(source: string, start: number): number {
  const quote = source[start];
  let index = start + 1;
  while (index < source.length) {
    if (source[index] === '\\') {
      index += 2;
      continue;
    }
    if (source[index] === quote) {
      return index + 1;
    }
    index += 1;
  }
  return source.length;
}

type CallKind = 'spec' | 'requirement' | 'scenario';

/** Nested spec/requirement/scenario calls. `scenario.skip` is not a record. */
export function recordedTriples(source: string): ScenarioTriple[] {
  const found: ScenarioTriple[] = [];
  const stack: {kind: CallKind; name: string; depth: number}[] = [];
  let depth = 0;
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (char === '/' && source[index + 1] === '/') {
      const end = source.indexOf('\n', index);
      index = end < 0 ? source.length : end + 1;
      continue;
    }
    if (char === '/' && source[index + 1] === '*') {
      const end = source.indexOf('*/', index + 2);
      index = end < 0 ? source.length : end + 2;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      index = skipString(source, index);
      continue;
    }
    if (char === '{') {
      depth += 1;
      index += 1;
      continue;
    }
    if (char === '}') {
      depth -= 1;
      while (stack.length > 0 && stack[stack.length - 1]!.depth > depth) {
        stack.pop();
      }
      index += 1;
      continue;
    }
    const call = readCall(source, index);
    if (!call) {
      index += 1;
      continue;
    }
    if (!call.skip) {
      if (call.kind === 'spec' || call.kind === 'requirement') {
        stack.push({kind: call.kind, name: call.name, depth});
      }
      if (call.kind === 'scenario') {
        const requirement = [...stack].reverse().find(frame => frame.kind === 'requirement');
        const spec = [...stack].reverse().find(frame => frame.kind === 'spec');
        if (spec && requirement) {
          found.push({spec: spec.name, requirement: requirement.name, scenario: call.name});
        }
      }
    }
    index = call.end;
  }
  return found;
}

function readCall(
  source: string,
  index: number,
): {kind: CallKind; name: string; skip: boolean; end: number} | null {
  const kinds: CallKind[] = ['requirement', 'scenario', 'spec'];
  for (const kind of kinds) {
    if (!source.startsWith(kind, index)) {
      continue;
    }
    const before = index === 0 ? '' : source[index - 1];
    if (before && /[A-Za-z0-9_]/.test(before)) {
      continue;
    }
    let cursor = index + kind.length;
    const skip = source.startsWith('.skip', cursor);
    if (skip) {
      cursor += '.skip'.length;
    }
    const open = source.slice(cursor).match(/^\s*\(\s*(['"`])/);
    if (!open || open.index === undefined) {
      continue;
    }
    const quoteAt = cursor + open.index + open[0].length - 1;
    const end = skipString(source, quoteAt);
    const name = source.slice(quoteAt + 1, end - 1);
    return {kind, name, skip, end};
  }
  return null;
}

export function keptBaseline(
  stable: string,
  delta: string,
  spec: string,
): ScenarioTriple[] {
  const folded = foldTriples(scenariosIn(stable, spec), delta, spec);
  const owned = new Set(deltaOwnedTriples(delta, spec).map(tripleKey));
  return folded.filter(triple => !owned.has(tripleKey(triple)));
}

/** Kept triples with no matching recorded call. Another trace format yields nothing. */
export function untracedOf(
  design: string,
  kept: readonly ScenarioTriple[],
  sources: readonly {path: string; text: string}[],
): ScenarioTriple[] {
  if (!tracesSpecCoverage(design)) {
    return [];
  }
  const globs = testPathGlobs(design);
  const recorded = new Set(
    sources
      .filter(source => matchesTestPath(source.path, globs))
      .flatMap(source => recordedTriples(source.text))
      .map(tripleKey),
  );
  return kept.filter(triple => !recorded.has(tripleKey(triple)));
}
