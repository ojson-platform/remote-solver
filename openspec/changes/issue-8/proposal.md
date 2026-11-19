## Problem

The sidebar spine opens one row, the layer of the plaque. A click opens another row. A second click on that same row collapses it.

A gate click and an answer both post, and the page is drawn again from the server. The row the manager had open closes, and the plaque layer opens instead. The same happens on a reload of the open ticket.

## Outcome

After a gate write, an answer, or any other write that leaves this ticket open, the spine row that was open stays open. A second click on that row still collapses it. Opening a different ticket opens the plaque layer of that ticket. Reloading the same open ticket keeps the row.

## Scope

The open row of the sidebar spine on the ticket that stays open. After a write that leaves this ticket open, and after a reload of that same ticket, the row that was open stays open. This change is the sidebar in this repository and needs nothing from another service.

## Out of scope

Changing which layer the plaque is, and storing the row on the issue.

## Constraints

A second click on the open row still collapses it. Opening a different ticket opens the plaque layer of that ticket. Which layer the plaque is does not change. The row is not stored on the issue.

## Capabilities

### Added

### Modified

- spine-row the row that was open stays open after a write and a reload of the same ticket

## Open questions
