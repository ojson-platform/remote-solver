import {machine} from './adapters/compose.ts';
import {acceptIssue} from './accept.ts';
import {pick, resolveCycle} from './machine/flow.ts';
import {setPhase, setWait} from './machine/labels.ts';
import {updateMirror} from './machine/mirror.ts';
import {changeDir} from './machine/naming.ts';
import {PHASES, type Phase} from './machine/phase.ts';
import {loadCycle} from './machine/snapshot.ts';

// Verbs the skills call. The GitHub and git adapters sit behind them.
//   sdd.ts plan
//   sdd.ts set <key> <phase> | wait <key> | unwait <key> | accept <key>
//   sdd.ts publish <key> "<pull title>"
//   sdd.ts checks <pull>
//   sdd.ts thread open <pull> <path> <line> <body>
//   sdd.ts thread reply <pull> <comment> <body>
//   sdd.ts thread resolve <thread>
//   sdd.ts mirror <key> <Layer> <text>

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function need(value: string | undefined, usage: string): string {
  if (!value) {
    fail(usage);
  }
  return value;
}

const usage =
  'Usage: sdd.ts plan | set <key> <phase> | wait <key> | unwait <key> | accept <key> | publish <key> "<title>" | checks <pull> | thread open|reply|resolve ... | mirror <key> <Layer> <text>';

const box = machine();
const [command, ...rest] = process.argv.slice(2);

try {
  if (command === 'plan') {
    const snapshot = loadCycle(box.tracker, box.review, key => box.vcs.filesAt(key), box.config.queueLabel);
    const decision = pick(resolveCycle(snapshot, box.tracker, box.config.queueLabel));
    console.log(JSON.stringify(decision, null, 2));
  } else if (command === 'set') {
    const key = need(rest[0], usage);
    const phase = need(rest[1], usage);
    if (!PHASES.includes(phase as Phase)) {
      fail(usage);
    }
    setPhase(key, phase as Phase, box.tracker);
  } else if (command === 'wait') {
    setWait(need(rest[0], usage), true, box.tracker);
  } else if (command === 'unwait') {
    setWait(need(rest[0], usage), false, box.tracker);
  } else if (command === 'accept') {
    console.log(acceptIssue(need(rest[0], usage), box));
  } else if (command === 'publish') {
    const key = need(rest[0], usage);
    const title = rest.slice(1).join(' ');
    if (!title) {
      fail(usage);
    }
    box.vcs.push(key);
    const id = box.review.ensurePull(key, title, `${changeDir(key)}/`);
    console.log(`#${key}: pull ${id}`);
  } else if (command === 'checks') {
    const text = box.review.checksText(need(rest[0], usage)).replace(/\n$/, '');
    if (text) {
      console.log(text);
    }
  } else if (command === 'thread') {
    const sub = rest[0];
    if (sub === 'open') {
      const pull = need(rest[1], usage);
      const file = need(rest[2], usage);
      const line = Number(need(rest[3], usage));
      const body = rest.slice(4).join(' ');
      if (!Number.isInteger(line) || !body) {
        fail(usage);
      }
      box.review.openThread(pull, {commit: box.vcs.head(), path: file, line, body});
    } else if (sub === 'reply') {
      const pull = need(rest[1], usage);
      const comment = need(rest[2], usage);
      const body = rest.slice(3).join(' ');
      if (!body) {
        fail(usage);
      }
      box.review.reply(pull, comment, body);
    } else if (sub === 'resolve') {
      box.review.resolveThread(need(rest[1], usage));
    } else {
      fail(usage);
    }
  } else if (command === 'mirror') {
    const key = need(rest[0], usage);
    const layer = need(rest[1], usage);
    const text = rest.slice(2).join(' ');
    if (!text) {
      fail(usage);
    }
    const record = box.tracker.issue(key);
    box.tracker.updateBody(key, updateMirror(record.body, layer, text));
  } else {
    fail(usage);
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
