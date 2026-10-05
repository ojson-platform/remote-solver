# {{SKILL}}

Issue `#{{ISSUE}}`. Phase `{{PHASE}}`. Action `{{ACTION}}`. Pull request: `{{PR}}`.
`{{QUEUE}}` is the first configured queue, the one a new child issue is filed in. Base branch `{{BASE}}`.

Read `.sandcastle/skills/sdd-flow/CONTEXT.md` and `.sandcastle/skills/sdd-flow/steps/{{SKILL}}.md`. Do that action and nothing else. The step names a section of `CONTEXT.md` for every procedure it shares with other steps: Publish, Fix thread, Hand-off, Wait, Delta. Do not pick another phase. Calls this step makes stay with the harness. Do not merge.

The run ends in one signal from `CONTEXT.md` § Outcome: Publish, Wait, or Hand-off. When the step's Stop condition is met, emit that signal and stop.
