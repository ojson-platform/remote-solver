import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'vitest';

import {requirement, scenario, spec} from '@ojson/spec-coverage';

import {gitTree} from '../../adapters/vcs/tree.ts';
import {memoryPorts} from '../../adapters/tracker/github.ts';
import {fixThread} from '../../sdd.ts';
import {proveCodeFix} from './code-fix.ts';

const whole = "export const place = 'whole';\n";
const slice = "export const place = 'slice';\n";
const PLACE = 'The place is the slice';
const ORPHAN = 'Every covered line of a fenced code block renders inside code';
const STABLE = 'The Plan row shows the outcome';
const DELTA = 'openspec/changes/issue-7/specs/place/spec.md';
const STABLE_SPEC = 'openspec/specs/spine/spec.md';

function specFor(title: string): string {
  return `### Requirement: Place\n\n#### Scenario: ${title}\n\n- **WHEN** the caller reads the place\n- **THEN** the place is the slice\n`;
}

function asserts(needle: string): string {
  return `import {readFileSync} from 'node:fs';
const text = readFileSync(new URL('./place.ts', import.meta.url), 'utf8');
if (!text.includes(${JSON.stringify(needle)})) process.exit(1);
`;
}

function named(title: string, body: string): string {
  return `// scenario(${JSON.stringify(title)})\n${body}`;
}

function git(root: string, args: string[]): string {
  const result = spawnSync(
    'git',
    ['-c', 'user.email=sdd@example.com', '-c', 'user.name=sdd', ...args],
    {cwd: root, encoding: 'utf8'},
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `git ${args.join(' ')} failed`);
  }
  return (result.stdout ?? '').trim();
}

function writeTree(root: string, files: Record<string, string>): void {
  for (const [name, text] of Object.entries(files)) {
    const full = path.join(root, name);
    mkdirSync(path.dirname(full), {recursive: true});
    writeFileSync(full, text);
  }
}

const DESIGN = 'openspec/changes/issue-7/design.md';
const COVERAGE = `## Verification boundary

one-file: \`node <test-file> -t <titles>\`
trace: \`spec\`, \`requirement\`, and \`scenario\` from \`@ojson/spec-coverage\`
test path: \`*.test.mjs\`
`;

function repo(parent: Record<string, string>, head: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'code-fix-'));
  const withDesign = (files: Record<string, string>) => (files[DESIGN] ? files : {...files, [DESIGN]: COVERAGE});
  git(root, ['init', '-b', 'master']);
  writeTree(root, withDesign(parent));
  git(root, ['add', '-A']);
  git(root, ['commit', '-m', 'parent']);
  for (const name of Object.keys(parent)) {
    if (!(name in head)) {
      rmSync(path.join(root, name));
    }
  }
  writeTree(root, withDesign(head));
  git(root, ['add', '-A']);
  git(root, ['commit', '-m', 'answer']);
  return root;
}

function nodeRun(root: string, files: string[], _titles?: readonly string[]): Promise<number> {
  for (const file of files) {
    const result = spawnSync(process.execPath, [file], {cwd: root, encoding: 'utf8'});
    if ((result.status ?? 1) !== 0) {
      return Promise.resolve(result.status ?? 1);
    }
  }
  return Promise.resolve(0);
}

async function attempt(
  root: string,
  run: (root: string, files: string[], titles: readonly string[]) => Promise<number> = nodeRun,
  boundary = false,
): Promise<{calls: string[]; body: string; error: unknown}> {
  const memory = memoryPorts({
    threadList: {
      '12': [
        {
          id: 'PRRT_1',
          comment: '41',
          path: 'place.ts',
          line: 1,
          resolved: false,
          body: 'sdd:layer=code → implementing',
        },
      ],
    },
  });
  const head = git(root, ['rev-parse', 'HEAD']);
  try {
    const body = await fixThread(
      {key: '7', pull: '12', thread: 'PRRT_1'},
      {
        review: memory.review,
        vcs: {head: async () => head, published: async () => true},
        prove: () => (boundary ? proveCodeFix(root, gitTree(root)) : proveCodeFix(root, gitTree(root), run)),
      },
    );
    return {calls: memory.calls, body, error: undefined};
  } catch (error) {
    return {calls: memory.calls, body: '', error};
  }
}

