The prose says what this phase produced
Something weak or that must be looked at is said too
Open questions are pointed at by place and count
A clean phase omits the weak-spot sentence
A phase with no open questions omits the pointer
There is no fixed heading the writer fills in
The prose is Russian, short, and has no headings
The prose contains no diff and does not choose the next phase
The first paragraph answers that phase's question, because the spine row keeps the first sentence
A clean first visit is one paragraph
A further paragraph appears only for a refusal, open questions, a weak check, or a remark
The paragraph says what changes for the reader of the ticket and what was refused
On a published proposal the second paragraph appears only for open questions, and it gives their place and count, not their text
A published delta spec says which promise is new and which existing promise changed, names the scenario without which the decision cannot be understood, and names a promise the issue asked for that the spec does not make
A published design says where the behavior lives and which alternative was rejected, what is deliberately not built, and where the behavior is observed
The slices are in the order a person would notice them
A slice that waits on another is named
A code slice or a code change that answers a review thread says what became true after this commit, what the slice left untouched, and a check that does not prove it
The archive comment says what the person has now, what was left out on purpose, and how many capabilities and scenarios there are and whether tests cover them
A visit that fixes review threads of its own phase keeps the previous comment of that phase
The first paragraph is the updated answer to the phase question
The next paragraph names the remarks in their own words and what changed because of them, including scenario names when scenarios appeared
A last paragraph appears only when something remains to look at, and it says what to look at

## Source

Waits on `focus-post-comment`.

Implement focus bodies phase skills pass to the `focus` verb following CONTEXT § Publish: Russian, short, no headings, no diff, no next-phase choice; first paragraph answers the phase question; extra paragraphs only for refusal, open questions, weak check, or remark; proposal, spec, design, tasks, code, accept, and thread-fix shapes as named in the delta. Tests assert comment body shape on the issue comment the tracker receives.

Extend `src/machine/focus.test.ts` (and fixtures) for prose scenarios. Do not move posting rules into `endStep` or generate prose from the diff.

Leave `src/window/**` untouched in this slice.

## Proof

Test file: `src/machine/focus.test.ts`

Observes focus comment bodies on the issue: prose language and shape, paragraph count rules, phase-specific content, thread-fix multi-paragraph shape, and that previous phase comments stay.

May read `src/machine/focus.test.ts`, `src/machine/focus.ts`, and skills under `skills/sdd-flow/steps/`.

Commands that must exit 0:

```
pnpm exec vitest --run --reporter=default src/machine/focus.test.ts
pnpm test
```

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
