/**
 * Exact delta headings. The fold and the painted diff both match these lines.
 * A title that only starts with ADDED is not one of these.
 */

export const DELTA_SECTION = {
  added: '## ADDED Requirements',
  modified: '## MODIFIED Requirements',
  removed: '## REMOVED Requirements',
  renamed: '## RENAMED Requirements',
} as const;
