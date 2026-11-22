import {chmodSync, copyFileSync, mkdirSync, readdirSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const stub = path.join(root, 'eval/lib/stub.sh');

const classSpec = `### Requirement: A covered line shows the node value

A covered line SHALL show the node value. A line the value does not contain SHALL NOT show the raw source.

#### Scenario: A covered line shows the node value

- **WHEN** the person opens a document where a node covers several lines and the node value does not contain every one of those lines
- **THEN** a covered line shows the node value, and a line the value does not contain does not show the raw source
`;

const specimenSpec = `### Requirement: A covered line shows the node value

A covered line SHALL show the node value.

#### Scenario: A covered line shows the node value

- **WHEN** the person opens a document where the first covered line of the node is alpha and the node value is alpha
- **THEN** the first covered line shows alpha
`;

const greenPaint = `export function paintLine(which: 'first' | 'outside', value: string, raw: string): string {
  void which;
  void raw;
  return value;
}
`;

const holePaint = `export function paintLine(which: 'first' | 'second' | 'outside', value: string, raw: string): string {
  if (which === 'second') {
    return raw;
  }
  return value;
}
`;

const rawPaint = `export function paintLine(which: 'first' | 'second', value: string, raw: string): string {
  void which;
  void value;
  return raw;
}
`;

const classTest = `import assert from 'node:assert/strict';
import {test} from 'vitest';

import {paintLine} from './paint.ts';

test('A covered line shows the node value', () => {
  assert.equal(paintLine('first', 'alpha', 'alpha'), 'alpha');
  assert.equal(paintLine('outside', 'alpha', '> alpha'), 'alpha');
});
`;

const rawTest = `import assert from 'node:assert/strict';
import {test} from 'vitest';

import {paintLine} from './paint.ts';

test('A covered line shows the node value', () => {
  assert.equal(paintLine('first', 'alpha', '- alpha'), 'alpha');
});
`;

function write(file, text) {
  mkdirSync(path.dirname(file), {recursive: true});
  writeFileSync(file, text);
}

function report(options) {
  const threads = options.instruction
    ? [
        {
          thread: 'T1',
          comment: '11',
          file: options.file,
          line: options.line ?? 1,
          marker: options.marker ?? null,
          instruction: options.instruction,
          body: options.body ?? options.instruction,
        },
      ]
    : [];
  const json = {
    threads,
    conversation: {
      last: options.conversation ? {body: options.conversation, robot: false} : null,
      layer: null,
      unanswered: Boolean(options.conversation),
    },
  };
  return `phase: ${options.phase}\npull: 1\nissue: 1\n\n${JSON.stringify(json, null, 2)}\n`;
}

function issue(text) {
  return `# 1\n\n${text}\n\nOut of scope: none.\n\nPull request: 1.\n`;
}

function proposal(text) {
  return `## Outcome\n\n${text}\n\n## Out of scope\n\nnone\n`;
}

function design(boundary) {
  const head = boundary
    ? `## Verification boundary\n\n\`paint\`. Scenarios are observed in \`src/paint.test.ts\`.\n\none-file: \`sdd test src/paint.test.ts\`\nlayer: \`layer\`\n\nfast suite: none\ntypecheck\ntrace: none\ntest path: \`src/paint.test.ts\`\n\n`
    : '';
  return `${head}## Approach\n\nA covered line shows the node value.\n\n## Rejected\n\nnone\n`;
}

function task() {
  return `## Scenario\n\nA covered line shows the node value\n\n## Source\n\n\`src/paint.ts\`\n\`src/paint.test.ts\`\n\n## Proof\n\n- **On each attempt** (while the test is red and after each edit to the test or its sources): \`sdd test src/paint.test.ts\`\n`;
}

function install(dir, mode, names) {
  const bin = path.join(dir, 'bin');
  mkdirSync(bin, {recursive: true});
  copyFileSync(stub, path.join(bin, 'record'));
  chmodSync(path.join(bin, 'record'), 0o755);
  write(path.join(bin, 'mode'), `${mode}\n`);
  for (const name of names) {
    const link = path.join(bin, name);
    try {
      rmSync(link);
    } catch {
      // A fresh fixture has no link yet.
    }
    symlinkSync('record', link);
  }
}

function originals(dir) {
  const keep = [];
  function walk(abs) {
    for (const name of readdirSync(abs, {withFileTypes: true})) {
      const full = path.join(abs, name.name);
      if (name.isDirectory()) {
        if (name.name === 'bin' || name.name === '.git') {
          continue;
        }
        walk(full);
        continue;
      }
      if (!name.isFile()) {
        continue;
      }
      const rel = path.relative(dir, full);
      if (rel === 'src/paint.ts' || rel === 'src/paint.test.ts') {
        continue;
      }
      const dest = path.join(dir, 'bin/orig', rel);
      mkdirSync(path.dirname(dest), {recursive: true});
      copyFileSync(full, dest);
      keep.push(rel);
    }
  }
  walk(dir);
  write(path.join(dir, 'bin/keep.list'), `${keep.sort().join('\n')}\n`);
  copyFileSync(path.join(dir, 'src/paint.ts'), path.join(dir, 'bin/paint.orig'));
}

function commit(dir) {
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: 'eval',
    GIT_AUTHOR_EMAIL: 'eval@example.com',
    GIT_COMMITTER_NAME: 'eval',
    GIT_COMMITTER_EMAIL: 'eval@example.com',
  };
  rmSync(path.join(dir, '.git'), {recursive: true, force: true});
  const git = (...args) => execFileSync('git', args, {cwd: dir, env});
  git('init', '-b', 'master');
  git('commit', '--allow-empty', '-m', 'base');
  git('checkout', '-b', 'sdd/1');
  git('add', '-A');
  git('commit', '-m', 'change');
}

