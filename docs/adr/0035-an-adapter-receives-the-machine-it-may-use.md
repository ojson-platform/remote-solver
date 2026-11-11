---
status: accepted
---

# An adapter receives the machine it may use

A port implementation calls the machine through one object, and only the functions on that object. `adapterMachine` is the host surface: the robot mark, whether a body is a focus record, who counts as a robot, the branch name, the pull title, and whether a tip is the archive commit. `runtimeMachine` extends it with the step prompt and the content stamp, and only the runtime this package ships receives that extension. `createAdapters(root, config, machine)` passes `adapterMachine`. The adapters in this repository take the same object as an argument.

The overriding adapter is loaded beside the bundled script. The machine is inside that bundle, so the adapter cannot import it, and importing the script would start the command. Passing the object is the only seam that works there and here. Exporting every function an adapter had already imported was rejected: that list had grown to `decide`, `performIssue`, and `setPhase`, which are the machine's own behavior, and the next import would have widened it again. Giving the host the runtime's prompt was rejected for the same reason: a Tracker adapter does not build a step.
