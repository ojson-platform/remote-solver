design.md Approach: paragraph rules live once in `skills/sdd-flow/CONTEXT.md` § Publish; a test of that section observes that each phase's paragraph rule is named there.

## Source

Ensure `skills/sdd-flow/CONTEXT.md` § Publish names the paragraph rule for each phase marker (`sdd:focus:plan` through `sdd:focus:accept` and whole-pull-request `sdd:focus`) without restating full prose in step prompts. Extend `src/machine/skill.test.ts` so each phase skill step names that Publish section and its marker, and the shared CONTEXT carries the paragraph rules the focus body must follow.

Leave `src/machine/focus.ts` posting logic and `src/window/**` untouched in this slice.

## Proof

Test file: `src/machine/skill.test.ts`

Observes skill shape: steps that publish focus reference CONTEXT § Publish and the closed markers; CONTEXT contains the paragraph rules for each phase.

May read `src/machine/skill.test.ts`, `skills/sdd-flow/CONTEXT.md`, and skill files under `skills/sdd-flow/steps/`.

Commands that must exit 0:

```
pnpm exec vitest --run --reporter=default src/machine/skill.test.ts
pnpm test
```

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
