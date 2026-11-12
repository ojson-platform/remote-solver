import {cursor, type AgentProvider} from '@ai-hero/sandcastle';

import {modelFor, modeOfSkill, skillMode, type SkillMode} from './mode.ts';

export type {SkillMode} from './mode.ts';
export {modeOfSkill, modelFor, skillMode};

/** Cursor on this host. The CLI already keeps the chat; capturing `store.db` would copy it out of a sandbox that is not there. */
export function cursorFor(model: string): AgentProvider {
  return cursor(model, {captureSessions: false});
}

/** The agent for a mode. Today every mode is Cursor; the choice lives here. */
export function agentFor(mode: SkillMode): AgentProvider {
  return cursorFor(modelFor(mode));
}
