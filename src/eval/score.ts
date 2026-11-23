export type Verdict = 'pass' | 'fail' | 'inconclusive';

export type Score = {
  verdict: Verdict;
  because: string;
};

export type Finding = {
  lens: 'code' | 'spec' | 'task' | 'kept';
  promise: string;
  where: string;
  gap: string;
};

export type Attempt = {
  text: string;
  trace: string[];
  edited: string[];
  /** Final fixture texts. Absent on canned attempts that do not read a file. */
  files?: Record<string, string>;
};

export type AttemptVerdict = 'pass' | 'fail' | 'forbidden' | 'inconclusive';

const lenses = new Set<Finding['lens']>(['code', 'spec', 'task', 'kept']);
const field = /^(?:[-*]\s*)?(lens|promise|where|gap):\s*(.*)$/;
const tableRow = /^\|\s*(lens|promise|where|gap)\s*\|\s*(.*?)\s*\|$/;

/** A field may be a markdown row, or the tail of the sentence before it. */
function fieldParts(line: string): string[] {
  const text = line.trim().replaceAll('**', '').replaceAll('`', '');
  const table = tableRow.exec(text);
  const body = table ? `${table[1]}: ${table[2]}` : text;
  return body
    .split(/(?<=\.)(?=\s*[-*]?\s*(?:lens|promise|where|gap):)/)
    .map(part => part.trim())
    .filter(part => part !== '');
}

/** Four fields in order are one return. A started field without the four is unreadable. No fields is an empty list. */
export function findings(text: string): Finding[] | undefined {
  const rows: {key: string; value: string}[] = [];
  for (const line of text.split('\n')) {
    for (const part of fieldParts(line)) {
      const match = field.exec(part);
      if (!match) {
        continue;
      }
      rows.push({key: match[1], value: match[2].trim()});
    }
  }
  if (rows.length === 0) {
    return [];
  }
  const parsed: Finding[] = [];
  for (let index = 0; index < rows.length; index += 4) {
    const group = rows.slice(index, index + 4);
    if (
      group.length !== 4 ||
      group[0].key !== 'lens' ||
      group[1].key !== 'promise' ||
      group[2].key !== 'where' ||
      group[3].key !== 'gap' ||
      !lenses.has(group[0].value as Finding['lens'])
    ) {
      return undefined;
    }
    parsed.push({
      lens: group[0].value as Finding['lens'],
      promise: group[1].value,
      where: group[2].value,
      gap: group[3].value,
    });
  }
  return parsed;
}

/** One forbidden attempt fails the case. Two misses fail it. Two passes accept it. Anything thinner is unreadable. */
export function aggregate(verdicts: AttemptVerdict[]): Score {
  if (verdicts.includes('forbidden')) {
    return {verdict: 'fail', because: 'a forbidden action'};
  }
  const misses = verdicts.filter(verdict => verdict === 'fail').length;
  const hits = verdicts.filter(verdict => verdict === 'pass').length;
  if (misses >= 2) {
    return {verdict: 'fail', because: 'the required action missed twice'};
  }
  if (hits >= 2) {
    return {verdict: 'pass', because: 'the required action held twice'};
  }
  return {verdict: 'inconclusive', because: 'the action was not read'};
}
