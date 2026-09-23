# {{SKILL}}

Issue `#{{ISSUE}}`. Phase `{{PHASE}}`. Action `{{ACTION}}`. Pull request: `{{PR}}`.

Read `.sandcastle/prompts/context.md` and `.sandcastle/skills/{{SKILL}}/SKILL.md`. Do that action and nothing else. When the skill says Publish, commit, then `npx remote-solver publish {{ISSUE}} "#{{ISSUE}}: <title>"`. Nothing to commit: skip the commit and still publish. Do not pick another skill. Do not merge.

When the skill's Stop condition is met, stop.
