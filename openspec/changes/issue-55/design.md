## Verification boundary

`spec-archive`. Scenarios are observed on a fixture checkout that the accept step archives, in `src/machine/archive.test.ts`. The fold, the section order, and the baseline after it are that checkout once `openspec archive issue-<key> --yes` has applied the delta. A new spec's Purpose and an existing spec's Purpose are the Purpose section of `openspec/specs/<capability>/spec.md` in the same commit. The dated directory is the one the command wrote at `openspec/changes/archive/<date>-issue-<key>/`. The move is that directory becoming `openspec/changes/archive/issue-<key>/` before the commit. The one commit, the line `Sdd-Archive: issue-<key>`, and the tip are that commit, and the tip stays until unarchive. A refusal is the command's non-zero exit with no commit. A baseline that would have no requirement is the Wait that names that baseline. The machine, the window, review, and unarchive keep reading `archive/issue-<key>` on the readers that already do: `archiveDir` in `src/machine/naming.ts` (`src/machine/change.test.ts`), the archive mark and its parent in `src/adapters/vcs.ts` (`src/adapters/vcs.test.ts`), the window content tree in `src/window/change-files.ts` (`src/window/spec-diff.test.ts`), and `archiveChangePath` in `src/reviewer/act.ts` (`src/reviewer/reviewer.test.ts`). Unarchive stays the revert in `skills/sdd-flow/steps/accept.md`. The step does not merge. `openspec validate --all --strict --no-interactive` still runs before the commit. The one-file command passes `--reporter=default` so that file can exit 0. The layer command keeps the coverage reporter.

one-file: `pnpm exec vitest --run --reporter=default <test-file>`
layer: `pnpm test`
fast suite: none
trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`
`pnpm run test:types`

## External contracts

The OpenSpec CLI applies the change's delta onto the baselines and parks the change in a dated archive directory. On a spec that did not exist, it writes a placeholder Purpose. It leaves an existing spec's Purpose as it was. It refuses, and does not commit, when a baseline would have no requirement.

## Technical prerequisites

none

## Approach

The accept step is the `## archive` section of `skills/sdd-flow/steps/accept.md`. That section is the only place that folds. Today it tells the agent to edit each baseline and then move `openspec/changes/issue-<key>/` onto `openspec/changes/archive/issue-<key>/`.

The fold becomes `openspec archive issue-<key> --yes`. The command applies RENAMED, then REMOVED, then MODIFIED, then ADDED, and it writes `openspec/changes/archive/<date>-issue-<key>/`. Before the commit, move the directory that command created to `openspec/changes/archive/issue-<key>/`. The dated directory is not in the commit. `archiveDir` in `src/machine/naming.ts` stays the undated path. The window content tree (`src/window/change-files.ts`), review (`archiveChangePath` in `src/reviewer/act.ts`), and the repository read of an archive tip (`src/adapters/vcs.ts`) keep that path. They do not learn a date.

In that same commit, a spec the command created does not keep `TBD - created by archiving change ...`. Its Purpose becomes the gist of that capability's line under `## Capabilities` in the proposal, the words after the id. A spec that already existed keeps its Purpose, including this capability: the command does not change it, and the step does not open it. Requirement blocks the command applied stay as the command wrote them. `applyDelta` in `src/window/spec-diff.ts` draws the board's diff. It is not this fold.

`openspec validate --all --strict --no-interactive` runs after the Purpose edit and before the commit. A non-zero exit does not commit. One commit holds the folded baselines, the Purpose lines, and the move. Its body contains a line `Sdd-Archive: issue-<key>`. That commit stays the tip until unarchive. `## unarchive` stays a revert of that commit and does not contain that line. The step does not merge the pull request. ADR 0002 and ADR 0030 stay. This decision is ADR 0034.

When the command refuses, the step does not publish and does not commit. A refusal because a baseline would have no requirement is a Wait that names that baseline. That is the same stop § Delta already states, and the same Stop the accept step already has for a baseline with no requirement. The step does not repair that delta by hand.

The risk is a dated directory left where the readers look, a new spec left on the placeholder Purpose, or an existing Purpose rewritten. The move and the Purpose edit are in the one commit, and an existing spec is not opened. A second commit would stop the archive commit being the tip, so unarchive would revert the wrong one.

Rejected: editing requirement blocks by hand when the command can apply them. Rejected: leaving `openspec/changes/archive/<date>-issue-<key>/` as the archive those readers use. Rejected: teaching the machine, the window, review, or unarchive a dated path. Rejected: changing unarchive into anything other than a revert of the archive commit. Rejected: a second commit for the move or the Purpose. Rejected: merging the pull request from this step. Rejected: a new sdd verb for the fold. The step already calls this CLI for `openspec validate` (ADR 0015). The spec names `openspec archive`.

After merge the archive section is the command, the move, the Purpose line, validate, and the one marked commit. Nothing is left to fold by hand.

## Open decisions

none
