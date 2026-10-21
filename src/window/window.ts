import {existsSync, readFileSync, writeFileSync} from 'node:fs';

import {parse, stringify} from 'yaml';

const NEEDS_AGENT = 'фабрике ещё нужен агент';
const SILENT_AGENT = 'агент не отвечает';

const FACTORY_AGENTS = ['cursor', 'codex', 'claude-code', 'opencode'] as const;

type SkillMode = 'mechanical' | 'judgment';

type Pair = {
  mechanical: string;
  judgment: string;
  effort?: {mechanical: string; judgment: string};
  /** Codex has a speed field. The default is to omit the key. */
  speed: boolean;
};

/** Known pairs. Choosing an agent does not read a live catalog. */
const PAIRS: Record<string, Pair> = {
  cursor: {
    mechanical: 'composer-2.5-fast',
    judgment: 'grok-4.7-high-fast',
    speed: false,
  },
  codex: {
    mechanical: 'gpt-6-luna',
    judgment: 'gpt-6.1-sol',
    effort: {mechanical: 'low', judgment: 'high'},
    speed: true,
  },
  'claude-code': {
    mechanical: 'sonnet',
    judgment: 'opus',
    effort: {mechanical: 'medium', judgment: 'medium'},
    speed: false,
  },
  opencode: {
    mechanical: 'moonshotai/kimi-k2.7-code',
    judgment: 'moonshotai/kimi-k3',
    speed: false,
  },
};

const AGENT_KEYS = new Set(['agent', 'models', 'effort', 'speed']);
const FORBIDDEN = new Set(['person', 'phase', 'focus', 'metrics']);

type Doc = Record<string, unknown>;

export type Launch = {
  /** Path the launch passed. No path means no home file is written. */
  homePath?: string;
  /** Agents this window can offer. An empty list writes no home file. */
  agents?: readonly string[];
};

export type WindowOutside = {
  /** Whether a recorded agent id still answers. The window asks; it does not start that agent. */
  answers?: (agentId: string) => boolean;
  /** Live model catalog. Choosing an agent does not read it. */
  catalog?: (agentId: string) => {mechanical: string; judgment: string};
  /** Assignee write. This window does not call it: Take that writes an assignee is later. */
  writeAssignee?: () => void;
  /** A step the window's spy would start. */
  startStep?: () => void;
};

export type ModelField = {value: string; needsValue: boolean};

export type SettingsState = {
  open: boolean;
  agent: string;
  models: {mechanical: ModelField; judgment: ModelField};
  effort?: {mechanical: string; judgment: string};
  speed?: {mechanical: string; judgment: string};
};

export type BoardState = {
  visible: true;
  rows: {text: string}[];
  settingsOpen: boolean;
  stepsStart: boolean;
  takeDisabled: boolean;
};

