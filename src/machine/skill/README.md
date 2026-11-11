# Skill

Turn a step into the prompt a run executes, and choose the model for the step's mode.

The step declares `mechanical` or `judgment`. The model follows that mode. The only paragraphs added to a step are that action's service text and then its cycle text. The decision names the action. This module runs the skill that action maps to.

Behavior is in `openspec/specs/`.
