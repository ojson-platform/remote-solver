# {{SKILL}}

Issue `#{{ISSUE}}`. Phase `{{PHASE}}`. Action `{{ACTION}}`. Pull request: `{{PR}}`.

Read `.sandcastle/prompts/context.md` and `.sandcastle/skills/{{SKILL}}/SKILL.md`. Do that action and nothing else. The skill names a section of `context.md` for every procedure it shares with other skills: Publish, Fix thread, Hand-off, Wait, Delta. Do not pick another skill. Do not merge.

The run ends in one signal from `context.md` § Outcome: Publish, Wait, or Hand-off. When the skill's Stop condition is met, emit that signal and stop.
