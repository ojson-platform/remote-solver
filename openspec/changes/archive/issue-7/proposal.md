## Problem

The key on a plaque is text inside the control that opens the sidebar. During a cycle the manager has to find that issue on GitHub by number.

## Outcome

The key is a link to the issue. On GitHub that is the issue page of the repository named on the ticket. Activating the key follows the link. It does not open or close the sidebar, and it does not take the ticket. Activating the title still opens the sidebar, and a second click on the title still closes it. A ticket with no repository keeps the key as text. The board shows the key beside the title.

## Scope

The key on a plaque, and the board heading that shows that key. This change is the window in this repository and needs nothing from another service.

## Out of scope

A link to the pull request. The station door, which already opens the change file.

## Constraints

Activating the key follows the link. It does not open or close the sidebar, and it does not take the ticket. Activating the title still opens the sidebar, and a second click on the title still closes it. A ticket with no repository keeps the key as text.

## Capabilities

### Added

### Modified

- plaque-key The key on a plaque is a link to the issue, and activating it follows that link
- ticket-heading The board no longer shows `#<key>: <title>`

## Open questions
