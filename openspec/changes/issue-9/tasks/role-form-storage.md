A filled name stores the role and not an agent

An empty name stores no role

## Source

The new-role form under Roles submits `add-role` with the role name, outcome, and text only; it must not write the home agent. A filled role name is stored on the home file; an empty role name stores no role.

Edit `src/window/client/settings.tsx` for the form action. Edit `src/window/page.ts` so `choose-agent` does not store a role from `roleDraft`, and `add-role` stores a filled name, stores nothing when the name is empty, and does not call `chooseAgent`. Edit `src/window/client/frame.ts` so `add-role` joins the settings acts with the other role edits. Leave home agent selection and `chooseAgent` home writes to the choose-agent path.

## Proof

`src/window/home-agent.test.ts` observes the home file after new-role form submission with a filled name and with an empty name while the home file has no agent. The test may read the home file and the settings posts the sheet uses.

Commands that must exit 0:

```bash
pnpm exec vitest --run src/window/home-agent.test.ts
pnpm test
pnpm run test:types
```

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`. The `scenario` name is the scenario title.