function tree(rel, files, mode, names, withOrig) {
  const dir = path.join(root, rel);
  rmSync(dir, {recursive: true, force: true});
  for (const [name, text] of Object.entries(files)) {
    write(path.join(dir, name), text);
  }
  mkdirSync(path.join(dir, 'skills/sdd-flow'), {recursive: true});
  copyFileSync(path.join(root, 'skills/sdd-flow/CONTEXT.md'), path.join(dir, 'skills/sdd-flow/CONTEXT.md'));
  install(dir, mode, names);
  if (withOrig) {
    originals(dir);
  }
  commit(dir);
}

const change = 'openspec/changes/issue-1';
const owned = 'A covered line shows the node value.';
const middle = 'A list of three lines keeps the middle line.';

tree(
  'eval/fix/example-stays-that-scenario/fixture',
  {
    'issue.md': issue(owned),
    [`${change}/proposal.md`]: proposal(owned),
    [`${change}/design.md`]: design(false),
    [`${change}/specs/paint/spec.md`]: classSpec,
    [`${change}/tasks.md`]: '- [x] paint-line\n',
    [`${change}/tasks/paint-line.md`]: task(),
    'src/paint.ts': holePaint,
    'src/paint.test.ts': classTest,
    'threads.md': report({
      phase: 'implementing',
      file: 'src/paint.ts',
      line: 2,
      marker: 'code',
      instruction: 'вторая покрытая строка того же узла показывает сырой источник. Обещание — covered line shows the node value.',
      body: 'sdd:layer=code → implementing',
    }),
  },
  'fix-example',
  ['sdd', 'thread', 'threads'],
  true,
);

tree(
  'eval/fix/no-scenario-hands-to-spec/fixture',
  {
    'issue.md': issue(`${owned}\n\n${middle}`),
    [`${change}/proposal.md`]: proposal(`${owned}\n\n${middle}`),
    [`${change}/design.md`]: design(false),
    [`${change}/specs/paint/spec.md`]: specimenSpec,
    [`${change}/tasks.md`]: '- [x] paint-line\n',
    [`${change}/tasks/paint-line.md`]: task(),
    'src/paint.ts': greenPaint,
    'src/paint.test.ts': rawTest,
    'threads.md': report({
      phase: 'implementing',
      file: 'src/paint.ts',
      line: 1,
      marker: 'code',
      instruction: 'список из трёх строк теряет среднюю строку. Ни один сценарий этого не называет.',
      body: 'sdd:layer=code → implementing',
    }),
  },
  'fix-always-red',
  ['sdd', 'thread', 'threads'],
  false,
);

