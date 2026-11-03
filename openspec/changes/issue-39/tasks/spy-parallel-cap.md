No flag uses a cap of 2

A positive --parallel is the cap

The spy keeps the default cap of 2 and honors --parallel

## Source

`src/main.ts` `runSpy`: keep reading `--parallel`, falling back to 2 when absent, and passing that cap to `tick`. With argv `remote-solver spy` forwards (no flag, or `--parallel` plus a positive whole number), behavior stays as today after the board task lands. Leave `watchSpy`, `tick`, and `src/cli.ts` spy routing untouched.

## Proof

`src/main.test.ts` drives `runSpy` with the argv `remote-solver spy` forwards and observes poll starts against the cap (default 2, explicit `--parallel`, and that default and flag both hold). Tests may stub the machine and scheduler hooks used elsewhere for spy tests.

- `pnpm exec vitest --run --reporter=default src/main.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
