## Problem

The person choosing a ticket reads the title and the issue description together. The description is the issue body the tracker already returned, the author's text outside `<!-- sdd:begin -->` and `<!-- sdd:end -->`. A cycle in the pool does not show that description in the sidebar.

## Outcome

A cycle in the pool shows its issue description in the sidebar. The person can read it when choosing a ticket, along with the title. An empty description leaves no block. When the cycle leaves the pool, the block goes.

## Scope

The issue description of a cycle in the pool, in the sidebar.

## Out of scope

Editing the description from the sidebar. Showing the description on a cycle that has left the pool. A second fetch of the issue body.

## Constraints

The description is the issue body the tracker already returned, the author's text outside `<!-- sdd:begin -->` and `<!-- sdd:end -->`. An empty description leaves no block. When the cycle leaves the pool, the block goes. The spine of a taken cycle stays as it is.

## Capabilities

### Added

- `issue-description` a pool cycle shows the author's issue text in the sidebar

### Modified

none

## Open questions

none
