---
status: accepted
---

# A wait may carry a dialog the chat answers

A printed `wait` may carry `dialog`: the questions the chat asks before it stops. The chat shows every entry in one sitting of the client's question dialog. A ready answer is offered only when that entry's text already states the whole answer. The person's own words are always there. The machine does not invent the menu. The person may answer every entry, some of them, or dismiss. Each answer is recorded by that entry's `record`, with the person's words unchanged in place of `<answer>`. The chat does not edit the change. It then runs `step` again. Dismissing records nothing and stops. A later message that answers the same entries is recorded the same way. Any other message shows the dialog again. A `wait` with no `dialog`, and `done`, still stop.

`dialog` is printed beside the decision, as `queue`, `base`, and `step` are. It is not a field of the decision. The board keeps settling the waits it already paints, and a line comment there stays the other way to answer. The spy does not answer. This is not the ask: the ask remains the issue comment that closes a gate.

An entry is `{text, record}`. `text` is what the person answers. `record` is the `sdd` command, and `<answer>` is where the words go. A later dialog is another entry in this list, with its own `record`. The skill sentence does not name a phase. This decision fills the list in two places, both read from the published head, one entry per unchecked line, lines numbered from 1.

On `proposing`, each open item under `## Open questions` in `proposal.md`. The record is `sdd thread open <pull> <file> <line> 'sdd:layer=proposal → proposing <answer>'`. Plan publishes those items, so the line is on the pull.

On `designing`, each open item under `## Open decisions` in `design.md`. The record is `sdd thread open <pull> <file> <line> 'sdd:layer=design → designing <answer>'`. A design that was published with the item still open has the line. Two stops write the item and do not publish: a question copied from the init block, and a missing command. Those lines are not on the pull, so they are not this dialog. They stay a stopping wait, and the person fills the init block.

An item that already has a thread is not listed. A proposal or design thread is that layer's action, and the poll returns `improve-proposal` or `improve-design` before this wait. The chat's thread is what that poll already takes. Fix thread records the answer and checks the item. The poll keeps waiting until the item is checked.

The `step` after that publish is the fork that already exists. Items still open: `wait`, and `dialog` lists those. None left, and no auto tag: `wait` with the review gate and no dialog; agreement runs `sdd accept`. None left, and `sdd:auto-plan` or `sdd:auto-design` is set: that same `step` applies the advance and prints the next action.

Spec, tasks, and code do not gain this dialog. An open thread there is already an agent decision. The review gate, the assignee, a missing pull, and the checks stay waits with no dialog.

Putting the list on the decision was rejected: the board would settle a field it does not paint. A skill that checked the box itself was rejected: Fix thread is the writer. A sentence that named only the plan was rejected: the design's open decisions are the same dialog, and a later phase reuses the field by filling `record`.
