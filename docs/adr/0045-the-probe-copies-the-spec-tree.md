---
status: accepted
---

# The probe copies the spec tree

`sdd probe` checks that `openspec archive` would fold the change. It copies `openspec` into a throwaway directory, archives there, runs `openspec validate --all --strict --no-interactive`, and deletes the directory. The working tree stays, committed and uncommitted.

A second checkout was rejected. The archive command reads and writes only that tree, and a checkout of the repository is the whole mount.
