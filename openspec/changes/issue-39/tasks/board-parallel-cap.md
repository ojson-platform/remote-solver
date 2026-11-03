The board runs its spy with a parallel cap of 20

A poll that finds twenty ready cycles starts twenty agents

The twenty-first waits until one of those workers leaves

## Source

`src/window/live.ts` `watchSpy`: pass `--parallel` and `20` on the `runSpy` call the board spy uses (`runSpy(box, ['--parallel', '20'], watch)` or equivalent argv). Leave `runBoard` in `src/cli.ts` calling `watchSpy` with only `--home`, leave `runSpy` cap parsing and fallback in `src/main.ts`, leave `tick` in `src/machine/scheduler.ts`, and leave `remote-solver spy` argv forwarding untouched.

## Proof

`src/window/live.test.ts` drives `watchSpy` and observes the parallel cap `runSpy` reports (`parallel <cap>`) and how many agents a poll starts when twenty-one cycles are ready, including the twenty-first held until a worker exits. Tests may use the live harness and stubs used elsewhere for spy polling in that file.

- `pnpm exec vitest --run --reporter=default src/window/live.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
