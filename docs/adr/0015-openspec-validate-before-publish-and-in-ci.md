---
status: accepted
---

# OpenSpec validate runs before publish and in the GitHub check

`sdd-specify` runs `openspec validate --all --strict --no-interactive` before publish and does not publish a delta while the exit is non-zero. The call is direct, with no pnpm script: the skill does not depend on a package manager.

`sdd-verify` does not run validate locally. It reads a red check from the GitHub job log. A file named in the log becomes a thread `sdd:layer=spec`. A log with no file is infrastructure. Checking only at verify was late: spec format was being repaired after implementation.
