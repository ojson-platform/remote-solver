## Problem

The focus pager is two words, «назад» and «вперёд», and the word that cannot be used disappears. The count of written pages is not on the control.

## Outcome

One control on the focus row, opposite the badge: a back chevron, the current page and the count, and a forward chevron, in the form `< 11/12 >`. It sits in the right part of that row and scrolls with the block. The count runs from the oldest page, so the latest page reads `12/12`. A chevron that cannot move stays in place and goes quiet, so the number does not jump.

A single written focus leaves the control out. The row is then the badge and the prose.

Back still walks older written comments, newest first. Forward still returns toward now. Opening still lands on the latest page. The badge and the prose stay as they are.

## Scope

The focus pager: one control on the focus row, opposite the badge, in the right part of that row, scrolling with the block.

## Out of scope

Which comment is a page, the badge, the prose, and where the focus block sits.

## Constraints

The count runs from the oldest page, so the latest page reads `12/12`. A chevron that cannot move stays in place and goes quiet, so the number does not jump. A single written focus leaves the control out. Back still walks older written comments, newest first. Forward still returns toward now. Opening still lands on the latest page. The badge and the prose stay as they are. The throwaway comparison is `src/window/focus-pager.prototype.html`. The row is the chosen placement. The header pin and the right-rim solid are not.

## Capabilities

### Added

### Modified

- `focus-pager` one control on the focus row, opposite the badge, shows a back chevron, the current page and the count, and a forward chevron

## Open questions

none
