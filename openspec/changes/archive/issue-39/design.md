## Verification boundary

`parallel-cap`. The board scenarios are observed by driving `watchSpy` (`src/window/live.ts`), the spy `remote-solver board` runs: `The board runs its spy with a parallel cap of 20`, `A poll that finds twenty ready cycles starts twenty agents`, and `The twenty-first waits until one of those workers leaves`. The cap is the number `runSpy` reports as `parallel <cap>` and the count of agents that poll starts. The spy-command scenarios are observed by driving `runSpy` (`src/main.ts`) with the argv `remote-solver spy` forwards: `No flag uses a cap of 2`, `A positive --parallel is the cap`, and `The spy keeps the default cap of 2 and honors --parallel`. The one-file command passes `--reporter=default` so that file can exit 0. The layer command keeps the coverage reporter.

one-file: `pnpm exec vitest --run --reporter=default <test-file>`
layer: `pnpm test`
fast suite: none
trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`
`pnpm run test:types`

## External contracts

none

## Technical prerequisites

none

## Approach

The parallel cap enters `runSpy` (`src/main.ts`). It reads `--parallel`, falls back to 2, and passes that number to `tick` (`src/machine/scheduler.ts`). `tick` already starts at most that many ready cycles and counts a running worker toward the cap. This change leaves `tick` as that generic cap. ADR 0001 keeps the spy command's default at 2.

`remote-solver board` reaches the loop through `watchSpy` (`src/window/live.ts`). Today `watchSpy` calls `runSpy(box, [], watch)`, so the fallback of 2 is the board's cap. `watchSpy` passes `--parallel` `20` on that call. `runBoard` (`src/cli.ts`) still calls `watchSpy` and still accepts only `--home`. The window's board and the machine's scheduler stay the same seam: the window chooses the number, `tick` enforces it.

`remote-solver spy` still forwards its argv to `runSpy`. With no `--parallel` the cap is 2. `--parallel` followed by a positive whole number is the cap.

A poll that finds twenty ready cycles starts twenty agents because `tick` fills the cap `watchSpy` passed. The twenty-first stays out of `start` while twenty workers are in `state.running`. When one worker leaves, `exited` frees a slot and a later poll starts the held cycle. The board does not keep a queue of its own.

Rejected: raising the fallback inside `runSpy` to 20. That would change `remote-solver spy` with no flag. Rejected: a `--parallel` flag on `board`. The issue leaves that to another change. Rejected: removing the cap, and hardcoding 20 inside `tick`. Either one would make the spy command's default and `--parallel` stop being the cap. Rejected: a second parameter on `runSpy` beside argv. The cap already arrives as argv, and the spy command and the board share that path.

`flag` falls back to 2 when the value is not a positive whole number. The board passes `20`, which `flag` accepts. The board scenarios observe that cap, so a later edit that drops the argument fails those scenarios.

After merge the cap is the argument `watchSpy` passes. No config, no flag, and no follow-up step.

## Open decisions

none
