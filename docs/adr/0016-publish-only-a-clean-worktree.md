---
status: accepted
---

# Publish only from a clean worktree

Before Publish, `git status` shows only the files of this commit. Anything else is an artifact the task did not name. The cause is removed in the same run: a generated directory goes into the service `.gitignore`, a stray file is deleted, a file the task owns joins the commit. A dirty tree is not published.

Sandcastle reuses that tree as-is and does not fast-forward origin. The library does not say where a file came from, so the cleaning stays with the agent until publish. The verb `publish` enforces it: on a dirty tree it lists the files and pushes nothing; the links the runtime makes in the worktree are kept out of `git status` through `info/exclude`.
