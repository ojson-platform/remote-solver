import {traceCommands} from '../../src/eval/trace.ts';

/** Successful `sdd` invocations of one verb. A non-zero exit does not count. */
export function sddArgs(trace: string[], verb: string): string[][] {
  return traceCommands(trace, 'sdd')
    .filter(command => command.exit === 0 && command.args[0] === verb)
    .map(command => command.args);
}

/** True when one successful verb comes after another. */
export function follows(trace: string[], earlier: string, later: string): boolean {
  const commands = traceCommands(trace, 'sdd').filter(command => command.exit === 0);
  const at = commands.findIndex(command => command.args[0] === earlier);
  return at >= 0 && commands.slice(at + 1).some(command => command.args[0] === later);
}

export function anyVerb(trace: string[], verbs: readonly string[]): boolean {
  return verbs.some(verb => sddArgs(trace, verb).length > 0);
}

/** The change itself. The skill files and the stub are the session around it. */
export function changeEdited(edited: string[]): boolean {
  return edited.some(file => file.startsWith('openspec/') || file.startsWith('src/'));
}
