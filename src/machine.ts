/**
 * The machine an adapter may use. A function that is not on the object the
 * adapter received is not available to it.
 *
 * `adapterMachine` is the host: the mark, the branch name, the pull title, and
 * the archive tip. `createAdapters` passes this object.
 * `runtimeMachine` adds the prompt and the content stamp for the runtime this
 * package ships. A host does not receive it.
 */

import {branchName, pullTitlePrefix} from './machine/change/naming.ts';
import {absorbedStamp, contentRevision, sharedStamp} from './machine/change/stamp.ts';
import {authorIgnored} from './machine/mark/ignore.ts';
import {isFocusRecord, markRobot} from './machine/mark/marker.ts';
import {readComment, spokeByRobot} from './machine/mark/review.ts';
import {foldedFromTip} from './machine/phase/phase.ts';
import {serviceHookDoc, stepPrompt} from './machine/skill/hook.ts';
import {modelFor, type SkillMode} from './machine/skill/skill.ts';

export type {QueueConfig} from './machine/spy/service-config.ts';
export type {SkillMode} from './machine/skill/skill.ts';

export type {
  AgentResult,
  CheckState,
  Conversation,
  FileSource,
  IssueKey,
  IssueLinkKind,
  IssueRecord,
  Link,
  Openspec,
  Pull,
  Review,
  ReviewNote,
  Runtime,
  RuntimeAsk,
  SkillRun,
  Thread,
  ThreadRecord,
  ThreadTarget,
  Tracker,
  Vcs,
} from './machine/port.ts';

export type AdapterMachine = {
  markRobot(body: string): string;
  isFocusRecord(body: string): boolean;
  authorIgnored(login: string, patterns: readonly RegExp[]): boolean;
  spokeByRobot(body: string, login: string, ignored: readonly RegExp[]): boolean;
  readComment(
    body: string,
    login: string,
    ignored: readonly RegExp[],
  ): {body: string; manager: boolean};
  branchName(key: string, prefix?: string): string;
  pullTitlePrefix(key: string): string;
  foldedFromTip(tip: string, key: string): boolean;
};

export type RuntimeMachine = AdapterMachine & {
  absorbedStamp(text: string): string;
  contentRevision(chunks: {path: string; text: string}[]): string;
  sharedStamp(texts: string[]): string;
  serviceHookDoc(root: string): unknown;
  stepPrompt(file: string, action: string, serviceHooks: unknown, sddHooks: unknown): string;
  modelFor(mode: SkillMode): string;
};

export const adapterMachine: AdapterMachine = {
  markRobot,
  isFocusRecord,
  authorIgnored,
  spokeByRobot,
  readComment,
  branchName,
  pullTitlePrefix,
  foldedFromTip,
};

export const runtimeMachine: RuntimeMachine = {
  ...adapterMachine,
  absorbedStamp,
  contentRevision,
  sharedStamp,
  serviceHookDoc,
  stepPrompt,
  modelFor,
};
