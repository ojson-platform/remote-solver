---
status: accepted
---

# The board uses the cursor pair from home

ADR 0003 maps a step's mode onto `composer-2.5-fast` or `grok-4.7-high-fast`. `remote-solver board` replaces that pair when the merged factory agent is cursor and that mode's model is set. Every other agent, including an empty one, keeps the pair from ADR 0003.

Using the home pair for every agent was rejected: the board would then run a model the step's mode did not declare. Leaving the board on the built-in pair was rejected: the window already asks the manager to name the cursor models.
