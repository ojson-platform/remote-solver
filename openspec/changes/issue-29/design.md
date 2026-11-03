## Verification boundary

`hammer`. Scenarios are observed on the open cycle's sidebar and on the face stylesheet the page inlines. The task summary is where the running set, the badge, and the absence of a hammer are seen: `The task that wears impl wears the hammer while the issue is in the running set`, `The hammer goes and the impl badge stays when the agent leaves the issue`, and `An issue in the running set with no impl task shows no hammer`. The mark and the knock are seen on that same summary and the stylesheet: `The hammer is the chosen mark`, `The filled path is M2 4 H8 V8 H22 L26 12 L22 16 H8 V20 H2 Z M12 12 H16 V30 H12 Z`, and `The hammer knocks about 45 degrees and repeats while the issue stays in the running set`. The one-file command passes `--reporter=default` so that file can exit 0. The layer command keeps the coverage reporter.

one-file: `pnpm exec vitest --run --reporter=default <test-file>`
layer: `pnpm test`
fast suite: none
`pnpm run test:types`
trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`

## External contracts

none

## Technical prerequisites

none

## Approach

The hammer is one filled mark on the task that wears `impl`. The plaque, the pool tile, and every other phase stay without it.

While the open cycle's station is `implementing`, the first task in the drawer whose box is still open wears the badge `impl`. That task is the first `- [ ]` line in `tasks.md`, the task `implement-next-task` runs. A done task does not wear the badge. Another station, or an implementing cycle with no open task, has no task that wears `impl`. The badge does not depend on the running set, so it stays when the agent leaves.

The hammer depends only on the running set. `watchSpy` (`src/window/live.ts`) writes that set from `onRunning`, and the page already reads it as `leading(key)`. The snapshot row carries that flag when the snapshot is built. The turn action (`turn(key)`, the string an empty plaque can show) is a different seam: `fix-implementation` is still the running set, and the impl task still wears the hammer. A running issue on another phase has no impl task, so it shows no hammer. `lay` keeps using `leading` only to hide the pool icon.

The flag stays off the spine. The client keeps a spine whose revision did not change, and a running-set change does not change that revision. The task summary reads the row at paint. On start, the note is scheduled and `onRunning` publishes the set before the snapshot is read. On leave, the set drops the issue and then the cleared turn notes the page.

The Tasks fold is closed while the station is `implementing`: the open row is Code, and a closed fold is `display: none`. The one summary that wears the badge sits in the Tasks section's visible row, so the mark is on screen. The fold keeps that task's scenarios and file and does not paint the badge or the hammer again. A shell with no tasks yet has no impl task and no hammer.

The mark is one `<path>` whose `d` is `M2 4 H8 V8 H22 L26 12 L22 16 H8 V20 H2 Z M12 12 H16 V30 H12 Z`, filled with the task's ink (`currentColor`). It sits on an `svg` with `viewBox="0 0 32 32"`. `transform-origin: 43.75% 93.75%` is on that `svg`, which is the bottom of the handle, `(14, 30)`. The same percentages on the path's own box are not that point. The handle overlaps the head, so the fill rule stays the default and does not punch a hole. The stylesheet swings the `svg` about 45° around that origin and repeats the swing. It does not spin. The duration is a measure in `face.css`. The element is mounted only while the issue stays in the running set. `FACE.md` records the mark, the origin, and the knock in the same session as the look. The window glossary names the hammer as that mark, in that same session.

Rejected: a hammer on the plaque, the pool tile, or the Code row. Rejected: a second path, a stroke, or `evenodd`. Rejected: keying the hammer off the action token. Rejected: storing the hammer in the spine. Rejected: leaving the only hammer inside the closed Tasks fold. Rejected: a full turn instead of a knock.

After merge the mark is that summary and the stylesheet. No flag and no follow-up step.

## Open decisions

none
