/** The skill each agent action runs. `skills/sdd-flow` § Actions and each skill's Trigger mirror it. */
export const ACTION_SKILL = {
  'create-proposal': 'sdd-plan',
  'improve-proposal': 'sdd-plan',
  'restore-baseline': 'sdd-baseline',
  'create-initial-specs': 'sdd-specify',
  'improve-specs': 'sdd-specify',
  'create-design': 'sdd-design',
  'improve-design': 'sdd-design',
  'create-tasks': 'sdd-tasks',
  'improve-tasks': 'sdd-tasks',
  'implement-next-task': 'sdd-implement',
  'fix-implementation': 'sdd-fix',
  'classify-failures': 'sdd-verify',
  'classify-comments': 'sdd-pr-comments',
  archive: 'sdd-accept',
  unarchive: 'sdd-accept',
} as const;

export type AgentAction = keyof typeof ACTION_SKILL;
export type Skill = (typeof ACTION_SKILL)[AgentAction];

/** The action that answers review threads on a layer. */
export const LAYER_ACTION: Record<string, AgentAction> = {
  proposal: 'improve-proposal',
  spec: 'improve-specs',
  design: 'improve-design',
  tasks: 'improve-tasks',
  code: 'fix-implementation',
};
