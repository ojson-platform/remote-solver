---
status: accepted
---

# The board passes a cap of 20 and the spy keeps 2

`remote-solver board` and `remote-solver spy` share the cap `tick` already enforces, and the number arrives as argv. The board passes `--parallel 20` and keeps no queue of its own. With no flag the spy stays at 2 and still honors `--parallel`. Raising the fallback inside `runSpy` was rejected: a spy with no flag would start twenty cycles. A flag on `board`, removing the cap, hardcoding 20 inside `tick`, and a second parameter beside argv were rejected: the two commands would stop sharing that path, and the spy's default would stop being the cap.
