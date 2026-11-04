## Verification boundary

`phase-header`. Scenarios are observed on the rendered window page that `src/window/board.test.ts` already draws. The mask, the header, the names, and where the first row starts are the inlined face stylesheet and the phase-name row. The card lead is the show path in the client script that page serves: the scroll uses the board's computed `padding-top` and no second offset. The one-file command passes `--reporter=default` so that file can exit 0. The layer command keeps the coverage reporter.

one-file: `pnpm exec vitest --run --reporter=default <test-file>`
layer: `pnpm test`
fast suite: none
trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`
`pnpm run test:types`

## External contracts

none

## Technical prerequisites

none

## Approach

The window already has the seams this change uses. `Board` in `src/window/client/board.tsx` draws `.head` in `.board-frame`, outside `<main class="board">`: an empty key cell, then one `.phase` for each station name. `.head` and `.stations` share `252px repeat(7, minmax(0, 1fr))`. `.head` is absolute, transparent, 28px tall, and outside the board's mask. `.board` in `src/window/face.css` is the scrollport. The show path in `src/window/client/main.tsx` already reveals a card by `getComputedStyle(board).paddingTop`. Measures stay in `face.css`. The look stays in `src/window/FACE.md`.

Pull the fade up into the header's lower padding. On `.board`, keep both `mask-image` and `-webkit-mask-image`, and set them to `linear-gradient(to bottom, transparent 0 20.75px, #000 28px, #000 100%)`. Set `padding-top` to `28px` and leave the `padding: 12px` shorthand, so the side inset that aligns `.head` stays. Content is gone through the letters, fades only from 20.75px to 28px, and is fully opaque from the bottom edge of the header. At rest the first row starts on that edge, so it is not inside the fade. A row that scrolls up fades inside those 7px and is hidden before it reaches the letters.

The lower padding is the last 7px of the 28px header, from the bottom of the centered 10px/1.35 line to the header's bottom edge. It is not a `padding` property on `.head`. The 10px size, the inherited 1.35 line, the 28px height, the centering, and the column grid stay as they are.

The show path keeps that one lead. Do not add a second offset. When `padding-top` changes from 88px to 28px, a shown card clears the fade by the new computed padding.

The words that still describe the tall band follow the same sentence: the fade is the header's lower padding, and at rest the first row starts at the bottom of the header, fully readable. That sentence replaces the clear-band wording in the board paragraph of `src/window/FACE.md` and in the purpose and the requirement of `openspec/specs/phase-header/spec.md`. The MODIFIED delta already states that requirement; the baseline requirement on this branch says the same thing, so the fold replaces the block with itself. The fold does not rewrite the purpose, so the purpose is edited here. In `src/window/board.test.ts`, the scenario "A row that scrolls up fades out under the names and the names stay readable" asserts the new mask and `padding-top: 28px`. The scenarios the delta adds are observed in that same file.

After merge the fade is that mask and that padding. No flag, no config, and no follow-up step.

Rejected: leaving the fade through 68px and `padding-top: 88px`. Rejected: a fade that runs down past 28px into the first row. Rejected: a dark bar behind the names. Rejected: moving `.head` back into the scrolling board. Rejected: changing the header height, the type size, or the column grid. Rejected: a second offset beside the computed `padding-top`.

## Open decisions

none
