## Problem

A `Parent:` line or a `Depends:` line in the issue body is not a link. Parent, blocks, blocked-by, and depends-on are the host's own issue links, on GitHub and on Arcanum. The reason block names children and blockers.

## Outcome

The machine reads parent, blocks, blocked-by, and depends-on from the host's own issue links, on GitHub and on Arcanum. It writes those links when the flow creates a child cycle or a dependency, and it does not write a body line. Every card, in a column and in the pool, and the open sidebar show the same marks. A mark is a chip with a number. The reason block no longer names children or blockers. Open questions, Ask, and the merge stay in that block. Clicking a chip opens that issue the way clicking its card does. Hovering the chip shows that issue's title. The click does not open the card the chip stands on.

Tasking still waits until every child is at least specified, then moves to implementing. A cancelled child still holds that wait, and the machine still names that child. Implementing still runs an open task before it looks at links. With no open task, it waits until every child is accepted, then waits while a blocker is open, then moves to verifying. A closed issue does not hold that wait. No other phase move waits on a link. Rolling this issue back does not move the linked issue.

## Scope

Reading parent, blocks, blocked-by, and depends-on from the host's own issue links, on GitHub and on Arcanum. Writing the host link when the flow opens a child cycle or a dependency. The same marks on every card, in a column and in the pool, and in the open sidebar. The tasking wait and the implementing wait on those links. The reason block, which no longer names children or blockers while Open questions, Ask, and the merge stay.

## Out of scope

Parsing `Parent:` or `Depends:` from the body. A phase wait the text does not name. Moving a linked issue on rollback. The rest of an Arcanum tracker beyond these links. A chip on the child that names its parent. Edges drawn between cards. Listing an issue that is not the direct link.

## Constraints

A parent link is a child: an open cycle issue this issue is the parent of. A blocked-by link and a depends-on link are blockers: issues this issue waits on. A blocks link is the other side and does not hold this issue. One issue on two of these links counts once for the wait. When one issue is both a child and a blocker, the card shows both marks.

A mark is shown only when the other issue is on the board. A closed issue and a cancelled issue are absent, so they have no mark. A cancelled child still holds the tasking wait, and the machine still names that child. A mark is direct. The issue that holds another lists that next issue, not the issues beyond it.

A mark is a chip with a number. Chips wrap onto the next line and are not cut off. Within one kind the numbers follow key order. A light corner, down and then right, with no arrowhead, is a child and stands only on the parent. The child has no chip pointing back at the parent. A muted arrow to the left is an issue this one waits on. A brass arrow to the right is an issue this one holds. Children come first, then the issues it waits on, then the issues it holds.

In the sidebar the chips sit under the title and stay in place while the body scrolls. The flow that opens a child cycle or a dependency writes the host link and does not write a body line.

## Capabilities

### Added

- link-mark every card and the open sidebar show the same direct marks, a chip with a number

### Modified

- dependencies a child and a blocker are host issue links, a body line is not one, and tasking and implementing still wait on them

## Open questions
