import {readFileSync} from 'node:fs';
import path from 'node:path';

export type SkillMode = 'mechanical' | 'judgment';

/** The skill declares its mode. The runtime maps that onto a model. */
export function skillMode(text: string): SkillMode {
  const front = /^---\n([\s\S]*?)\n---/.exec(text);
  const mode = front?.[1].match(/^mode:\s*(\S+)/m)?.[1];
  return mode === 'mechanical' ? 'mechanical' : 'judgment';
}

export function modeOfSkill(skillsDir: string, skill: string): SkillMode {
  return skillMode(readFileSync(path.join(skillsDir, skill, 'SKILL.md'), 'utf8'));
}

export function modelFor(mode: SkillMode): string {
  return mode === 'mechanical' ? 'composer-2.5-fast' : 'grok-4.7-high-fast';
}