function assertOpen(calls: string[]): void {
  assert.equal(calls.includes('reply'), false);
  assert.equal(calls.includes('resolveThread'), false);
}

function assertHanded(calls: string[]): void {
  assert.equal(calls.includes('resolveThread'), false);
  assert.ok(calls.some(call => call.includes('sdd:layer=spec → specifying')));
}

function assertClean(root: string, source: string): void {
  assert.equal(git(root, ['status', '--porcelain']), '');
  assert.equal(readFileSync(path.join(root, 'place.ts'), 'utf8'), source);
}

test('an added source file comes back after the proof, and a dirty tree is left untouched', async () => {
  const root = repo(
    {'readme.ts': whole, [DELTA]: specFor(PLACE)},
    {
      'readme.ts': whole,
      [DELTA]: specFor(PLACE),
      'place.ts': slice,
      'place.test.mjs': named(PLACE, asserts('export const place')),
    },
  );
  try {
    await proveCodeFix(root, gitTree(root), nodeRun);
    assertClean(root, slice);
    writeFileSync(path.join(root, 'place.ts'), 'dirty\n');
    await assert.rejects(proveCodeFix(root, gitTree(root), nodeRun), /dirty/);
    assert.equal(readFileSync(path.join(root, 'place.ts'), 'utf8'), 'dirty\n');
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

spec('marker', () => {
  requirement('A refused proof hands the code thread to spec', () => {
    scenario('Fix refuses a code thread whose commit changes no test', async () => {
      const root = repo({'place.ts': whole}, {'place.ts': slice});
      try {
        const closed = await attempt(root);
        assert.match(String(closed.error), /changes no test/);
        assertHanded(closed.calls);
        assertClean(root, slice);
      } finally {
        rmSync(root, {recursive: true, force: true});
      }
    });

    scenario('Fix refuses a code thread whose scenario is not in the delta', async () => {
      const root = repo(
        {'place.ts': whole, [DELTA]: specFor(PLACE)},
        {
          'place.ts': slice,
          [DELTA]: specFor(PLACE),
          'place.test.mjs': named(ORPHAN, asserts("place = 'slice'")),
        },
      );
      try {
        const closed = await attempt(root, () => Promise.reject(new Error('the orphan scenario was run')));
        assert.match(String(closed.error), /not in the delta/);
        assertHanded(closed.calls);
        assertClean(root, slice);
      } finally {
        rmSync(root, {recursive: true, force: true});
      }
    });

    scenario('Fix refuses a code thread when a neighboring test is the one that fails', async () => {
      const root = repo(
        {'place.ts': slice, [DELTA]: specFor(PLACE)},
        {
          'place.ts': slice,
          [DELTA]: specFor(PLACE),
          'place.test.mjs': `${named(PLACE, asserts("place = 'slice'"))}\n${named(ORPHAN, asserts('missing'))}`,
        },
      );
      try {
        const closed = await attempt(root, (_root, _files, titles) => {
          assert.deepEqual([...titles], [PLACE]);
          return Promise.resolve(0);
        });
        assert.match(String(closed.error), /passes on the parent/);
        assertHanded(closed.calls);
        assertClean(root, slice);
      } finally {
        rmSync(root, {recursive: true, force: true});
      }
    });

    scenario('Fix refuses a code thread whose new test passes on the parent', async () => {
      const root = repo(
        {'place.ts': whole, [DELTA]: specFor(PLACE), 'place.test.mjs': named(PLACE, asserts('export const place'))},
        {
          'place.ts': slice,
          [DELTA]: specFor(PLACE),
          'place.test.mjs': named(PLACE, `// moved\n${asserts('export const place')}`),
        },
      );
      try {
        const closed = await attempt(root);
        assert.match(String(closed.error), /passes on the parent/);
        assertHanded(closed.calls);
        assertClean(root, slice);
      } finally {
        rmSync(root, {recursive: true, force: true});
      }
    });
  });

  requirement('A code thread is fixed only when its new test fails on the parent', () => {
    scenario('Fix refuses a code thread whose new test fails on HEAD', async () => {
      const root = repo(
        {'place.ts': whole, [DELTA]: specFor(PLACE)},
        {'place.ts': slice, [DELTA]: specFor(PLACE), 'place.test.mjs': named(PLACE, asserts('missing'))},
      );
      try {
        const closed = await attempt(root);
        assert.match(String(closed.error), /fails on HEAD/);
        assertOpen(closed.calls);
        assertClean(root, slice);
      } finally {
        rmSync(root, {recursive: true, force: true});
      }
    });

    scenario('Fix closes a code thread after the new test fails on the parent', async () => {
      const root = repo(
        {'place.ts': whole, [DELTA]: specFor(PLACE)},
        {'place.ts': slice, [DELTA]: specFor(PLACE), 'place.test.mjs': named(PLACE, asserts("place = 'slice'"))},
      );
      try {
        const closed = await attempt(root);
        const head = git(root, ['rev-parse', 'HEAD']);
        assert.equal(closed.error, undefined);
        assert.equal(closed.body, `sdd:fixed ${head}`);
        assert.deepEqual(closed.calls, [
          'threadList',
          'reply',
          'body:🤖 sdd:fixed ' + head,
          'resolveThread',
        ]);
        assertClean(root, slice);
      } finally {
        rmSync(root, {recursive: true, force: true});
      }
    });

    scenario('Fix closes a code thread whose scenario a stable spec names', async () => {
      const root = repo(
        {'place.ts': whole, [DELTA]: specFor(PLACE), [STABLE_SPEC]: specFor(STABLE)},
        {
          'place.ts': slice,
          [DELTA]: specFor(PLACE),
          [STABLE_SPEC]: specFor(STABLE),
          'place.test.mjs': named(STABLE, asserts("place = 'slice'")),
        },
      );
      try {
        const closed = await attempt(root);
        const head = git(root, ['rev-parse', 'HEAD']);
        assert.equal(closed.error, undefined);
        assert.equal(closed.body, `sdd:fixed ${head}`);
        assert.deepEqual(closed.calls, [
          'threadList',
          'reply',
          'body:🤖 sdd:fixed ' + head,
          'resolveThread',
        ]);
        assertClean(root, slice);
      } finally {
        rmSync(root, {recursive: true, force: true});
      }
    });
  });

  requirement('A proof runs the boundary command', () => {
    const boundary = `## Verification boundary

one-file: \`node <test-file>\`
trace: \`go test\`
test path: \`*_test.mjs\`
`;
    const bare = `## Verification boundary

trace: \`go test\`
test path: \`*_test.mjs\`
`;
    scenario('Fix closes a code thread by the boundary command', async () => {
      const root = repo(
        {'place.ts': whole, [DESIGN]: boundary},
        {
          'place.ts': slice,
          [DESIGN]: boundary,
          'place_test.mjs': asserts("place = 'slice'"),
        },
      );
      try {
        const closed = await attempt(root, nodeRun, true);
        const head = git(root, ['rev-parse', 'HEAD']);
        assert.equal(closed.error, undefined);
        assert.equal(closed.body, `sdd:fixed ${head}`);
        assertClean(root, slice);
      } finally {
        rmSync(root, {recursive: true, force: true});
      }
    });

    scenario('Fix refuses a code thread whose boundary names no command', async () => {
      const root = repo(
        {'place.ts': whole, [DESIGN]: bare},
        {
          'place.ts': slice,
          [DESIGN]: bare,
          'place_test.mjs': asserts("place = 'slice'"),
        },
      );
      try {
        const closed = await attempt(root, nodeRun, true);
        assert.match(String(closed.error), /no one-file command/);
        assert.equal(closed.calls.some(call => call.includes('sdd:layer=spec')), false);
        assert.equal(closed.calls.includes('resolveThread'), false);
      } finally {
        rmSync(root, {recursive: true, force: true});
      }
    });
  });
});