function isDoc(value: unknown): value is Doc {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function textOf(homePath: string | undefined): string | null {
  if (!homePath || !existsSync(homePath)) {
    return null;
  }
  return readFileSync(homePath, 'utf8');
}

function parseDoc(text: string | null): Doc {
  if (text === null || text.trim() === '') {
    return {};
  }
  const raw = parse(text);
  return isDoc(raw) ? raw : {};
}

function agentOf(doc: Doc): string {
  return typeof doc.agent === 'string' ? doc.agent : '';
}

function slot(models: unknown, mode: SkillMode): string {
  if (!isDoc(models)) {
    return '';
  }
  const value = models[mode];
  return typeof value === 'string' ? value : '';
}

function modeValues(value: unknown): {mechanical?: string; judgment?: string} {
  if (!isDoc(value)) {
    return {};
  }
  const out: {mechanical?: string; judgment?: string} = {};
  if (typeof value.mechanical === 'string' && value.mechanical !== '') {
    out.mechanical = value.mechanical;
  }
  if (typeof value.judgment === 'string' && value.judgment !== '') {
    out.judgment = value.judgment;
  }
  return out;
}

function restOf(doc: Doc): Doc {
  const rest: Doc = {};
  for (const [key, value] of Object.entries(doc)) {
    if (AGENT_KEYS.has(key) || FORBIDDEN.has(key) || value === undefined) {
      continue;
    }
    rest[key] = value;
  }
  return rest;
}

function replaceAgent(previous: Doc, agentId: string): Doc {
  const next: Doc = {agent: agentId};
  const pair = PAIRS[agentId];
  if (pair) {
    next.models = {mechanical: pair.mechanical, judgment: pair.judgment};
    if (pair.effort) {
      next.effort = {mechanical: pair.effort.mechanical, judgment: pair.effort.judgment};
    }
  }
  return {...next, ...restOf(previous)};
}

function modelRow(doc: Doc): {text: string}[] {
  const mechanical = slot(doc.models, 'mechanical');
  const judgment = slot(doc.models, 'judgment');
  if (mechanical === '' && judgment === '') {
    return [{text: 'нужны модели mechanical и judgment'}];
  }
  if (mechanical === '') {
    return [{text: 'нужна модель mechanical'}];
  }
  if (judgment === '') {
    return [{text: 'нужна модель judgment'}];
  }
  return [];
}

/** The window for one launch. Another launch has its own home path. */
export function openWindow(launch: Launch = {}, outside: WindowOutside = {}) {
  const offered = launch.agents ?? FACTORY_AGENTS;
  let baseline = textOf(launch.homePath);
  let doc = parseDoc(baseline);
  let settingsOpen = false;

  function adopt(text: string | null): void {
    baseline = text;
    doc = parseDoc(text);
  }

  function recorded(): boolean {
    return Boolean(launch.homePath) && baseline !== null && agentOf(doc) !== '';
  }

  function answers(): boolean {
    if (!recorded()) {
      return false;
    }
    return outside.answers?.(agentOf(doc)) ?? true;
  }

  function canWrite(): boolean {
    if (!launch.homePath) {
      return false;
    }
    const disk = textOf(launch.homePath);
    if (disk !== baseline) {
      adopt(disk);
      return false;
    }
    return true;
  }

  function commit(next: Doc): void {
    if (!launch.homePath) {
      return;
    }
    const clean: Doc = {};
    for (const [key, value] of Object.entries(next)) {
      if (FORBIDDEN.has(key) || value === undefined) {
        continue;
      }
      clean[key] = value;
    }
    const text = stringify(clean);
    writeFileSync(launch.homePath, text);
    baseline = text;
    doc = clean;
  }

  function settings(): SettingsState {
    const agent = agentOf(doc);
    const pair = PAIRS[agent];
    const effortFile = modeValues(doc.effort);
    const speedFile = modeValues(doc.speed);
    const mechanical = slot(doc.models, 'mechanical');
    const judgment = slot(doc.models, 'judgment');
    const state: SettingsState = {
      open: settingsOpen,
      agent,
      models: {
        mechanical: {value: mechanical, needsValue: agent !== '' && mechanical === ''},
        judgment: {value: judgment, needsValue: agent !== '' && judgment === ''},
      },
    };
    if (pair?.effort) {
      state.effort = {
        mechanical: effortFile.mechanical ?? pair.effort.mechanical,
        judgment: effortFile.judgment ?? pair.effort.judgment,
      };
    }
    if (pair?.speed) {
      state.speed = {
        mechanical: speedFile.mechanical ?? '',
        judgment: speedFile.judgment ?? '',
      };
    }
    return state;
  }

  function modelsReady(): boolean {
    return slot(doc.models, 'mechanical') !== '' && slot(doc.models, 'judgment') !== '';
  }

  function rows(live: boolean): {text: string}[] {
    if (!recorded()) {
      return [{text: NEEDS_AGENT}];
    }
    if (!live) {
      return [{text: SILENT_AGENT}];
    }
    return modelRow(doc);
  }

  function board(): BoardState {
    const live = answers();
    return {
      visible: true,
      rows: rows(live),
      settingsOpen,
      stepsStart: live && modelsReady(),
      takeDisabled: !live,
    };
  }

  return {
    board,
    settings,
    openSettings() {
      settingsOpen = true;
    },
    closeSettings() {
      settingsOpen = false;
    },
    chooseAgent(agentId: string) {
      if (!launch.homePath || offered.length === 0 || !offered.includes(agentId)) {
        return;
      }
      if (!canWrite()) {
        return;
      }
      commit(replaceAgent(doc, agentId));
    },
    leaveModel(mode: SkillMode, value: string) {
      if (!recorded() || !canWrite()) {
        return;
      }
      const models = isDoc(doc.models) ? {...doc.models} : {};
      models[mode] = value;
      commit({...doc, models});
    },
    leaveEffort(mode: SkillMode, value: string) {
      const pair = PAIRS[agentOf(doc)];
      if (!pair?.effort || !recorded() || !canWrite()) {
        return;
      }
      const effort = {...modeValues(doc.effort)};
      if (value === '') {
        delete effort[mode];
      } else {
        effort[mode] = value;
      }
      const next: Doc = {...doc};
      if (effort.mechanical === undefined && effort.judgment === undefined) {
        delete next.effort;
      } else {
        next.effort = effort;
      }
      commit(next);
    },
    leaveSpeed(mode: SkillMode, value: string) {
      const pair = PAIRS[agentOf(doc)];
      if (!pair?.speed || !recorded() || !canWrite()) {
        return;
      }
      const speed = {...modeValues(doc.speed)};
      if (value === '') {
        delete speed[mode];
      } else {
        speed[mode] = value;
      }
      const next: Doc = {...doc};
      if (speed.mechanical === undefined && speed.judgment === undefined) {
        delete next.speed;
      } else {
        next.speed = speed;
      }
      commit(next);
    },
    take() {},
    spy() {
      if (answers() && modelsReady()) {
        outside.startStep?.();
      }
    },
  };
}