tree(
  'eval/fix/unowned-is-out/fixture',
  {
    'issue.md': issue(owned),
    [`${change}/proposal.md`]: proposal(owned),
    [`${change}/design.md`]: design(false),
    [`${change}/specs/paint/spec.md`]: specimenSpec,
    [`${change}/tasks.md`]: '- [x] paint-line\n',
    [`${change}/tasks/paint-line.md`]: task(),
    'src/paint.ts': greenPaint,
    'src/paint.test.ts': rawTest,
    'threads.md': report({
      phase: 'implementing',
      file: 'src/paint.ts',
      line: 1,
      marker: 'code',
      instruction: 'окно логина не принимает пустой пароль',
      body: 'sdd:layer=code → implementing',
    }),
  },
  'fix-always-red',
  ['sdd', 'thread', 'threads'],
  false,
);

function comments(rel, options, extra = {}) {
  tree(
    rel,
    {
      'issue.md': issue(options.outcome),
      [`${change}/proposal.md`]: proposal(options.outcome),
      [`${change}/design.md`]: options.design ?? design(false),
      [`${change}/specs/paint/spec.md`]: classSpec,
      'src/paint.ts': greenPaint,
      'src/paint.test.ts': classTest,
      'inbox.md': report(options),
      ...extra,
    },
    'threads-only',
    ['sdd', 'thread', 'threads'],
    false,
  );
}

comments('eval/pr-comments/stated-promise-is-code/fixture', {
  phase: 'implementing',
  outcome: owned,
  file: 'src/paint.ts',
  marker: null,
  instruction: 'вторая покрытая строка показывает сырой источник, хотя covered line shows the node value',
});

comments('eval/pr-comments/unnamed-observation-is-spec/fixture', {
  phase: 'implementing',
  outcome: `${owned}\n\n${middle}`,
  file: 'src/paint.ts',
  marker: null,
  instruction: 'пункт списка из трёх строк теряет среднюю. Сценарии про среднюю строку молчат.',
});

comments('eval/pr-comments/unowned-is-out/fixture', {
  phase: 'implementing',
  outcome: owned,
  file: 'src/paint.ts',
  marker: null,
  instruction: 'форма входа отвергает пустой пароль',
});

comments('eval/pr-comments/verifying-does-not-open-code/fixture', {
  phase: 'verifying',
  outcome: owned,
  conversation: 'поправь сырой источник на покрытой строке сейчас',
});

comments('eval/pr-comments/later-phase-is-note/fixture', {
  phase: 'implementing',
  outcome: owned,
  conversation: 'когда дойдём до приёмки, поправь сырой источник',
});

const decision = `## Open decisions

- [ ] Which line the paint returns

## Approach

A covered line shows the node value.

## Rejected

none
`;

comments('eval/pr-comments/open-decision-is-design/fixture', {
  phase: 'designing',
  outcome: owned,
  design: decision,
  file: 'openspec/changes/issue-1/design.md',
  line: 3,
  marker: null,
  instruction: 'поправь сырой источник в paint.ts',
});

function repair(rel, mode, files) {
  tree(
    rel,
    {
      'issue.md': issue(owned),
      [`${change}/proposal.md`]: proposal(owned),
      [`${change}/design.md`]: design(true),
      [`${change}/specs/paint/spec.md`]: classSpec,
      [`${change}/tasks.md`]: '- [x] paint-line\n',
      [`${change}/tasks/paint-line.md`]: task(),
      ...files,
    },
    mode,
    ['layer', 'typecheck', 'sdd', 'thread'],
    false,
  );
}

repair('eval/repair-suite/green-suite-publishes/fixture', 'repair-green', {
  'src/paint.ts': greenPaint,
  'src/paint.test.ts': classTest,
});

repair('eval/repair-suite/near-is-not-a-handoff/fixture', 'repair-near', {
  'src/paint.ts': greenPaint,
  'src/paint.test.ts': classTest,
});

repair('eval/repair-suite/foreign-file-is-handoff/fixture', 'repair-foreign', {
  'src/paint.ts': greenPaint,
  'src/paint.test.ts': classTest,
  'src/other.ts': '/** A file no task card names. */\nexport const other = 1;\n',
});

repair('eval/repair-suite/card-file-is-edited-once/fixture', 'repair-card', {
  'src/paint.ts': rawPaint,
  'src/paint.test.ts': rawTest,
  'src/other.ts': '/** A file no task card names. */\nexport const other = 1;\n',
});

console.log('fixtures written');
