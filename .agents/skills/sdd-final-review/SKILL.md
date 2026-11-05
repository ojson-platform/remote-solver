---
name: sdd-final-review
description: >
  Make the final review of sdd flow.
---

# sdd-final-review

Review the finished change. Read the issue, the proposal outcome and its out-of-scope list, the specs this change adds or changes, the baseline specs this change folds, the accepted ADRs that touch the behaviour this diff changes, and the diff against the base. Judge what this diff adds, changes, or stops.

This skill does not post to the pull request, does not choose a line, and does not publish the archive. It returns findings. An empty return list means the review is done.

A gap the issue lists as out of scope is not a finding. A module this change does not touch, and does not make worse, is not a finding. The same gap is one finding, under the lens where it is clearest.

## Words for the code

Use these words for the code lens.

A **module** is anything with an interface and an implementation: a function, a class, a package, or a slice. An **interface** is everything a caller must know to use the module: the types, and also the invariants, the order, the errors, the configuration, and the performance. The **implementation** is the body behind that interface.

**Depth** is leverage at the interface. A module is **deep** when a lot of behaviour sits behind a small interface. It is **shallow** when the interface is nearly as complex as the implementation. Depth is a property of the interface. A deep module may contain small parts; those parts are not part of the interface.

A **seam** is where the interface lives, a place where behaviour can change without an edit at that place. An **adapter** fills the seam. One adapter is a hypothetical seam. Two adapters make a real one. Do not treat a single adapter as a seam that should have been split.

**Leverage** is what callers get: more behaviour per unit of interface they learn. **Locality** is what maintainers get: a change, a bug, and its check stay in one module.

The **deletion test**: imagine deleting the module. If the complexity vanishes, it was a pass-through. If the complexity reappears across the callers, the module was earning its keep.

The **interface is the test surface**. Callers and tests cross the same seam. A test that reaches past the interface is tied to the implementation. Dependencies are classified only to see how that surface is tested: in-process, a local stand-in, a remote service this system owns, or a third party. The count of dependencies is not a finding.

## Words for the spec

Use these words for the spec lens.

A **requirement** is one promise of a behaviour a caller can observe. A sentence about the writer's private steps is not a requirement, unless that observation is the steps themselves.

A **scenario** is one situation of a requirement. Its WHEN is the situation already in place, specific enough that the THEN can be false. Its THEN is what the caller observes there. A THEN that only repeats the requirement, with no situation that could fail, is not a scenario. A requirement this change adds or changes has at least one scenario.

A sentence is **exact** when the only behaviour that satisfies it is that one observation. The requirement, the WHEN, and the THEN name the same values. A behaviour the issue would still call a miss, which the sentence also allows, means the sentence is not exact.

A **conflict** is two promises that cannot both be true. The two sides may be two requirements, a requirement and one of its scenarios, or a requirement and the diff.

A **check** is a test of one scenario. The check holds when that test would fail if this THEN's observation were false, and would stay failed when a weaker stand-in is true. A test that goes red only because a comment is absent, while the THEN says the comment stands on its line, is not a check of that THEN. A test that only finds a phrase in a document checks the document. That is the right check when the observation is the document itself. It is not a check of behaviour.

The **observation** is the place the spec says the behaviour is seen. The check aims at that place. A check that reaches past the observation is tied to the implementation.

## Words for what already holds

Use these words for the kept lens.

A **kept promise** is a behaviour a baseline spec already states, or a decision an accepted ADR already records, which this issue does not name as a change or a refusal.

A **drop** is the folded spec or the diff no longer doing that behaviour.

## Lenses

**Code.** For each module this diff adds or changes, name its interface in a sentence. Then ask three questions. Is the interface nearly as large as the body? Does a caller have to know the implementation to use it? Does one behaviour in this diff have to be edited in more than one module? A pass-through fails the deletion test. A real seam has two adapters; a port with one adapter is indirection. Report a miss against the interface the caller must know, not against a wish for a different design.

**Spec.** For each requirement this change adds or changes, name its observation in a sentence. Then ask three questions. Does every sentence force that observation, with the same values in the requirement, the WHEN, and the THEN? Can this requirement stand together with its scenario, with the other requirements, and with the diff? Would the check go red for this THEN, and stay red when a weaker stand-in is true? A THEN that only repeats the requirement is not a scenario. A test with no scenario is not a finding. A phrase found in a document is a finding only when the observation is behaviour.

**Task.** Walk the outcome sentence by sentence. A sentence is done when the diff makes it true, refused when the proposal's out-of-scope list names it, or missing. Look for a conflict between the issue, the outcome, and the spec, a promise with no scenario, and a scenario the diff does not do.

**Kept.** Name each kept promise this diff drops. Then ask one question. Does the issue or the out-of-scope list name that drop? An unnamed drop is a return. A named drop belongs to the task lens and is not written again.

## Return or leave

**Return** when, without the fix, the issue's outcome is false, the spec contradicts itself or the diff, a test that should catch the break stays green, or a kept promise drops without the issue naming that drop. One return per gap.

**Leave** when a later change could deepen a module, tighten a sentence, or add a test, and a reader can already use the result. A leave is not posted. The next review does not promote it because it was named before. A return appears again only from the issue and the spec.

No returns: the review is done.

## Findings

State each return as four fields:

- lens: `code`, `spec`, `task`, or `kept`
- promise: the sentence that breaks, quoted from the issue, the spec, the interface, the baseline, or the ADR
- where: the file in the diff
- gap: what is wrong, in one or two sentences

State each leave as the lens and one sentence.

Do not write the pull-request comment. Do not name a diff line. Do not say whether to publish the archive.
