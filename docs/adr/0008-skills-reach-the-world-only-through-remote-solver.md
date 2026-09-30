---
status: accepted
---

# Skills reach the tracker, the review, and the repository only through `remote-solver` verbs

Every read and every write a skill needs is a `remote-solver` verb, including reads: `threads <pull>` prints the open review threads with the handles `thread reply`, `thread resolve`, and `thread fix` take, plus the last conversation comment and whether it is unanswered (`conversation.unanswered`). The package source, `gh`, and the GitHub API are not part of a skill.

Until `threads` existed the write verbs were there and the read was not. Agents filled the gap by reading `src/adapters/github.ts` and `sdd.ts` from the linked package, calling `remote-solver issue` (which fails inside an occupied worktree), or posting through `gh api` directly; one `archive` run read the solver source eighteen times. Every such path bypasses the ignored-author filter and the spy mark, and none of it is testable.

Letting a skill call `gh` for reads only was rejected: the marker grammar (`sdd:layer=`, `sdd:note`, `sdd:fixed`) and the ignored-author rule live above the adapter, and a raw read has neither. A single `context` dump verb was rejected: threads are the only read skills need beyond the change files they already have.
