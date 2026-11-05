## Problem

Page through written focus comments. The focus block sits directly under the title, above the reason and the ask.

## Outcome

The focus block sits directly under the title, above the reason and the ask. It pages the written focus comments. Chips stay in the header and do not scroll with the block.

Opening the sidebar lands on now: the latest written focus, in full. Back walks the older written comments, newest first, each in full. Forward returns toward now. Switching tickets lands on now for that ticket. While an older page is open and a new focus comment appears, the block returns to now.

The badge is the comment's marker. `sdd:focus:accept` is one of these pages. The Accept row's caption becomes the first sentence of that comment. Until the comment exists, the row keeps the sentence about auto-merge.

A scenario name in the prose is a link to that scenario's row lower in the sidebar. A name that is not a row stays text.

Each spine row keeps the first sentence of the latest written focus of that phase. The reason, the ask, an unmarked review, and a hook stay their own blocks under the pager.

## Scope

The focus block sits directly under the title, above the reason and the ask, and pages the written focus comments. Opening the sidebar lands on now: the latest written focus, in full. Back walks the older written comments, newest first, each in full. Forward returns toward now. Switching tickets lands on now for that ticket. While an older page is open and a new focus comment appears, the block returns to now. `sdd:focus:accept` is one of these pages. The Accept row's caption becomes the first sentence of that comment. A scenario name in the prose is a link to that scenario's row lower in the sidebar. Each spine row keeps the first sentence of the latest written focus of that phase.

## Out of scope

Which visits write a comment and what the prose says. A live page for a running worker, a full cap, a wait on another issue, or checks. Screenshots and recordings.

## Constraints

Chips stay in the header and do not scroll with the block. The badge is the comment's marker. Until the comment exists, the row keeps the sentence about auto-merge. A name that is not a row stays text. Each spine row keeps the first sentence of the latest written focus of that phase. The reason, the ask, an unmarked review, and a hook stay their own blocks under the pager.

## Capabilities

### Added

- `written-focus-page` the focus block pages the written focus comments and opens on the latest, in full
- `scenario-name-link` a scenario name in the prose is a link to that scenario's row lower in the sidebar

### Modified

- `accept-caption` the Accept row's caption becomes the first sentence of the `sdd:focus:accept` comment, and until that comment exists the row keeps the sentence about auto-merge

## Open questions

none
