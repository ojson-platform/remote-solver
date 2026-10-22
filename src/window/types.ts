export type Doc = Record<string, unknown>;

export type SkillMode = 'mechanical' | 'judgment';

export function isDoc(value: unknown): value is Doc {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === 'string' && item !== '' && !out.includes(item)) {
      out.push(item);
    }
  }
  return out;
}

export type AdapterKind = 'tracker' | 'github';

export type Launch = {
  /** Path the launch passed. No path means no home file is written. */
  homePath?: string;
  /** Agents this window can offer. An empty list writes no home file. */
  agents?: readonly string[];
  /** One running ai-factory. Not stored in the home file. */
  adapter?: AdapterKind;
};

export type WindowTicket = {
  key: string;
  title: string;
  labels: readonly string[];
  /** Tracker port field. A label of another queue does not replace it. */
  queue?: string;
  /** GitHub watch-list key, `owner/repo`. */
  repo?: string;
  /** Absent when the field is missing. An empty string is a present value. */
  sddService?: string;
  assignee?: string;
  /** Absent when the adapter did not say. Closed is `false`. */
  open?: boolean;
  /** The merge is still ahead. The window does not discover this from a host. */
  mergeAhead?: boolean;
  checks?: 'green' | 'red' | 'pending' | 'none';
  parent?: string;
  dependsOn?: readonly string[];
  openPullRequests?: number;
  comments?: readonly WindowComment[];
  /**
   * Cycle hook field the adapter already returned.
   * A map of action to point, an ordered list of `{action, point, value}`, or another value.
   */
  sddHooks?: unknown;
};

export type WindowComment = {
  body: string;
  /** A manager comment is not an `sdd:focus` record. */
  manager?: boolean;
};

export type WindowOutside = {
  /** Whether a recorded agent id still answers. The window asks; it does not start that agent. */
  answers?: (agentId: string) => boolean;
  /** Live model catalog. Choosing an agent does not read it. */
  catalog?: (agentId: string) => {mechanical: string; judgment: string};
  /** Assignee write. Take calls this with the ticket key and `login()`. */
  writeAssignee?: (key: string, login: string) => void;
  /** Phase write. The window's spy calls this with `proposing`. */
  writePhase?: (key: string, phase: string) => void;
  /** A step the window's spy would start, in the gathered checkout. The models are the merged pair from that call. */
  startStep?: (checkout?: string, models?: {mechanical: string; judgment: string}) => void;
  /** Open tickets this adapter can see. The window filters them by the watch list. */
  tickets?: () => readonly WindowTicket[];
  /** Login of this process. Not a Tracker or GitHub call. */
  login?: () => string;
  /** True while an agent leads a step for this key. */
  leading?: (key: string) => boolean;
  /** Write `sddService`. The next read sees it. */
  writeService?: (key: string, service: string) => void;
  /** Threads and the conversation for this key. The window does not call a review host. */
  review?: (key: string) => WindowReview | undefined;
  /**
   * URL for a file and line on the pull request.
   * Arcanum on Tracker, the pull request page on GitHub. The window does not build it.
   */
  reviewPlace?: (place: {file: string; line: number}) => string;
};

/** Threads and the last conversation comment the review port already returned. */
export type WindowReview = {
  threads: readonly {marker?: string | null; lines: readonly string[]}[];
  conversation?: {last?: {marker?: string | null; body: string} | null} | null;
};

export type SidebarHookPoint = {action: string; point: string; paragraph: string};

/** One block the open ticket has. Absent blocks are omitted. */
export type SidebarBlock =
  | {kind: 'reason'; line: string}
  | {kind: 'ask'; body: string}
  | {kind: 'focus'; body: string}
  | {
      kind: 'unanswered';
      threads?: readonly {lines: readonly string[]}[];
      comment?: string;
    }
  | {kind: 'hook'; line: string}
  | {kind: 'hook'; points: readonly SidebarHookPoint[]};

export type ModelField = {value: string; needsValue: boolean};

export type SettingsState = {
  open: boolean;
  agent: string;
  models: {mechanical: ModelField; judgment: ModelField};
  effort?: {mechanical: string; judgment: string};
  speed?: {mechanical: string; judgment: string};
  watch: string[];
  roots: {arcadia: string; github: string};
};

/** The overlay group. It shows `.aifactory/config.yaml` of the chosen checkout. */
export type OverlayGroup = {
  file: '.aifactory/config.yaml';
  checkout: string;
  agent: string;
  models: {mechanical: ModelField; judgment: ModelField};
  effort?: {mechanical: string; judgment: string};
  speed?: {mechanical: string; judgment: string};
  watch: string[];
};

export type ServiceQueueField = {
  name: string;
  description: string;
  warning?: true;
};

export type ServiceIgnoreField = {
  value: string;
  warning?: true;
  removeOnly?: true;
};

export type ServiceHookField = {
  action: string;
  point: string;
  values: string[];
};

/** One free point of an action the agent decision prints. */
export type ServiceHookChoice = {action: string; point: string};

/** The service-config group. It shows `openspec/config.yaml` of the chosen checkout. */
export type ServiceConfigGroup = {
  file: 'openspec/config.yaml';
  checkout: string;
  save: boolean;
  queues?: {items: ServiceQueueField[]; warning?: true};
  base?: string;
  branchScope?: string;
  ignoreComments?: ServiceIgnoreField[];
  hooks?: ServiceHookField[];
  /** Free points. An action is absent when both of its points are taken. */
  hookChoices?: ServiceHookChoice[];
};

export type CardState = {
  key: string;
  reason: string;
  takeDisabled: boolean;
  choices: string[];
  /** Gathered checkout when the path stays inside the root. */
  checkout?: string;
  /** Tracker port field, or the GitHub label `queueOf` found. */
  queue: string;
};

/** A pool card. `take` is the same gesture as dragging the card onto the board. */
export type PoolCard = {
  key: string;
  title: string;
  take: true;
  takeDisabled?: true;
  icon?: true;
  reason?: string;
  /** Gathered checkout copied from the checkout card. */
  checkout?: string;
  /** Tracker port field, or the GitHub label `queueOf` found. */
  queue: string;
  /** Service choices copied from the checkout card. */
  choices: string[];
};

export const COLUMN_NAMES = [
  'proposing',
  'specifying',
  'designing',
  'tasking',
  'implementing',
  'verifying',
  'accepting',
] as const;

export type ColumnName = (typeof COLUMN_NAMES)[number];

export type PhaseRow = number | {done: number; open: number} | 'green' | 'red' | 'pending';

/** A column card. `icon` is present or absent: one mark, no letters. */
export type CycleCard = {
  key: string;
  title: string;
  icon?: true;
  reason?: string;
  phaseRow?: PhaseRow;
  layers?: string;
};

export type BoardState = {
  visible: true;
  rows: {text: string}[];
  settingsOpen: boolean;
  stepsStart: boolean;
  takeDisabled: boolean;
  cards: CardState[];
  watch: string[];
  pool: PoolCard[];
  columns: {name: ColumnName; cards: CycleCard[]}[];
};
