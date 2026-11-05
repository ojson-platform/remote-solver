---
status: accepted
---

# The focus a person reads is the skill's prose

A phase skill writes the focus through the `focus` verb when a visit leaves something a person will read. The paragraph rules live once in `skills/sdd-flow/CONTEXT.md` § Publish. The first line is one of the closed markers, and the archive commit's marker is `sdd:focus:accept`. `sdd:auto-plan`, `sdd:auto-spec`, and `sdd:auto-design` do not skip the comment. The archive writes it every time, including when `sdd:auto-merge` is set. The window shows the marker as a badge and the prose under it, and does not rewrite that prose. The spine row of Plan, Specify, Design, Tasks, and Code keeps the first sentence of that phase's latest comment. The Accept row caption stays the merge sentence.

A ledger the machine appends and the window strips was rejected: the person would still be reading the ledger, or a rewritten body. A heading template was rejected: there is no fixed heading. Putting the archive sentence on the Accept row was rejected: that caption is the merge sentence. Skipping the comment because an auto label is set was rejected: those labels pass a gate or a merge, and the document was still published.
