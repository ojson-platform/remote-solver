/** The skill each agent action runs. `skills/sdd-flow` § Actions and each skill's Trigger mirror it. */
export const ACTION_SKILL = {
  'create-proposal': 'plan',
  'improve-proposal': 'plan',
  'restore-baseline': 'baseline',
  'create-initial-specs': 'specify',
  'improve-specs': 'specify',
  'create-design': 'design',
  'improve-design': 'design',
  'create-tasks': 'tasks',
  'improve-tasks': 'tasks',
  'implement-next-task': 'implement',
  'fix-implementation': 'fix',
  'classify-failures': 'verify',
  'classify-comments': 'pr-comments',
  archive: 'accept',
  unarchive: 'accept',
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
