/** The change on disk. */
export type {BranchFacts, BranchSpecText, BranchText, ChangeView} from './types.ts';

export {absorbedStamp, contentRevision, sharedStamp} from './stamp.ts';
export {
  cardGap,
  deltaScenarioNames,
  HEADINGS,
  missingBaselineIds,
  namedCapabilities,
  specsReady,
  unjudgedAddedIds,
  unslicedScenario,
} from './text.ts';
export {changeText, documentDir, readBranch, readChange} from './read.ts';
