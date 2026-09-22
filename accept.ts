import {machine, type Machine} from './adapters/compose.ts';
import {readChange} from './machine/change.ts';
import {applyLabels} from './machine/flow.ts';
import {labelsAfterAdvance} from './machine/phase.ts';
import {accept} from './machine/policy.ts';

/** Close proposing, specifying, or designing. The agent does not run this. Merge is not this command. */
export function acceptIssue(key: string, box: Machine): string {
  const record = box.tracker.issue(key);
  const decision = accept(record, readChange(key, box.vcs.filesAt(key)));
  if (decision.kind !== 'advance') {
    throw new Error(decision.reason);
  }
  applyLabels(box.tracker, key, record.labels, labelsAfterAdvance(record.labels, decision.to));
  const login = box.tracker.login();
  box.tracker.comment(key, `sdd:accept ${decision.reason} by @${login}`);
  return `#${key}: ${decision.reason}`;
}

const isDirect = process.argv[1]?.endsWith('accept.ts');
if (isDirect) {
  const key = process.argv[2];
  if (!key) {
    console.error('Usage: npx tsx .sandcastle/accept.ts <key>');
    process.exit(1);
  }
  try {
    console.log(acceptIssue(key, machine()));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
